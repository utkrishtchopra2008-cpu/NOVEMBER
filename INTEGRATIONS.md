# VulnFlow Integrations

This document defines the integration boundaries for Prune and Maritime. Both credentials are read only by FastAPI from environment variables; never commit their values or expose them to React.

## Roles

| Service | VulnFlow responsibility |
|---|---|
| FastAPI | Owns API routes, orchestration, authorization, GitHub access, deterministic checks, and exports |
| Supabase | Stores analyses, reports, claims, evidence, relationships, reviews, and integration metadata |
| Prune | Proxies FastAPI's supported LLM calls and returns optimization, security, cost, and receipt metadata |
| Maritime | Optionally runs a fixed Python syntax check in an isolated sandbox |
| Firebase Hosting | Serves the React single-page frontend |

The browser must never call Prune or Maritime directly. Their credentials remain server-side.

## Request flow

1. React submits an analysis to FastAPI.
2. FastAPI validates the repository URL, commit SHA, report size, and authenticated user, then resolves the exact commit.
3. FastAPI sends report text to Prune for structured claim extraction; it does not ask Prune to verify source references.
4. FastAPI fetches each referenced file at the resolved SHA, deterministically verifies supported file, line, and function references, then stores the completed analysis and allowlisted Prune metadata in Supabase.
5. The API returns the evidence matrix and exposes the investigation packet.
6. A reviewer may request a syntax-only recheck for a verified Python reference; FastAPI sends that pinned source file to a disposable Maritime sandbox with internet disabled, stores the bounded result, and requests sandbox deletion.

A reference match does not prove exploitability. A changed file does not prove remediation.

## Prune integration

### Client

The FastAPI extractor uses `httpx` to call `POST https://api.withprune.com/v1/chat/completions` with `PRUNE_API_KEY` from server configuration. The browser never contacts Prune. Prune's OpenAI-compatible Chat Completions endpoint accepts the current structured JSON request; VulnFlow does not use the Responses API.

### Request metadata

The current extractor sends:

- `X-Prune-Customer-Id`: authenticated VulnFlow user
- `X-Prune-Feature-Id`: `claim_extraction`
- `X-Prune-Run-Id`: analysis ID shared across report calls in that analysis
- `X-Prune-Cache`: `exact`

The request body includes repository, commit SHA, report hash, and prompt version alongside the report. Exact cache mode is explicitly selected; semantic caching is not used.

### Persisted metadata

Store only the metadata needed for audit and cost visibility:

- analysis ID and report hash
- requested and returned model
- cache status
- tokens saved and estimated cost saved, when returned
- allowlisted cache, token-saved, cost-saved, and routed-model metadata
- receipt signature fields when present; receipt signature verification is not implemented and is recorded as unverified

Do not store provider keys, full prompts, or sensitive source excerpts in logs.

### Failure behavior

Handle Prune rate limits, spend caps, shield rejections, timeouts, and outages explicitly. A direct-provider fallback, if enabled later, must be behind a feature flag and must preserve the same claim schema and audit fields.

Prune documentation: https://www.withprune.com/docs
How it works: https://www.withprune.com/docs/how-it-works
Error codes: https://www.withprune.com/docs/errors

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

Maritime sandbox docs: https://maritime.sh/docs/ephemeral-sandboxes
REST API: https://maritime.sh/docs/api

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
