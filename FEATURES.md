# VulnFlow Features

VulnFlow turns vulnerability reports into traceable claims, commit-specific evidence, and human-reviewed engineering actions. It does not scan for new vulnerabilities or determine exploitability automatically.

## MVP workflow

1. Submit up to three reports, a GitHub repository, and an exact commit SHA.
2. Decompose each report into claims, code references, affected components, and assumptions.
3. Check references against source fetched at that SHA.
4. Compare claims across reports and show explainable duplicate candidates.
5. Let a reviewer approve, reject, or request more evidence.
6. Export an investigation packet with evidence, gaps, related findings, and review decision.
7. For a later PR or commit, identify findings whose referenced code may need retesting.

## Features

### 1. Commit-locked claim evidence matrix — MVP

Show each claim with its original wording, extracted references, exact commit SHA, source excerpt, verification result, and missing evidence. Results are **Verified reference**, **Inconsistent reference**, or **Requires manual investigation**. A matching function or line proves only that the reference exists, not that it is exploitable.

### 2. AI-assisted report decomposition — MVP

Ask the LLM to return structured claims, files/functions/line references, components, and assumptions. Preserve the source report. Validate the response against a schema; treat report text and repository content as untrusted input.

### 3. Duplicate and finding correlation — MVP

Compare reports using shared files, functions, and code paths. Show the overlap that triggered a candidate match. Never merge findings automatically; retain distinct evidence and require reviewer confirmation.

### 4. Evidence-linked investigation packet — MVP

Export the original report, claims, source references, commit SHA, verification results, related reports, missing evidence, suggested investigation steps, and reviewer decision as Markdown or JSON.

### 5. Patch-to-finding impact map — signature demo

Compare a PR or later commit with stored findings. Show changed files/functions, matched findings, and which findings need retesting. A code change never marks a finding fixed automatically.

### 6. Temporal evidence diff — signature demo

Preserve evidence from the original commit and compare it with a later revision. Show which references still exist, changed, or need manual investigation, while retaining earlier evidence and decisions.

### Supporting: human review and lifecycle — MVP

Allow a reviewer to approve, reject, or request more evidence. Track New → Investigating → Validated → Resolved, reviewer notes, and severity separately from business impact. A review decision is explicit and traceable.

## Proposed architecture

- **React:** intake, claims matrix, correlation, review, impact map, and exports.
- **FastAPI:** API, report orchestration, LLM calls, deterministic source checks, correlation, packet generation, and PR impact analysis.
- **Supabase:** Postgres stores owner-scoped analysis records; Supabase Auth supplies reviewer sessions. FastAPI validates access tokens and uses a server-side database connection. Browser Data API access to the analysis table is revoked.
- **Firebase:** Hosting serves the React SPA with history-route rewrites and security headers. A Firebase project and public domain still need to be selected.
- **Prune:** FastAPI calls the OpenAI-compatible Chat Completions endpoint for structured claim extraction. The provider key stays server-side; receipts are stored with analysis metadata. No direct-provider fallback is enabled.
- **Maritime:** optional, isolated Python syntax check for a verified `.py` reference at its original SHA. It does not run repository tests or generated commands.
- **GitHub API:** read repository trees/files and commit/PR diffs at explicit refs.
- **Storage:** Supabase persists each analysis as an owner-scoped JSON aggregate, including repository, commit SHA, source evidence, reports, claims, relationships, review history, and impact history. Local demo mode uses SQLite and is not a live fallback.

Keep verification deterministic and separate from LLM output. Treat the LLM as an extractor, not as the authority on source truth or exploitability. Production deployment is not complete until a FastAPI host, Firebase project/domain, matching Supabase project, exact CORS origins, and runtime secrets are configured and exercised.

## Demo

Use one prepared repository/commit and three reports: one with a valid reference, one inconsistent reference, and one missing enough evidence to require review. Demonstrate the matrix, human decision, investigation packet, then a PR touching a referenced function and the retest flag.

## Out of scope

Full SAST/DAST, CVE database, exploitability detection, automatic finding closure, enterprise RBAC, and unapproved integrations.

See [PROJECT.md](PROJECT.md), [SECURITY_GUIDE.md](SECURITY_GUIDE.md), [INTEGRATIONS.md](INTEGRATIONS.md), and [AGENTS.md](AGENTS.md).
