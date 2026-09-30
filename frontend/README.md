# frontend

Next.js (App Router) + TypeScript UI for the Career Readiness Analyzer.

See the [root README](../README.md) for full setup instructions covering all
three services. Quick start for this service alone:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Runs on http://localhost:3000. Requires the `backend` service to be running
(see `NEXT_PUBLIC_API_BASE_URL` in `.env.local`).
