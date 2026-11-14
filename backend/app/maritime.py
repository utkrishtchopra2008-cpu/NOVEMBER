from urllib.parse import urlsplit
import base64
import re
from uuid import uuid4

from fastapi import HTTPException


class Maritime:
    def __init__(self, client, token):
        self.client, self.token = client, token

    async def check_python_syntax(self, analysis_id, source):
        if not self.token:
            raise HTTPException(503, 'Maritime is not configured')
        if len(source.encode()) > 64000:
            raise HTTPException(422, 'Sandbox syntax check supports source files up to 64 KB')

        sandbox_id = None
        headers = {'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'}
        try:
            created = await self.client.post('https://api.maritime.sh/api/sandboxes/ephemeral', headers={
                **headers, 'Idempotency-Key': f'vulnflow-{analysis_id}-{uuid4()}'}, json={
                    'name': f'vulnflow-{analysis_id[:8]}-{uuid4().hex[:8]}', 'from': 'python',
                    'size': 'small', 'idleMinutes': 1, 'timeLimitMinutes': 5, 'onIdle': 'kill',
                    'network': {'internet': {'mode': 'none'}},
                    'metadata': {'product': 'vulnflow', 'analysis_id': analysis_id},
                })
            if created.status_code not in (200, 201):
                raise HTTPException(502, 'Maritime could not create the isolated sandbox')
            box = created.json()
            sandbox_id = box.get('id')
            plane = box.get('dataPlaneUrl')
            secret = box.get('secret')
            parsed = urlsplit(plane or '')
            if not isinstance(sandbox_id, str) or not re.fullmatch(r'sbx-[A-Za-z0-9-]+', sandbox_id) or not isinstance(secret, str) or not secret or parsed.scheme != 'https' or not parsed.hostname or not parsed.hostname.endswith('.sb.mtm.sh') or parsed.username or parsed.password or parsed.query or parsed.fragment:
                raise HTTPException(502, 'Maritime returned an invalid sandbox configuration')

            encoded = base64.b64encode(source.encode()).decode()
            command = "python -c 'import ast,base64; ast.parse(base64.b64decode(\"" + encoded + "\").decode()); print(\"syntax-ok\")'"
            result = await self.client.post(plane.rstrip('/') + '/commands', headers={
                'X-Maritime-Token': secret, 'Content-Type': 'application/json'},
                json={'cmd': command}, timeout=60)
            if result.status_code != 200:
                raise HTTPException(502, 'Maritime syntax check failed to return a result')
            data = result.json()
            code = data.get('exitCode')
            if not isinstance(code, int):
                raise HTTPException(502, 'Maritime returned an invalid syntax-check result')
            return sandbox_id, code, 'Python syntax parsed in an isolated sandbox.' if code == 0 else 'Python syntax could not be parsed; inspect source at the pinned commit.'
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(502, 'Maritime is unavailable; no verification result was recorded')
        finally:
            if sandbox_id:
                try:
                    await self.client.delete(f'https://api.maritime.sh/api/sandboxes/ephemeral/{sandbox_id}', headers=headers)
                except Exception:
                    pass
