# VulnFlow FastAPI

## Local demo

From repository root:

```sh
python -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cd backend
# The app defaults to local demo settings; create .env only to override them.
../.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open http://localhost:8000/docs. GET /api/demo provides the complete intake fixture; submit it to POST /api/intake. This is explicit, single-user local demo mode. Do not expose demo mode to the public internet.

## Live configuration

1. Apply migrations/001_analyses.sql to Supabase Postgres. This server-owned table denies browser Data API access. It stores one versioned JSON aggregate per analysis, with immutable original claims and append-only reviews and impact comparisons. Optimistic version checks prevent lost updates.
2. Set MODE=live; set DATABASE_URL to a Supabase direct/session-pooler connection with the postgresql+psycopg scheme. Configure SSL (prefer sslmode=verify-full with the project's CA). The database credential must have table access; never ship it to React.
3. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY. Every live protected request must supply a Supabase Auth bearer token. The API validates it through Auth and filters every database operation by the returned user ID, including reads, exports and impact requests.
4. Set PRUNE_API_KEY and LLM_MODEL to a supported model provisioned in the Prune account. Vault provider credentials in Prune. Set MARITIME_TOKEN only if enabling isolated Python syntax checks; it must have the `sandboxes` scope. GITHUB_TOKEN is optional for public repos; use minimum read access for private ones.
5. Set CORS_ORIGINS as a JSON list of the exact local/Firebase frontend origins. Firebase hosts the SPA; deploy this API container to the separately selected Python/container runtime. No Firebase project or hosting domain is hardcoded.

The Docker image defaults to live mode and refuses to start without its required configuration. Secrets are injected at runtime. There is no automatic provider fallback or silent demo fallback.

The initial API is a single-instance hackathon implementation: six intake/impact requests per user per minute, at most two concurrent intake jobs, synchronous intake with a 180-second deadline. Configure a shared rate limiter and worker queue before scaling to multiple instances. Findings listing scans the user's stored analyses; paginate/index it before larger datasets. Impact inspects referenced files only and conservatively flags uncertain mappings.

## Checks and contract

From root: `.venv/bin/python -m pytest -q`. Tests run against temporary SQLite and mocked outbound services; they do not require credentials or invoke paid providers. See [API_CONTRACT.md](../API_CONTRACT.md) for request/response details, generated TypeScript types and frontend service client. Live Supabase/GitHub/Prune/Maritime checks require configured credentials and an authorized target repository.

Reference existence is not exploitability. Approval/rejection is a human decision; patch analysis never resolves a finding automatically. Issue publication is intentionally represented as a draft handoff until a ticket connector and publication policy are configured.
