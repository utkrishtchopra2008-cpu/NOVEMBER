import json
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.demo import BASE, HEAD, SOURCES, sample
from app.main import create_app
from app.models import ClaimInput, Reference
from app.source import verify, temporal
from fastapi import HTTPException


@pytest.fixture
def client(tmp_path):
    settings = Settings(_env_file=None, database_url=f'sqlite:///{tmp_path}/demo.db')
    with TestClient(create_app(settings)) as test:
        yield test


def intake(client):
    response = client.post('/api/intake', json=client.get('/api/demo').json())
    assert response.status_code == 201, response.text
    return response.json()


def test_complete_frontend_journey(client):
    analysis = intake(client)
    assert len(analysis['findings']) == 3
    statuses = {c['verification_status'] for f in analysis['findings'] for c in f['claims']}
    assert statuses == {'Verified reference', 'Inconsistent reference', 'Requires manual investigation'}
    assert all(c['source_url'] is None for f in analysis['findings'] for c in f['claims'])
    finding = analysis['findings'][0]
    id = finding['id']
    assert client.get('/api/findings').json()[0]['id'] == id
    assert client.get('/api/findings/' + id).json()['commit_sha'] == BASE
    response = client.post(f'/api/findings/{id}/review', json={'decision': 'APPROVED', 'notes': 'Reviewer reproduced against authorized fixture.'})
    assert response.status_code == 200
    assert response.json()['lifecycle'] == 'Validated'
    assert len(response.json()['reviews']) == 1
    pairs = client.get('/api/correlations', params={'analysis_id': analysis['id']}).json()
    assert len(pairs) == 1
    decision = client.post('/api/correlations/' + pairs[0]['id'] + '/decision', params={'analysis_id': analysis['id']}, json={'decision': 'KEPT_SEPARATE'})
    assert decision.status_code == 200
    packet = client.get(f'/api/findings/{id}/packet').json()
    assert packet['related_reports'][0]['decision'] == 'KEPT_SEPARATE'
    assert len(packet['finding']['reviews']) == 1
    assert 'APPROVED' in packet['markdown']
    download = client.get(f'/api/findings/{id}/packet.md')
    assert download.status_code == 200 and 'attachment;' in download.headers['content-disposition']
    impact = client.post('/api/impact-analysis', json={'analysis_id': analysis['id'], 'new_commit_sha': 'HEAD'})
    assert impact.status_code == 200, impact.text
    assert impact.json()['current_commit_sha'] == HEAD
    assert impact.json()['changed_files'] == ['auth.py']
    assert any(x['flag'] == 'RETEST_REQUIRED' for x in impact.json()['impacts'])
    history = client.get(f"/api/analyses/{analysis['id']}/impact-history")
    assert history.status_code == 200 and len(history.json()) == 1
    assert history.json()[0]['result']['current_commit_sha'] == HEAD
    assert client.get('/api/findings/' + id).json()['lifecycle'] == 'Validated'
    assert client.get(f'/api/findings/{id}/issue-draft').json()['published'] is False


@pytest.mark.parametrize('change', [
    {'repo_url': 'https://github.com.evil.com/x/y'},
    {'repo_url': 'http://127.0.0.1/private'},
    {'repo_url': 'https://github.com/x/y?token=secret'},
    {'commit_sha': 'main'}, {'reports': []},
    {'reports': [r.model_dump() for r in sample().reports] * 2},
])
def test_bad_intake(client, change):
    data = sample().model_dump()
    data.update(change)
    response = client.post('/api/intake', json=data)
    assert response.status_code == 422
    assert 'error' in response.json()


def test_no_live_claims_fabricated_in_demo(client):
    data = sample().model_dump()
    data['repo_url'] = 'https://github.com/some/real-repo'
    assert client.post('/api/intake', json=data).status_code == 422


def test_path_traversal_and_invalid_lines():
    for path in ('../token', '/etc/passwd', 'src/../token', 'src\\token'):
        with pytest.raises(ValidationError):
            Reference(file_path=path)
    with pytest.raises(ValidationError):
        Reference(file_path='auth.py', start_line=5, end_line=2)


def test_reference_verification_and_temporal_movement():
    base = ClaimInput(original_excerpt='login exists', assertion='login exists', reference=Reference(file_path='auth.py', function_name='login'))
    claim = verify(base, SOURCES['auth.py'], 'https://github.com/a/b', BASE)
    assert claim.verification_status == 'Verified reference'
    moved = '\n\n' + SOURCES['auth.py']
    result = temporal(claim, SOURCES['auth.py'], moved, 'https://github.com/a/b', HEAD, 'finding')
    assert result.flag == 'NO_REFERENCE_CHANGE'
    assert result.current[0].number == 3
    wrong = base.model_copy(update={'reference': Reference(file_path='auth.py', function_name='login', start_line=999)})
    assert verify(wrong, SOURCES['auth.py'], 'https://github.com/a/b', BASE).verification_status == 'Inconsistent reference'
    duplicate = SOURCES['auth.py'] + '\ndef login():\n    pass\n'
    assert verify(base, duplicate, 'https://github.com/a/b', BASE).verification_status == 'Requires manual investigation'


