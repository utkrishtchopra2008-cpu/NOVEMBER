# VulnFlow Integrations

This document defines the integration boundaries for Prune and Maritime. Both credentials are read only by FastAPI from environment variables; never commit their values or expose them to React.

## Roles

| Service | VulnFlow responsibility |
|---|---|
| FastAPI | Owns API routes, orchestration, authorization, GitHub access, deterministic checks, and exports |
| Supabase | Stores analyses, reports, claims, evidence, relationships, reviews, and integration metadata |
| Prune | Proxies FastAPI's supported LLM calls and returns optimization, security, cost, and receipt metadata |
| Maritime | Optionally runs isolated verification jobs that may execute repository tests or generated checks |
| Firebase Hosting | Serves the React single-page frontend |

The browser must never call Prune or Maritime directly. Their credentials remain server-side.

## Request flow

1. React submits an analysis to FastAPI.
2. FastAPI validates the repository URL, commit SHA, report size, and authenticated user.
3. FastAPI fetches source content from GitHub at the requested immutable SHA.
4. FastAPI sends report text and selected source context to Prune for structured claim extraction.
5. FastAPI stores claims and Prune metadata in Supabase.
6. Deterministic verification runs inside FastAPI for file, line, and supported function references.
7. A reviewer may request a syntax-only recheck for a verified Python reference; FastAPI sends that one pinned source file to a disposable Maritime sandbox with internet disabled.
8. FastAPI stores the result, shows the evidence matrix, and creates the investigation packet.

A reference match does not prove exploitability. A changed file does not prove remediation.

## Prune integration

### Client

Create the LLM client only in FastAPI:

```python
from openai import OpenAI
import os

client = OpenAI(
    base_url="https://api.withprune.com/v1",
    api_key=os.environ["PRUNE_API_KEY"],
)
```

Keep existing prompts, model names, and call sites stable while changing only client configuration. Use supported Chat Completions or structured outputs for claim extraction. Do not use the OpenAI Responses API through Prune until support is confirmed.

### Request metadata

When the concepts exist in the application, send:

- `X-Prune-Customer-Id`: authenticated VulnFlow user or team
- `X-Prune-Feature-Id`: `claim_extraction`, `correlation`, or another stable feature name
- `X-Prune-Run-Id`: one analysis run identifier across related calls
- `X-Prune-Run-Budget-Usd`: optional per-run budget

Use exact caching only when the request identity includes the repository, commit SHA, report hash, prompt version, and model. Disable semantic caching for sensitive source analysis unless the privacy decision is explicit.

### Persisted metadata

Store only the metadata needed for audit and cost visibility:

- analysis ID and report hash
- requested and returned model
- cache status
- token counts and estimated cost
- optimization flags
- shield decision or rejection code
- receipt signature and verification status
- provider request identifier, when available

Do not store provider keys, full prompts, or sensitive source excerpts in logs.

### Failure behavior

Handle Prune rate limits, spend caps, shield rejections, timeouts, and outages explicitly. A direct-provider fallback, if enabled later, must be behind a feature flag and must preserve the same claim schema and audit fields.

Prune documentation: https://www.withprune.com/docs  
How it works: https://www.withprune.com/docs/how-it-works  
Receipts: https://www.withprune.com/docs/receipts  
Security model: https://www.withprune.com/docs/security

## Maritime integration

### Use case

Maritime is optional for the MVP. Use it when VulnFlow needs to run untrusted repository tests, generated checks, or longer verification jobs outside the FastAPI process.

Prefer an ephemeral sandbox for one analysis. Use a persistent Agent Box only if VulnFlow later needs a customer-specific workspace that survives between tasks.

### Job lifecycle

1. FastAPI creates a sandbox with a short time limit, memory limit, and restricted network policy.
2. FastAPI uploads only the required source snapshot and task input.
3. The sandbox runs a fixed allowlisted command or verifier.
4. FastAPI collects exit status, stdout, stderr, and the sandbox job ID.
5. FastAPI stores a redacted result in Supabase.
6. FastAPI deletes or allows expiry of the sandbox.

Never upload a GitHub token to the sandbox. Do not execute arbitrary commands taken from a report or repository file. Do not grant broad outbound network access by default.

### API boundary

Maritime's REST base URL is `https://api.maritime.sh`. Authenticate server-side with a Bearer `mk_` key. Use its sandbox, file, command, and lifecycle APIs through a small FastAPI adapter so the rest of VulnFlow does not depend on vendor-specific calls.

The MVP exposes `POST /api/findings/{id}/sandbox-check` with `{ "claim_id": "..." }`. It accepts only a verified `.py` claim and the finding's original commit. The backend creates a five-minute ephemeral sandbox with internet disabled, runs a fixed Python syntax parser, stores only the bounded result and sandbox ID, then requests sandbox deletion. It never runs repository tests, imports project modules, or accepts commands from reports or users. A successful syntax check is not evidence of exploitability or remediation. The credential must have Maritime's `sandboxes` scope.

Persist:

- VulnFlow analysis ID
- Maritime sandbox or execution ID
- requested resource and time limits
- start/end status
- exit code and redacted output
- failure reason

Do not persist Maritime keys or raw logs containing secrets.

Maritime documentation: https://maritime.sh/index.md  
Setup procedure: https://maritime.sh/agents.md  
REST API: https://maritime.sh/docs/api.md  
Documentation index: https://maritime.sh/llms.txt

## Environment variables

Keep real values outside Git:

```text
PRUNE_API_KEY=
MARITIME_TOKEN=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
GITHUB_TOKEN=
```

Only the FastAPI runtime may read secret keys. Keep real values in the ignored `backend/.env` file or deployment secrets, never in the repository.

## Acceptance checks

Before calling either integration complete:

- A FastAPI request reaches Prune and returns the expected claim schema.
- The response records usable Prune metadata without exposing secrets.
- A repeated safe request demonstrates the selected cache behavior.
- A Maritime sandbox runs the fixed syntax parser with internet disabled and is deleted after the result is collected.
- Invalid or unauthorized requests fail before either vendor is called.
- Timeouts, rate limits, provider failures, and sandbox failures produce safe, actionable errors.
- Supabase RLS and server-side authorization still protect every stored analysis.
- All integration URLs and API routes match the current vendor documentation.

See [PROJECT.md](PROJECT.md), [FEATURES.md](FEATURES.md), [SECURITY_GUIDE.md](SECURITY_GUIDE.md), and [AGENTS.md](AGENTS.md).
