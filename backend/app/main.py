import asyncio
import html
import json
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from itertools import combinations
from time import monotonic
from urllib.parse import urlencode

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from sqlalchemy.exc import SQLAlchemyError

from .config import Settings
from .demo import DemoSource, sample
from .extraction import extract
from .maritime import Maritime
from .models import (Analysis, ClaimInput, Correlation, CorrelationDecision, Finding,
    ImpactHistoryEntry, ImpactInput, ImpactResult, Intake, LifecycleInput, MaritimeJob, MaritimeJobInput,
    Packet, Review, ReviewInput, now)
from .source import GitHub, temporal, verify
from .store import Store


class BodyLimit:
    def __init__(self, app, limit):
        self.app, self.limit = app, limit

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        body = bytearray()
        while True:
            message = await receive()
            if message['type'] == 'http.disconnect':
                return
            body.extend(message.get('body', b''))
            if len(body) > self.limit:
                return await JSONResponse({'error': {'code': '413', 'message': 'Request exceeds size limit'}}, status_code=413)(scope, receive, send)
            if not message.get('more_body'):
                break
        delivered = False

        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {'type': 'http.request', 'body': bytes(body), 'more_body': False}
            return await receive()
        await self.app(scope, replay, send)


def correlate(findings):
    pairs = []
    for left, right in combinations(findings, 2):
        files = lambda f: {c.reference.file_path for c in f.claims if c.reference.file_path}
        shared = sorted(files(left) & files(right))
        funcs = lambda f: {(c.reference.file_path, c.reference.function_name) for c in f.claims if c.reference.file_path and c.reference.function_name}
        functions = sorted(f'{path}:{fn}' for path, fn in funcs(left) & funcs(right))
        if shared:
            pairs.append(Correlation(finding_ids=[left.id, right.id], shared_files=shared, shared_functions=functions,
                reasons=['Reports reference the same file(s).'] + (['Reports reference the same function(s).'] if functions else []) + ['Overlap is a candidate relationship, not proof of a duplicate.']))
    return pairs


def packet(finding, pairs):
    safe = lambda text: html.escape(text).replace('`', '\\`').replace('[', '\\[').replace(']', '\\]')
    content = [f'# Investigation: {safe(finding.report.title)}', f'Repository: {finding.repo_url}', f'Commit: {finding.commit_sha}',
        'Source-reference verification does not prove exploitability.', '## Original report', safe(finding.report.content), '## Claims']
    for claim in finding.claims:
        content += [f'### {safe(claim.assertion)}', f'Status: {claim.verification_status}', safe(claim.verification_reason),
            f'Reference: {safe(claim.reference.file_path or "Unspecified")}',
            '\n'.join(f'    {line.number}: {line.text}' for line in claim.snippet)]
    content += ['## Missing evidence', *[f'- {safe(x)}' for x in finding.missing_evidence], '## Investigation steps',
        *[f'- {safe(x)}' for x in finding.investigation_steps], '## Related reports',
        *[f'- {p.decision}: {", ".join(p.finding_ids)}' for p in pairs], '## Human decisions',
        *[f'- {r.created_at} / {r.decision}: {safe(r.notes)}' for r in finding.reviews]]
    return Packet(finding=finding, related_reports=pairs, markdown='\n\n'.join(content))


