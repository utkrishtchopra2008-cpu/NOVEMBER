# VulnFlow Security Guide

Use this as an implementation checklist, not a claim that VulnFlow is secure. Apply controls to the actual code and review them before deployment. The categories follow the OWASP Top 10:2025 and add VulnFlow-specific risks.

## Risks and controls

| Risk | Implementation guardrail |
|---|---|
| Broken access control / IDOR | Authorize every analysis, report, claim, evidence item, export, and review action on the server. Scope database access to the authenticated user/team. If Supabase tables are exposed, enable and verify Row Level Security policies for every table; do not rely on hidden UI controls. |
| Authentication failures | Use a maintained auth flow, secure session handling, and server-side role checks. Rate-limit login, report submission, and expensive LLM/GitHub operations. |
| Secret or cryptographic failures | Keep LLM credentials, GitHub tokens, Supabase secret keys, and database credentials in server-side secrets. Never commit them or expose them in React bundles, logs, or error responses. Use only browser-safe Supabase publishable keys in the client and pair them with RLS. |
| Injection (SQL, command, HTML/Markdown) | Use parameterized database queries; avoid shell execution from user input; escape untrusted text in the UI and exported HTML/Markdown. Validate and constrain every parsed field. |
| Prompt injection and unsafe LLM output | Treat reports, repository files, and code comments as untrusted data, not instructions. Do not let them choose tools, URLs, permissions, or database actions. Validate model output against a schema and require human review for decisions. |
| SSRF and unsafe URL fetching | Accept only the intended GitHub repository URL format and validate owner/repository/ref separately. Do not fetch arbitrary URLs found in reports or repository content. Restrict redirects and outbound destinations for server-side requests. |
| Security misconfiguration / CORS | Allow only intended frontend origins. Review Firebase Hosting rewrites, response headers, secrets, debug settings, and public storage rules. Return production-safe errors. |
| Software supply-chain failures | Keep dependency manifests and lockfiles reviewed; use maintained packages, minimize dependencies, and avoid running untrusted repository code during analysis. |
| Data or software integrity failures | Bind evidence to the exact repository and commit SHA. Keep original reports and evidence immutable in history; record reviewer decisions. Never mark a finding fixed solely because code changed. |
| Logging and alerting failures | Log security-relevant events and failures without tokens, credentials, full sensitive reports, or private source excerpts. Sanitize untrusted values to prevent log injection. |
| Mishandled exceptions | Handle invalid SHAs, missing files, API errors, malformed reports, timeouts, and model failures explicitly. Fail closed for authorization and secret access; avoid leaking stack traces. |
| Unsafe uploads and resource exhaustion | Accept only documented report formats, enforce file and request size limits, timeouts, and rate limits, and reject malformed or oversized inputs before parsing. |

## Stack-specific checks

- **Supabase:** enable RLS on exposed tables and test policies for both allowed and denied access. Never place secret/service keys in frontend code; those keys bypass RLS. Keep privileged operations server-side.
- **FastAPI:** validate request bodies and path parameters, authenticate and authorize every protected endpoint, set restrictive CORS, and avoid returning raw exception details.
- **GitHub access:** request the minimum permissions needed, prefer read-only access, keep tokens server-side, and bind every source lookup to the requested commit SHA.
- **Firebase Hosting:** deploy only the intended frontend build. Check SPA rewrites and headers; do not assume hosting rules protect Supabase or FastAPI endpoints.

## Review before release

Confirm access controls, RLS policies, secret handling, URL validation, upload limits, CORS, error responses, and dependency versions. Do not describe a control as verified until it has been checked in the implementation.

## References

- [OWASP Top 10:2025](https://owasp.org/projects/top-ten)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase secrets for Edge Functions](https://supabase.com/docs/guides/functions/secrets)
- [Firebase Hosting configuration](https://firebase.google.com/docs/hosting/full-config)

See [FEATURES.md](FEATURES.md), [PROJECT.md](PROJECT.md), and [AGENTS.md](AGENTS.md).