def test_empty_file_reference_without_line_claim_is_consistent():
    claim = ClaimInput(original_excerpt='Empty file referenced', assertion='File exists', reference=Reference(file_path='empty.py'))
    result = verify(claim, '', 'https://github.com/a/b', BASE)
    assert result.verification_status == 'Verified reference'
    assert result.verification_reason == 'Referenced file exists at this commit.'
    assert result.snippet == []
    assert result.source_url == f'https://github.com/a/b/blob/{BASE}/empty.py'


def test_unverified_baseline_change_requires_manual_mapping():
    base = ClaimInput(original_excerpt='bad line reference', assertion='login exists', reference=Reference(file_path='auth.py', function_name='login', start_line=999))
    claim = verify(base, SOURCES['auth.py'], 'https://github.com/a/b', BASE)
    assert claim.verification_status == 'Inconsistent reference'
    changed = SOURCES['auth.py'].replace('return db.execute(query)', 'return None')
    result = temporal(claim, SOURCES['auth.py'], changed, 'https://github.com/a/b', HEAD, 'finding')
    assert result.flag == 'MANUAL_MAPPING_REQUIRED'


def test_ownership_and_stale_update(client):
    data = intake(client)
    store = client.app.state.store
    assert store.all('another-user') == []
    with pytest.raises(HTTPException) as exc:
        store.finding('another-user', data['findings'][0]['id'])
    assert exc.value.status_code == 404
    a, version = store.get('local-demo', data['id'])
    store.save('local-demo', a, version)
    with pytest.raises(HTTPException) as exc:
        store.save('local-demo', a, version)
    assert exc.value.status_code == 409


def test_finding_context_is_editable_and_persisted(client):
    analysis = intake(client)
    finding_id = analysis['findings'][0]['id']
    payload = {'severity': 'High', 'business_impact': 'Could expose account data to another user.'}
    response = client.post(f'/api/findings/{finding_id}/context', json=payload)
    assert response.status_code == 200
    assert response.json()['severity'] == payload['severity']
    assert response.json()['business_impact'] == payload['business_impact']
    assert client.get(f'/api/findings/{finding_id}').json()['severity'] == 'High'
    assert client.post(f'/api/findings/{finding_id}/context', json={'severity': 'High', 'business_impact': '   '}).status_code == 422


def test_limits_cors_and_review_validation(client):
    response = client.post('/api/intake', content=b'x' * 350001)
    assert response.status_code == 413
    response = client.options('/api/intake', headers={'Origin': 'http://localhost:5173', 'Access-Control-Request-Method': 'POST'})
    assert response.headers['access-control-allow-origin'] == 'http://localhost:5173'
    response = client.options('/api/intake', headers={'Origin': 'https://evil.example', 'Access-Control-Request-Method': 'POST'})
    assert response.status_code == 400
    data = intake(client)
    id = data['findings'][0]['id']
    assert client.post(f'/api/findings/{id}/review', json={'decision': 'FIXED', 'notes': 'no'}).status_code == 422
    assert client.post(f'/api/findings/{id}/lifecycle', json={'lifecycle': 'Resolved', 'notes': 'code changed'}).status_code == 409
    assert client.post('/api/impact-analysis', json={'analysis_id': data['id'], 'new_commit_sha': HEAD, 'pr_number': 1}).status_code == 422


def test_live_configuration_fails_closed():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, mode='live')


def test_persistence_after_restart(tmp_path):
    settings = Settings(_env_file=None, database_url=f'sqlite:///{tmp_path}/persistent.db')
    with TestClient(create_app(settings)) as client:
        data = intake(client)
        assert client.post('/api/impact-analysis', json={'analysis_id': data['id'], 'new_commit_sha': 'HEAD'}).status_code == 200
    with TestClient(create_app(settings)) as client:
        assert client.get('/api/findings/' + data['findings'][0]['id']).status_code == 200
        history = client.get(f"/api/analyses/{data['id']}/impact-history")
        assert history.status_code == 200 and len(history.json()) == 1


def test_maritime_syntax_job_is_owner_scoped_and_persisted(tmp_path):
    settings = Settings(_env_file=None, database_url=f'sqlite:///{tmp_path}/maritime.db', maritime_token='fake')
    with TestClient(create_app(settings)) as client:
        analysis = intake(client)
        finding = analysis['findings'][0]
        claim = next(c for c in finding['claims'] if c['verification_status'] == 'Verified reference')
        async def fake_sandbox(analysis_id, source):
            assert analysis_id == analysis['id'] and 'def login' in source
            return 'sbx-test', 0, 'Python syntax parsed in an isolated sandbox.'
        client.app.state.maritime.check_python_syntax = fake_sandbox
        response = client.post(f"/api/findings/{finding['id']}/sandbox-check", json={'claim_id': claim['id']})
        assert response.status_code == 201, response.text
        assert response.json()['status'] == 'PASSED'
        saved = client.get('/api/findings/' + finding['id']).json()
        assert saved['verification_jobs'][0]['sandbox_id'] == 'sbx-test'
        assert saved['verification_jobs'][0]['commit_sha'] == BASE
