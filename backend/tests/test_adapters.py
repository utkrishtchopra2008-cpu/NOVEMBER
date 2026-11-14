import asyncio
import json
import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.config import Settings
from app.demo import BASE, sample
from app.extraction import extract
from app.main import create_app
from app.maritime import Maritime
from app.models import ImpactInput, Report
from app.source import GitHub


def test_github_pins_commit_and_encodes_ref():
    calls = []
    def handler(request):
        calls.append(request)
        if '/contents/' in request.url.path:
            return httpx.Response(200, json={'type': 'file', 'encoding': 'base64', 'size': 3, 'content': 'eD0x'})
        return httpx.Response(200, json={'sha': BASE})
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            github = GitHub(client, 'test-token')
            assert await github.resolve('https://github.com/acme/repo', 'fix/auth') == BASE
            assert await github.source('https://github.com/acme/repo', BASE, 'src/auth.py') == 'x=1'
            with pytest.raises(HTTPException) as exc:
                await github.target('https://github.com/acme/repo', ImpactInput(analysis_id='x', pr_url='https://github.com/evil/repo/pull/1'))
            assert exc.value.status_code == 422
    asyncio.run(run())
    assert calls[1].url.params['ref'] == BASE
    assert all(r.url.host == 'api.github.com' for r in calls)


@pytest.mark.parametrize('status,expected', [(404, None), (403, 502), (429, 502), (500, 502)])
def test_github_missing_is_distinct_from_outage(status, expected):
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda req: httpx.Response(status))) as client:
            if expected is None:
                assert await GitHub(client, '').source('https://github.com/a/b', BASE, 'missing.py') is None
            else:
                with pytest.raises(HTTPException) as exc:
                    await GitHub(client, '').source('https://github.com/a/b', BASE, 'missing.py')
                assert exc.value.status_code == expected
    asyncio.run(run())


@pytest.mark.parametrize('bad', [False, True])
def test_prune_schema_and_original_excerpt(bad):
    calls = []
    def handler(req):
        calls.append(req)
        excerpt = 'invented text' if bad else 'login in auth.py'
        return httpx.Response(200, json={'model': 'configured-model', 'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps({'claims': [{'original_excerpt': excerpt, 'assertion': 'Authentication claim', 'reference': {'file_path': 'auth.py', 'function_name': 'login'}}]})}}], 'prune_metadata': {'cache_hit': False, 'secret': 'must not persist'}})
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            config = Settings(_env_file=None).model_copy(update={'mode': 'live', 'prune_api_key': 'fake', 'llm_model': 'configured-model'})
            task = extract(client, config, Report(title='Auth', content='login in auth.py'), 'https://github.com/a/b', BASE, 'user', 'run')
            if bad:
                with pytest.raises(HTTPException) as exc:
                    await task
                assert exc.value.status_code == 502
            else:
                claims, meta = await task
                assert claims[0].reference.file_path == 'auth.py'
                assert 'secret' not in meta['receipt']
    asyncio.run(run())
    assert calls[0].url == 'https://api.withprune.com/v1/chat/completions'
    assert calls[0].headers['X-Prune-Cache'] == 'exact'
    assert BASE in json.loads(calls[0].content)['messages'][1]['content']


@pytest.mark.parametrize(('status', 'expected'), [(429, 429), (402, 503), (403, 422), (500, 502)])
def test_prune_failures_return_safe_actionable_errors(status, expected):
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(status, headers={'X-Prune-Shield-Code': 'policy_block'}))) as client:
            config = Settings(_env_file=None).model_copy(update={'mode': 'live', 'prune_api_key': 'fake', 'llm_model': 'configured-model'})
            with pytest.raises(HTTPException) as exc:
                await extract(client, config, Report(title='Auth', content='login in auth.py'), 'https://github.com/a/b', BASE, 'user', 'run')
            assert exc.value.status_code == expected
            assert 'fake' not in str(exc.value.detail)
    asyncio.run(run())


def test_maritime_uses_isolated_fixed_python_parser_and_deletes_sandbox():
    calls = []
    def handler(req):
        calls.append(req)
        if req.url.path == '/api/sandboxes/ephemeral':
            return httpx.Response(201, json={'id': 'sbx-test-1', 'dataPlaneUrl': 'https://api-sbx-test.sb.mtm.sh/v1', 'secret': 'sandbox-secret'})
        if req.url.path.endswith('/commands'):
            return httpx.Response(200, json={'exitCode': 0, 'stdout': 'syntax-ok', 'stderr': ''})
        return httpx.Response(200, json={'state': 'ended'})
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            assert await Maritime(client, 'fake-key').check_python_syntax('analysis-1', 'def login():\n    return True\n') == (
                'sbx-test-1', 0, 'Python syntax parsed in an isolated sandbox.')
    asyncio.run(run())
    assert [call.method for call in calls] == ['POST', 'POST', 'DELETE']
    assert json.loads(calls[0].content)['network']['internet']['mode'] == 'none'
    assert calls[1].headers['X-Maritime-Token'] == 'sandbox-secret'
    command = json.loads(calls[1].content)['cmd']
    assert 'ast.parse' in command and 'exec(' not in command
    assert 'sandbox-secret' not in calls[0].content.decode()


def test_auth_dependency_rejects_and_isolates_tokens(tmp_path):
    # Start the test store in demo mode, then switch auth behavior to exercise
    # the real production dependency with mocked Supabase HTTP responses.
    settings = Settings(_env_file=None, database_url=f'sqlite:///{tmp_path}/auth.db', supabase_url='https://example.supabase.co', supabase_publishable_key='publishable')
    with TestClient(create_app(settings)) as client:
        settings.mode = 'live'
        async def user_lookup(url, headers):
            token = headers['Authorization']
            return httpx.Response(200, json={'id': token.removeprefix('Bearer ')}) if token != 'Bearer expired' else httpx.Response(401)
        client.app.state.client.get = user_lookup
        assert client.get('/api/findings').status_code == 401
        assert client.get('/api/findings', headers={'Authorization': 'Bearer expired'}).status_code == 401
        data = client.post('/api/intake', json=sample().model_dump(), headers={'Authorization': 'Bearer alice'}).json()
        id = data['findings'][0]['id']
        for path in (f'/api/findings/{id}', f'/api/findings/{id}/packet', '/api/correlations?analysis_id=' + data['id']):
            assert client.get(path, headers={'Authorization': 'Bearer bob'}).status_code == 404
        assert client.post(f'/api/findings/{id}/review', json={'decision': 'APPROVED', 'notes': 'attack'}, headers={'Authorization': 'Bearer bob'}).status_code == 404
        assert client.post(f'/api/findings/{id}/context', json={'severity': 'High', 'business_impact': 'attack'}, headers={'Authorization': 'Bearer bob'}).status_code == 404
        assert client.get(f'/api/findings/{id}', headers={'Authorization': 'Bearer alice'}).status_code == 200
