# VulnFlow Project Brief

## Product

VulnFlow helps security teams verify, trace, and triage existing vulnerability reports. It is an evidence and investigation workflow, not a vulnerability scanner or exploitability detector.

## 24-hour MVP

Input: one GitHub repository, an exact commit SHA, and up to three vulnerability reports.

1. Accept reports, repository URL, and commit SHA.
2. Use an LLM to decompose each report into atomic claims, affected components, code references, and assumptions. Preserve the original report.
3. Fetch referenced source at the exact SHA; deterministically check file, line-range, and supported function references.
4. Show a claim evidence matrix: **Verified reference**, **Inconsistent reference**, or **Requires manual investigation**.
5. Correlate candidate duplicates using shared files, functions, or code paths; explain overlap and leave grouping to a human.
6. Let a reviewer approve, reject, or request more evidence.
7. Export an evidence-linked investigation packet as Markdown or JSON.

A valid source reference is not proof of exploitability. A code change is not proof that a finding is fixed.

## Signature follow-up

- **Patch-to-finding impact map:** compare a PR or later commit with findings; flag touched files/functions for retesting.
- **Temporal evidence diff:** preserve original evidence and compare references with a later revision.

Never auto-resolve a finding because its code changed.

## Supporting capabilities

Finding lifecycle (New → Investigating → Validated → Resolved), severity separate from business impact, reviewer notes, related-report links, and export.

## Proposed MVP architecture

- **Frontend:** React dashboard deployed as a static single-page app on Firebase Hosting.
- **API/backend:** Python + FastAPI for intake, LLM/GitHub orchestration, deterministic checks, correlation, review actions, and packet generation.
- **Data platform:** Supabase is part of the planned backend. The exact split between FastAPI, Supabase Postgres, and any Supabase Auth/Storage/Edge Functions must be confirmed before implementation.
- **GitHub client:** read repository content and PR/commit diffs by immutable SHA; keep credentials server-side.
- **Claim extraction:** LLM returns schema-validated structured claims and explicit assumptions.
- **Verification:** deterministic checks against fetched source; never let the LLM determine whether a reference exists.
- **Correlation:** show explainable candidates; require human confirmation to merge.
- **Export:** generate Markdown/JSON from stored evidence and decisions.
- **Optional integrations:** Prune can proxy FastAPI's LLM calls; Maritime can run isolated verification jobs when execution is needed. See [INTEGRATIONS.md](INTEGRATIONS.md).

FastAPI's deployment runtime is not selected. Firebase Hosting serves the React app; route API requests to a separate FastAPI host only after that host is chosen. Keep one deployable API application for the hackathon.

## Demo path

Use three prepared reports against one fixed commit: a valid code reference, an incorrect reference, and an incomplete claim requiring review. Show the matrix, a human decision, the exported packet, then a PR touching one referenced function and the retest flag.

## Out of scope

Full SAST/DAST, CVE database, automated exploitability detection, enterprise RBAC, and automatic finding closure.

## Implementation documents

- [Feature workflows](FEATURES.md)
- [Security implementation guide](SECURITY_GUIDE.md)
- [Integration contracts](INTEGRATIONS.md)
- [Working rules](AGENTS.md)

## Decision rule

Treat this brief as the product source of truth. Ask the user when a needed product, stack, API, deployment target, or behavior choice is unspecified; do not silently invent requirements.
