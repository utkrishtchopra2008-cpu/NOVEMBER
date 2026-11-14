# VulnFlow

Evidence-first vulnerability validation and triage dashboard.

## Run the frontend

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

### Local mock mode

Leave `VITE_API_BASE_URL` empty. The dashboard loads three bundled findings and keeps demo review decisions and impact results in browser local storage. Mock data is illustrative: it is not retrieved from GitHub and must not be represented as a real source verification.

### Backend demo mode

Follow [backend/README.md](backend/README.md) to start FastAPI in demo mode. Create `.env.local` with:

```text
VITE_API_BASE_URL=http://localhost:8000
```

The frontend checks API capabilities, fetches the backend's `GET /api/demo` fixture, then submits the exact returned report formats to `POST /api/intake`. Backend demo mode exercises the real deterministic reference checker against its controlled fixture repository.

### Live backend mode

Set `VITE_API_BASE_URL` to the deployed FastAPI origin. Live backend endpoints require a Supabase access token. The API service exposes `configureAccessTokenProvider()` for a Supabase session integration, but this frontend build does not include a sign-in screen or Supabase client. Do not put a service-role key or other server secret in Vite environment variables. Until an authenticated token provider is wired, use backend demo mode for the end-to-end demonstration.

The frontend uses the generated schema/client in `shared/api-schema.d.ts` and `shared/client.ts`. See [API_CONTRACT.md](API_CONTRACT.md) for request and response details. Prune and Maritime are never called from the browser.

## Build and deploy

```bash
npm run build
npm run preview
```

Firebase Hosting serves the Vite `dist` directory and rewrites SPA paths to `index.html`. Deploy FastAPI separately and set the production API origin in `VITE_API_BASE_URL`.

## Functional boundaries

- Correlation decisions link reports but do not merge or delete findings.
- Rejection is a reviewer disposition, not evidence that a vulnerability was resolved.
- Impact analysis is scoped to files referenced by stored claims; it is not a full PR inventory or call graph.
- A source reference match does not establish exploitability.
- A changed file or function does not establish remediation.
- Jira/GitHub issue creation is not wired; the UI prepares a draft and never claims a ticket was published.

VulnFlow is an evidence and investigation workflow, not a SAST/DAST scanner or exploitability detector.
