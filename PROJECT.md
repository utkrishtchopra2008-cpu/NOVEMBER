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

This is a baseline for the hackathon, not a locked implementation decision.

- **Frontend:** React dashboard for intake, evidence matrix, review, impact map, and export.
- **Backend:** Python + FastAPI modular monolith.
- **Storage:** PostgreSQL for analyses, reports, claims, evidence, relationships, and review decisions.
- **GitHub client:** read repository content and PR/commit diffs by immutable SHA.
- **Claim extraction:** LLM returns schema-validated structured claims and explicit assumptions.
- **Verification:** deterministic checks against fetched source; never let the LLM determine whether a reference exists.
- **Correlation:** show explainable candidates; require human confirmation to merge.
- **Export:** generate Markdown/JSON from stored evidence and decisions.

Suggested backend modules: reports, GitHub, verification, correlation, review, and export. Keep one deployable application for the hackathon.

## Demo path

Use three prepared reports against one fixed commit: a valid code reference, an incorrect reference, and an incomplete claim requiring review. Show the matrix, a human decision, the exported packet, then a PR touching one referenced function and the retest flag.

## Out of scope

Full SAST/DAST, CVE database, automated exploitability detection, enterprise RBAC, and automatic finding closure.

## Decision rule

Treat this brief as the product source of truth. Ask the user when a needed product, stack, API, or behavior choice is unspecified; do not silently invent requirements. See [AGENTS.md](AGENTS.md) for implementation rules.
