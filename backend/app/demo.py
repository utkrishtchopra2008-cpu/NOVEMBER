import json
from fastapi import HTTPException
from .models import Intake, Report, Reference, ClaimInput

REPO = 'https://github.com/vulnflow-demo/auth-service'
BASE = 'a' * 40
HEAD = 'b' * 40
SOURCES = {
    'auth.py': 'def login(username, db):\n    query = "SELECT * FROM users WHERE name = " + username\n    return db.execute(query)\n',
    'admin.py': 'def delete_user(user_id, db):\n    return db.delete(user_id)\n',
    'worker.py': 'import pickle\n\ndef process_job(payload):\n    return pickle.loads(payload)\n',
}
PATCHED = {**SOURCES, 'auth.py': 'def login(username, db):\n    query = "SELECT * FROM users WHERE name = ?"\n    return db.execute(query, (username,))\n'}


def sample():
    reports = []
    for title, file, function, assertion in [
        ('SQL injection in auth.py', 'auth.py', 'login', 'User input is concatenated into a query.'),
        ('Missing authorization in admin.py', 'admin.py', 'delete_user', 'Deleting users may lack an authorization check.'),
        ('Insecure deserialization in worker.py', 'worker.py', 'process_job', 'A payload reaches pickle.loads.')]:
        claims = [ClaimInput(original_excerpt=assertion, assertion=assertion, component=file, reference=Reference(file_path=file, function_name=function))]
        if file == 'auth.py':
            claims.append(ClaimInput(original_excerpt='sanitize_input is missing.', assertion='Report references sanitize_input.', reference=Reference(file_path=file, function_name='sanitize_input')))
        if file == 'admin.py':
            claims.append(ClaimInput(original_excerpt='Authentication may rely on login.', assertion='The authentication path references login.', reference=Reference(file_path='auth.py', function_name='login')))
        if file == 'worker.py':
            claims.append(ClaimInput(original_excerpt='External users can reach this queue.', assertion='External users can reach this queue.', assumptions=['Queue permissions are unknown.']))
        reports.append(Report(title=title, format='json', content=json.dumps({'claims': [c.model_dump() for c in claims]})))
    return Intake(repo_url=REPO, commit_sha=BASE, reports=reports)


class DemoSource:
    async def resolve(self, repo, ref):
        if repo != REPO or ref not in (BASE, HEAD, 'HEAD', 'fix/auth-patch'):
            raise HTTPException(422, 'Demo mode accepts only the fixtures from GET /api/demo; use live mode for real repositories')
        return BASE if ref == BASE else HEAD

    async def source(self, repo, sha, path):
        await self.resolve(repo, sha)
        return (SOURCES if sha == BASE else PATCHED).get(path)

    async def target(self, repo, request):
        if request.pr_url or request.pr_number:
            if request.pr_number != 1 and request.pr_url != REPO + '/pull/1':
                raise HTTPException(422, 'Demo PR is 1')
            return HEAD
        return await self.resolve(repo, request.new_commit_sha)