def create_app(settings=None, source=None):
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app):
        app.state.store = Store(settings.database_url, settings.mode == 'demo')
        async with httpx.AsyncClient(timeout=45, follow_redirects=False) as client:
            app.state.client = client
            app.state.source = source or (DemoSource() if settings.mode == 'demo' else GitHub(client, settings.github_token))
            app.state.maritime = Maritime(client, settings.maritime_token)
            yield
        app.state.store.engine.dispose()

    app = FastAPI(title='VulnFlow API', version='1.0.0', lifespan=lifespan)
    app.add_middleware(BodyLimit, limit=settings.max_body_bytes)
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=['GET', 'POST', 'OPTIONS'], allow_headers=['Authorization', 'Content-Type'], expose_headers=['Content-Disposition'])
    limiter = defaultdict(deque)
    slots = asyncio.Semaphore(2)

    @app.exception_handler(HTTPException)
    async def http_error(request, exc):
        return JSONResponse({'error': {'code': str(exc.status_code), 'message': str(exc.detail)}}, status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def invalid(request, exc):
        return JSONResponse({'error': {'code': 'VALIDATION_ERROR', 'message': 'Invalid request', 'fields': [{'path': list(e['loc']), 'message': e['msg']} for e in exc.errors()]}}, status_code=422)

    @app.exception_handler(httpx.HTTPError)
    async def upstream(request, exc):
        return JSONResponse({'error': {'code': 'UPSTREAM_UNAVAILABLE', 'message': 'External service timed out or is unavailable'}}, status_code=502)

    @app.exception_handler(SQLAlchemyError)
    async def storage_error(request, exc):
        return JSONResponse({'error': {'code': 'STORAGE_UNAVAILABLE', 'message': 'Storage unavailable; retry later'}}, status_code=503)

    async def owner(authorization: str | None = Header(default=None)):
        if settings.mode == 'demo':
            return 'local-demo'
        if not authorization or not authorization.startswith('Bearer '):
            raise HTTPException(401, 'Supabase access token required')
        response = await app.state.client.get(settings.supabase_url.rstrip('/') + '/auth/v1/user', headers={'apikey': settings.supabase_publishable_key, 'Authorization': authorization})
        if response.status_code in (401, 403):
            raise HTTPException(401, 'Invalid or expired access token')
        if response.status_code != 200:
            raise HTTPException(503, 'Authentication service unavailable')
        user = response.json().get('id')
        if not user:
            raise HTTPException(401, 'Invalid user identity')
        return user

    def throttle(user):
        timestamp = monotonic()
        for key in list(limiter):
            while limiter[key] and limiter[key][0] <= timestamp - 60:
                limiter[key].popleft()
            if not limiter[key]:
                del limiter[key]
        if len(limiter[user]) >= 6:
            raise HTTPException(429, 'Six analyses per minute allowed', headers={'Retry-After': '60'})
        limiter[user].append(timestamp)

    @app.get('/health')
    def health():
        return {'status': 'ok', 'mode': settings.mode, 'version': '1.0.0'}

    @app.get('/api/capabilities')
    def capabilities():
        return {'mode': settings.mode, 'github_issue_push': False, 'jira_issue_push': False, 'maritime_execution': bool(settings.maritime_token),
            'claim_extraction': 'prune' if settings.mode == 'live' else 'structured_json_or_manual', 'intake_response': 'synchronous'}

    @app.get('/api/demo', response_model=Intake)
    def demo():
        if settings.mode != 'demo':
            raise HTTPException(404, 'Demo fixtures disabled in live mode')
        return sample()

    @app.post('/api/intake', response_model=Analysis, status_code=201)
    async def intake(request: Intake, user=Depends(owner)):
        throttle(user)
        if slots.locked():
            raise HTTPException(429, 'Analysis capacity reached; retry shortly', headers={'Retry-After': '10'})
        async with slots:
            try:
                async with asyncio.timeout(180):
                    resolved = await app.state.source.resolve(request.repo_url, request.commit_sha.lower())
                    if resolved.lower() != request.commit_sha.lower():
                        raise HTTPException(422, 'Commit did not resolve to the requested SHA')
                    analysis = Analysis(mode=settings.mode)
                    cache = {}
                    for report in request.reports:
                        claims, meta = await extract(app.state.client, settings, report, request.repo_url, resolved, user, analysis.id)
                        verified = []
                        for claim in claims:
                            path = claim.reference.file_path
                            if path and path not in cache:
                                cache[path] = await app.state.source.source(request.repo_url, resolved, path)
                            checked = verify(claim, cache.get(path), request.repo_url, resolved)
                            if settings.mode == 'demo':
                                checked.source_url = None  # Fixtures are not real GitHub evidence links.
                            verified.append(checked)
                        missing = [c.verification_reason for c in verified if c.verification_status != 'Verified reference']
                        missing += [a for c in claims for a in c.assumptions]
                        missing.append('Exploitability and business impact require human evidence.')
                        analysis.findings.append(Finding(analysis_id=analysis.id, repo_url=request.repo_url, commit_sha=resolved, report=report, claims=verified,
                            missing_evidence=list(dict.fromkeys(missing)), extraction_metadata=meta))
                    analysis.correlations = correlate(analysis.findings)
                    app.state.store.create(user, analysis)
                    return analysis
            except TimeoutError:
                raise HTTPException(504, 'Analysis timed out; no partial results were saved')

    @app.get('/api/findings', response_model=list[Finding])
    def findings(user=Depends(owner)):
        return [f for a, _ in app.state.store.all(user) for f in a.findings]

    @app.get('/api/findings/{id}', response_model=Finding)
    def finding(id: str, user=Depends(owner)):
        return app.state.store.finding(user, id)[2]

    @app.post('/api/findings/{id}/review', response_model=Finding)
    def review(id: str, body: ReviewInput, user=Depends(owner)):
        analysis, version, finding = app.state.store.finding(user, id)
        finding.reviews.append(Review(**body.model_dump(), reviewer_id=user))
        finding.lifecycle = 'Validated' if body.decision == 'APPROVED' else 'Investigating'
        app.state.store.save(user, analysis, version)
        return finding

    @app.post('/api/findings/{id}/lifecycle', response_model=Finding)
    def lifecycle(id: str, body: LifecycleInput, user=Depends(owner)):
        analysis, version, finding = app.state.store.finding(user, id)
        transitions = {'New': {'Investigating'}, 'Investigating': set(), 'Validated': {'Investigating', 'Resolved'}, 'Resolved': {'Investigating'}}
        if body.lifecycle not in transitions[finding.lifecycle]:
            raise HTTPException(409, 'Invalid transition; validation requires an APPROVED review')
        finding.lifecycle = body.lifecycle
        finding.extraction_metadata.setdefault('lifecycle_history', []).append({'status': body.lifecycle, 'notes': body.notes, 'reviewer_id': user, 'created_at': now()})
        app.state.store.save(user, analysis, version)
        return finding

    @app.get('/api/correlations', response_model=list[Correlation])
    def correlations(analysis_id: str, user=Depends(owner)):
        return app.state.store.get(user, analysis_id)[0].correlations

    @app.post('/api/correlations/{id}/decision', response_model=Correlation)
    def decide(id: str, body: CorrelationDecision, analysis_id: str, user=Depends(owner)):
        analysis, version = app.state.store.get(user, analysis_id)
        pair = next((p for p in analysis.correlations if p.id == id), None)
        if pair is None:
            raise HTTPException(404, 'Correlation not found')
        if pair.decision != 'PENDING':
            raise HTTPException(409, 'This pair has already been reviewed')
        pair.decision, pair.decided_at, pair.reviewer_id = body.decision, now(), user
        app.state.store.save(user, analysis, version)
        return pair

    @app.get('/api/findings/{id}/packet', response_model=Packet)
    def get_packet(id: str, user=Depends(owner)):
        analysis, _, finding = app.state.store.finding(user, id)
        return packet(finding, [p for p in analysis.correlations if id in p.finding_ids])

    @app.get('/api/findings/{id}/packet.md')
    def markdown(id: str, user=Depends(owner)):
        data = get_packet(id, user)
        return Response(data.markdown, media_type='text/markdown', headers={'Content-Disposition': f'attachment; filename="finding-{data.finding.id}.md"'})

    @app.get('/api/findings/{id}/issue-draft')
    def issue_draft(id: str, user=Depends(owner)):
        data = get_packet(id, user)
        url = data.finding.repo_url + '/issues/new?' + urlencode({'title': data.finding.report.title, 'body': data.markdown})
        return {'title': data.finding.report.title, 'body': data.markdown,
            'github_url': url if settings.mode == 'live' and len(url) < 8000 else None,
            'published': False, 'message': 'Review and submit in GitHub, or copy this draft into Jira. No issue was created.'}

    @app.post('/api/findings/{id}/sandbox-check', response_model=MaritimeJob, status_code=201)
    async def sandbox_check(id: str, body: MaritimeJobInput, user=Depends(owner)):
        if not settings.maritime_token:
            raise HTTPException(503, 'Maritime sandbox checks are not configured')
        throttle(user)
        if slots.locked():
            raise HTTPException(429, 'Analysis capacity reached; retry shortly', headers={'Retry-After': '10'})
        async with slots:
            try:
                async with asyncio.timeout(75):
                    analysis, version, finding = app.state.store.finding(user, id)
                    claim = next((item for item in finding.claims if item.id == body.claim_id), None)
                    if claim is None:
                        raise HTTPException(404, 'Claim not found')
                    path = claim.reference.file_path
                    if claim.verification_status != 'Verified reference' or not path or not path.endswith('.py'):
                        raise HTTPException(409, 'Sandbox syntax checks require a verified Python file reference')
                    source = await app.state.source.source(finding.repo_url, finding.commit_sha, path)
                    if source is None:
                        raise HTTPException(409, 'Referenced file is unavailable at the finding commit')
                    sandbox_id, exit_code, message = await app.state.maritime.check_python_syntax(analysis.id, source)
                    result = MaritimeJob(finding_id=id, claim_id=claim.id, file_path=path, commit_sha=finding.commit_sha,
                        sandbox_id=sandbox_id, status='PASSED' if exit_code == 0 else 'FAILED', exit_code=exit_code, message=message)
                    finding.verification_jobs.append(result)
                    app.state.store.save(user, analysis, version)
                    return result
            except TimeoutError:
                raise HTTPException(504, 'Maritime syntax check timed out; finding state is unchanged')

    async def compute_impact(body, user):
        analysis, version = app.state.store.get(user, body.analysis_id)
        first = analysis.findings[0]
        sha = await app.state.source.target(first.repo_url, body)
        cache, changed, impacts = {}, set(), []
        for finding in analysis.findings:
            for claim in finding.claims:
                path = claim.reference.file_path
                if not path:
                    continue
                if path not in cache:
                    old = await app.state.source.source(first.repo_url, first.commit_sha, path)
                    new = await app.state.source.source(first.repo_url, sha, path)
                    cache[path] = old, new
                old, new = cache[path]
                if old != new:
                    changed.add(path)
                impacts.append(temporal(claim, old, new, first.repo_url, sha, finding.id))
        result = ImpactResult(analysis_id=analysis.id, original_commit_sha=first.commit_sha, current_commit_sha=sha, changed_files=sorted(changed), impacts=impacts)
        analysis.impact_history.append(ImpactHistoryEntry(result=result))
        app.state.store.save(user, analysis, version)
        return result

    @app.get('/api/analyses/{analysis_id}/impact-history', response_model=list[ImpactHistoryEntry])
    def impact_history(analysis_id: str, user=Depends(owner)):
        analysis, _ = app.state.store.get(user, analysis_id)
        return analysis.impact_history

    @app.post('/api/impact-analysis', response_model=ImpactResult)
    async def impact(body: ImpactInput, user=Depends(owner)):
        throttle(user)
        if slots.locked():
            raise HTTPException(429, 'Analysis capacity reached; retry shortly', headers={'Retry-After': '10'})
        async with slots:
            try:
                async with asyncio.timeout(180):
                    return await compute_impact(body, user)
            except TimeoutError:
                raise HTTPException(504, 'Impact analysis timed out; finding state is unchanged')

    return app


app = create_app()
