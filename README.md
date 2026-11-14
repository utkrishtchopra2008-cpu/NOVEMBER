# VulnFlow

Evidence-first vulnerability report triage. VulnFlow checks cited source references against a fixed commit, groups possible duplicate reports for human review, exports investigation packets, and highlights later changes for retesting. A reference match does **not** establish exploitability, and code changes do **not** establish remediation.

## Get started (backend demo + frontend)

Requirements: Python 3.12+, Node.js 20+. From the repository root, use two terminals:

**Terminal 1 — FastAPI**

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cd backend
../.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend defaults to **demo mode** and does **not** require copying an `.env.example` file. Keep demo mode local; do not expose it on the public internet. API docs: http://localhost:8000/docs.

**Terminal 2 — React**

```bash
npm install
printf 'VITE_API_BASE_URL=http://localhost:8000\n' > .env.local
npm run dev
```

Open http://localhost:5173. The frontend fetches the structured demo fixture from `GET /api/demo` and submits it to `POST /api/intake`. The backend performs deterministic checks against its controlled fixture. Use this mode to demonstrate claim decomposition, the evidence matrix, correlation, review, packet export and impact analysis.

The backend contract, source checks, and configuration live in [backend/README.md](backend/README.md) and [API_CONTRACT.md](API_CONTRACT.md). Your teammate's current backend code is authoritative.

## Frontend-only mock mode

Without `VITE_API_BASE_URL`, React uses **local mock mode** with illustrative bundled findings and local browser storage. This mode does not fetch GitHub, decompose arbitrary reports, or verify source references. It retains human review actions for demonstration. For the bundled original sample analysis, enter `DEMO` as the impact target to show a prebuilt temporal comparison. Any other ref/PR in offline mode returns an unverified result, not a fake retest verdict.

**Never upload confidential reports in local mock mode:** report text is stored in your browser.

## Production integration

Set `VITE_API_BASE_URL` to a separately hosted FastAPI API. The FastAPI live mode requires Supabase Auth access tokens, a configured database and Prune/GitHub credentials server-side. The frontend's API boundary exposes `configureAccessTokenProvider()` but **does not currently implement Supabase sign-in**. Do not deploy live mode without a working authentication flow and server-side access-control verification.

Do not place Supabase secret/service-role keys, GitHub tokens, Prune credentials or Maritime tokens in any `VITE_*` variable. A browser-safe Supabase publishable key is not an API authorization token. Prune and Maritime are server-side integrations only.

## Build

```bash
npm run build
npm run preview
```

The frontend is configured for Firebase Hosting (`dist` + SPA rewrites), but no Firebase project or public backend host is selected. Deployment therefore requires a project choice and origin/CORS configuration. GitHub Actions runs `npm run build` on frontend changes.

## Product boundaries

- Duplicate correlation is a suggestion; reviewers must confirm relationships and original reports remain separate.
- Approval/rejection are explicit human decisions. Rejection never means the code was fixed.
- Impact analysis covers **referenced files**, not the complete PR inventory or full call graph.
- A source reference may be consistent while a vulnerability remains unproven.
- A patch or change does not automatically resolve a finding.
- GitHub/Jira issue publication is a **draft handoff**, not an automatic write.

See [PROJECT.md](PROJECT.md), [FEATURES.md](FEATURES.md), [SECURITY_GUIDE.md](SECURITY_GUIDE.md) and [INTEGRATIONS.md](INTEGRATIONS.md).
