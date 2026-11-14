import ast
import base64
import difflib
import re
from urllib.parse import quote
from fastapi import HTTPException
from .models import Claim, CodeLine, Reference, ImpactItem

VERIFIED = 'Verified reference'
INCONSISTENT = 'Inconsistent reference'
MANUAL = 'Requires manual investigation'


class GitHub:
    def __init__(self, client, token):
        self.client = client
        self.headers = {'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}
        if token:
            self.headers['Authorization'] = 'Bearer ' + token

    async def get(self, repo, path, missing=False):
        response = await self.client.get('https://api.github.com/repos/' + repo.removeprefix('https://github.com/') + '/' + path, headers=self.headers)
        if response.status_code == 404 and missing:
            return None
        if response.status_code != 200:
            raise HTTPException(502, 'GitHub source unavailable or access/rate limit denied; verification incomplete')
        try:
            return response.json()
        except ValueError:
            raise HTTPException(502, 'GitHub returned invalid JSON')

    async def resolve(self, repo, ref):
        data = await self.get(repo, 'commits/' + quote(ref, safe=''))
        sha = data.get('sha') if isinstance(data, dict) else None
        if not isinstance(sha, str) or not re.fullmatch('[0-9a-fA-F]{40}', sha):
            raise HTTPException(502, 'GitHub did not return a valid commit SHA')
        return sha.lower()

    async def source(self, repo, sha, path):
        data = await self.get(repo, 'contents/' + quote(path, safe='/') + '?ref=' + quote(sha, safe=''), missing=True)
        if data is None:
            return None
        if not isinstance(data, dict) or data.get('type') != 'file' or data.get('encoding') != 'base64' or data.get('size', 0) > 250000:
            raise HTTPException(422, 'Referenced source is not a supported text file (maximum 250 KB)')
        try:
            return base64.b64decode(data['content']).decode('utf-8')
        except (ValueError, UnicodeError):
            raise HTTPException(422, 'Referenced source is not UTF-8 text')

    async def target(self, repo, request):
        number = request.pr_number
        if request.pr_url:
            match = re.fullmatch(re.escape(repo) + r'/pull/([1-9][0-9]*)/?', request.pr_url)
            if not match:
                raise HTTPException(422, 'PR URL must belong to the analysis repository')
            number = int(match[1])
        if number:
            data = await self.get(repo, f'pulls/{number}')
            sha = data.get('head', {}).get('sha') if isinstance(data, dict) else None
            if not isinstance(sha, str) or not re.fullmatch('[0-9a-fA-F]{40}', sha):
                raise HTTPException(502, 'GitHub did not return a valid PR head SHA')
            return sha.lower()
        return await self.resolve(repo, request.new_commit_sha)


def verify(claim, text, repo, sha):
    ref = claim.reference
    status, reason, snippet, source_url = MANUAL, 'A precise file reference is required.', [], None
    if ref.file_path:
        source_url = repo + '/blob/' + sha + '/' + quote(ref.file_path, safe='/')
        if text is None:
            status, reason = INCONSISTENT, 'Referenced file does not exist at this commit.'
            source_url = None
        else:
            lines = text.splitlines()
            start, end = ref.start_line or 1, ref.end_line or ref.start_line or min(len(lines), 15)
            status, reason = VERIFIED, 'Referenced file and supplied line range exist at this commit.' if ref.start_line is not None or ref.end_line is not None else 'Referenced file exists at this commit.'
            if (ref.start_line is not None or ref.end_line is not None) and (start > len(lines) or end > len(lines)):
                status, reason = INCONSISTENT, 'Referenced line range is outside this file.'
            if ref.function_name and status == VERIFIED:
                if not ref.file_path.endswith('.py'):
                    status, reason = MANUAL, 'Function verification currently supports Python only.'
                else:
                    try:
                        tree = ast.parse(text)
                        matches = [node for node in ast.walk(tree) if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == ref.function_name]
                        if not matches:
                            status, reason = INCONSISTENT, 'Referenced function is absent from the Python syntax tree.'
                        elif len(matches) > 1:
                            status, reason = MANUAL, 'Multiple functions have this name; qualify the reference.'
                        else:
                            node = matches[0]
                            if ref.start_line and not (node.lineno <= start <= end <= node.end_lineno):
                                status, reason = INCONSISTENT, 'Referenced lines do not belong to the specified function.'
                            else:
                                start, end = ref.start_line or node.lineno, ref.end_line or ref.start_line or node.end_lineno
                                reason = 'File, Python function and supplied line range exist at this commit.'
                    except (SyntaxError, RecursionError):
                        status, reason = MANUAL, 'Python source could not be parsed; manual inspection required.'
            if status != INCONSISTENT:
                if end >= start:
                    snippet = [CodeLine(number=i + 1, text=line) for i, line in enumerate(lines) if start <= i + 1 <= min(end, start + 79)]
                if snippet:
                    source_url += f'#L{start}-L{min(end, start + 79)}'
    return Claim(**claim.model_dump(), verification_status=status, verification_reason=reason, snippet=snippet, source_url=source_url)


def temporal(claim, old, new, repo, sha, finding_id):
    # Do not carry old line numbers into a new revision: functions can move.
    from .models import ClaimInput
    ref = claim.reference.model_copy(update={'start_line': None, 'end_line': None}) if claim.reference.function_name else claim.reference
    current = verify(ClaimInput(original_excerpt=claim.original_excerpt, assertion=claim.assertion, component=claim.component, reference=ref), new, repo, sha)
    old_lines = [x.text for x in claim.snippet]
    new_lines = [x.text for x in current.snippet]
    if old is None and new is None:
        flag, reason = 'MANUAL_MAPPING_REQUIRED', 'Reference is missing at both revisions; reviewer must locate the code.'
    elif old == new:
        flag, reason = 'NO_REFERENCE_CHANGE', 'Referenced file is unchanged; no fix is inferred.'
    elif claim.verification_status != VERIFIED:
        flag, reason = 'MANUAL_MAPPING_REQUIRED', 'Original reference was not verified at the baseline commit; a reviewer must establish the mapping before retesting.'
    elif claim.reference.function_name and current.verification_status == VERIFIED and claim.verification_status == VERIFIED:
        # Compare complete function bodies, not truncated display snippets.
        def body(source):
            node = next(n for n in ast.walk(ast.parse(source)) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == claim.reference.function_name)
            return source.splitlines()[node.lineno - 1:node.end_lineno]
        if body(old) == body(new):
            flag, reason = 'NO_REFERENCE_CHANGE', 'File changed, but the referenced function body is unchanged.'
        else:
            flag, reason = 'RETEST_REQUIRED', 'Referenced function changed; reviewer must retest.'
    elif current.verification_status == INCONSISTENT:
        flag, reason = 'RETEST_REQUIRED', 'Referenced file or function was removed or renamed; retest required.'
    else:
        flag, reason = 'MANUAL_MAPPING_REQUIRED', 'File changed and the reference cannot be mapped confidently.'
    return ImpactItem(finding_id=finding_id, claim_id=claim.id, file_path=ref.file_path, flag=flag, reason=reason,
        original=claim.snippet, current=current.snippet, current_verification_status=current.verification_status,
        diff='\n'.join(difflib.unified_diff(old_lines, new_lines, fromfile='original', tofile='current', lineterm='')))
