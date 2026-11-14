# VulnFlow

Evidence-first vulnerability validation and triage dashboard.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

The dashboard starts in **Demo Mode** when `VITE_API_BASE_URL` is empty. Demo findings, review decisions, and impact-analysis state are stored in browser local storage.

To connect the FastAPI service, copy `.env.example` to `.env.local` and set:

```text
VITE_API_BASE_URL=http://localhost:8000
```

Expected endpoints:

- `POST /api/intake`
- `GET /api/findings`
- `GET /api/findings/:id`
- `POST /api/findings/:id/review`
- `POST /api/impact-analysis`

The frontend does not call Prune or Maritime directly. Those integrations and their credentials remain server-side.

## Build

```bash
npm run build
npm run preview
```

Firebase Hosting is configured to serve the Vite `dist` directory and rewrite SPA routes to `index.html`.

## Product boundary

VulnFlow organizes existing vulnerability reports and checks whether cited source references are consistent at an exact commit. It is not a SAST/DAST scanner or exploitability detector. Reference existence does not prove exploitability; changed code does not prove remediation.
