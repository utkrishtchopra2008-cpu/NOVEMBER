# Frontend/backend handoff — v1

The backend is FastAPI. `shared/openapi.json` is generated from its models; `shared/api-schema.d.ts` is generated from that schema. Use `shared/client.ts` in the frontend service layer (copy it together with api-schema.d.ts, or import both). Do not independently invent camelCase payloads or response envelopes.

## Connect

Set VITE_API_BASE_URL to the FastAPI origin, e.g. http://localhost:8000 (without /api). Create the client with `createApi(baseUrl, getAccessToken)`. In live mode getAccessToken returns the Supabase user's access token. Only the public Supabase configuration belongs in React; database, GitHub and Prune credentials stay on the API server.

Requests and responses use snake_case JSON. Success responses are direct objects/arrays, with no data wrapper. Errors are `{ "error": { "code": "...", "message": "...", "fields": [] } }`; fields exists for validation errors. Never silently replace live errors with demo findings.

## View mapping

| View | API |
|---|---|
| Intake | POST /api/intake → 201 Analysis containing findings, correlations, mode, id |
| Matrix | GET /api/findings/{id} → Finding |
| Queue | GET /api/findings → Finding[] |
| Correlation | GET /api/correlations?analysis_id=... → Correlation[] |
| Pair decision | POST /api/correlations/{id}/decision?analysis_id=... → Correlation |
| Review | POST /api/findings/{id}/review → Finding |
| Lifecycle | POST /api/findings/{id}/lifecycle → Finding |
| Packet preview/JSON | GET /api/findings/{id}/packet → Packet |
| Markdown download | GET /api/findings/{id}/packet.md → text/markdown |
| Impact/temporal diff | POST /api/impact-analysis → ImpactResult |
| Issue handoff | GET /api/findings/{id}/issue-draft → reviewable draft |
| Feature availability | GET /api/capabilities |

## Exact payloads and semantics

Intake: `{ "repo_url": "https://github.com/owner/repo", "commit_sha": "<40 hex characters>", "reports": [{ "title": "...", "content": "...", "format": "text" }] }`. Read .md/.txt/.json files as text in the browser, then submit JSON; multipart uploads are not accepted. Formats: markdown, text, json. One to three reports; each content <=100,000 characters; whole request <=350,000 bytes.

Structured JSON reports may contain `{ "claims": [{ "original_excerpt": "...", "assertion": "...", "reference": { "file_path": "auth.py", "function_name": "login", "start_line": 1, "end_line": 3 } }] }`. Reference fields may be null. Raw JSON not in this schema is sent to the LLM in live mode. Claim status is computed by the backend and cannot be supplied by a report.

Intake is synchronous and returns only when completed (up to 180 seconds). Show indeterminate progress, not fabricated per-stage percentages. Disable repeated submission while pending. There is no background-job polling endpoint in v1.

Claim badges use exactly `Verified reference`, `Inconsistent reference`, `Requires manual investigation` in verification_status. Code lines are `{number, text, kind}`; source_url is an immutable GitHub link in live mode and null for fictional demo fixtures. Escape snippet text in React. Do not interpret a verified reference as verified exploitability.

Review: `{ "decision": "APPROVED" | "REJECTED" | "MORE_EVIDENCE", "notes": "required" }`. Approval moves to Validated; rejection/more evidence moves to Investigating with the actual decision stored in reviews. Rejection does not mean resolved. Explicit lifecycle requests `{ "lifecycle": "Resolved", "notes": "retest evidence" }` can resolve only a Validated finding; impact never changes lifecycle. Review feedback is recorded, not automatically used for model training.

Correlation decision: `{ "decision": "CONFIRMED_DUPLICATE" | "KEPT_SEPARATE" }`. Confirmation links evidence; it does not delete/merge findings. A reviewed pair cannot be silently overwritten.

Impact: `{ "analysis_id": "...", "new_commit_sha": "HEAD" }` or exactly one of pr_url/pr_number in place of new_commit_sha. The latter field accepts a SHA, branch or tag, resolved once to a full SHA. PR URLs must belong to the same repository. Response fields include both pinned SHAs, changed_files, and per-claim impacts with original/current line arrays, unified diff, reason, flag, and finding_id. The v1 changed_files_scope is referenced_files, not a complete PR file inventory or call graph. Uncertain mappings are MANUAL_MAPPING_REQUIRED; changed code is RETEST_REQUIRED. Function comparison currently supports Python, including moved functions.

Packet contains finding, related_reports, markdown, warning. Use the finding's original report, claims, reviews, missing_evidence and investigation_steps for rendered preview. Escape HTML and disable raw HTML when rendering Markdown.

Issue publication is not configured. Use capabilities to label the button “Prepare issue draft”, then open github_url only after a user click (or copy body to Jira). No server-side Jira/GitHub ticket is silently created. Maritime execution remains optional and disabled: the reference checker never runs repository code.

## Offline demo

Start MODE=demo and GET /api/demo, then POST that exact response to /api/intake. These fixtures cover SQL injection in auth.py, missing check in admin.py, deserialization in worker.py, all three badges, one correlation, and a patch to login. Use HEAD, fix/auth-patch, or PR 1 for demo impact. The fake repository/SHAs are explicitly labeled demo and produce no external evidence links. Other repository inputs are rejected in demo mode. SQLite persists local demo state between restarts; it is never used as a live fallback.

## Regenerate

From repo root: `.venv/bin/python backend/export_contract.py`, then `npx --yes openapi-typescript@7.10.1 shared/openapi.json -o shared/api-schema.d.ts`. Re-run when Pydantic models change. The frontend should compile against the generated types. Contract tests are under backend/tests.
