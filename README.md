# Rooftop Solar Subsidy Assistant

A demonstration system for evaluating rooftop solar application data, showing deterministic checks and evidence, pausing for human approval, and filing to a separate simulated DISCOM portal.

This is a demo, not a government service. It does not verify real DISCOM/vendor records, document authenticity, current statutory rules, subsidy entitlement, or government approval.

## Components

- frontend/: React + Vite Mission Control UI.
- backend/: FastAPI API and LangGraph workflow.
- backend/app/portal/mock_portal.py: independently runnable simulated portal and REST API.

The LangGraph workflow validates the request, calculates an indicative estimate, retrieves source passages from MNRE and MSEDCL policy material through a lightweight in-memory cosine index using LangChain documents and embeddings, pauses at a checkpointed human review interrupt, and resumes to submit the approved payload. The evidence index always uses local token vectors and makes no embedding API calls. Set GEMINI_API_KEY to enable the optional Gemini free-tier assessment (GEMINI_MODEL defaults to gemini-3.5-flash-lite); leave it blank for fully offline operation. The checkpointer and workflow store are in memory for the single-process demo; workflow state is lost on restart.

The portal driver uses REST when MOCK_PORTAL_URL is configured, retries transient service failures up to three times, and leaves failed approved submissions in a retryable queue. Without that variable, the backend uses the same portal validation locally for single-process development.

## Local setup

### Backend API

From backend/:

~~~powershell
uv sync --group dev
$env:CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
$env:MOCK_PORTAL_URL = "http://127.0.0.1:8001"
uv run uvicorn app.main:app --reload --port 8000
~~~

### Mock portal

In another terminal, from backend/:

~~~powershell
uv run uvicorn app.portal.mock_portal:app --reload --port 8001
~~~

Portal UI: http://127.0.0.1:8001  
Portal API: http://127.0.0.1:8001/api/applications

### Mission Control UI

From frontend/:

~~~powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
~~~

The frontend uses VITE_API_BASE_URL and VITE_PORTAL_URL from .env.local. VITE_API_URL remains supported for existing configurations. The browser-facing portal defaults to the same-origin `/api/mock-discom/portal` route; `MOCK_PORTAL_URL` is a server-side setting for the backend-to-portal connection.

## Tests and build checks

From backend/:

~~~powershell
uv run --group dev pytest -v
~~~

From frontend/:

~~~powershell
npm run build
npm run lint
~~~

## Docker

From the repository root:

~~~powershell
docker compose up --build
~~~

The compose file runs the API on port 8000 and the standalone mock portal on port 8001. Run the Vite app locally or deploy it separately.

## Cloud demo deployment

1. Deploy backend/ as a Render Docker web service using backend/Dockerfile. Optionally set GEMINI_API_KEY for Gemini free-tier policy assessment. No embedding key is needed. Set CORS_ORIGINS to any custom frontend origin. Vercel preview origins ending in .vercel.app are allowed by the API.
2. Deploy a second Render Docker service from the same backend/Dockerfile, with the start command: uvicorn app.portal.mock_portal:app --host 0.0.0.0 --port $PORT.
3. Set MOCK_PORTAL_URL on the API service to the portal service's HTTPS origin.
4. Deploy frontend/ to Vercel with build command npm run build, output directory dist, and environment values VITE_API_BASE_URL=https://your-agent-api.onrender.com and VITE_PORTAL_URL=https://your-mock-portal.onrender.com.
5. Add the final Vercel origin to the API service's CORS_ORIGINS, then redeploy the API.

VITE_* values are included in the browser bundle; put no secrets in them. The demo stores state in process memory, so configure one API instance and expect workflows to clear on restart. Before multi-instance or production use, replace the in-memory workflow store/checkpointer with a durable database-backed implementation and verify all rules against authoritative, current utility and scheme sources.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/applications/validate | Basic application validation |
| POST | /api/workflows/evaluate | Start graph and return its current state |
| GET | /api/workflows/{workflow_id} | Read workflow status |
| GET | /api/workflows/{workflow_id}/events | Replay workflow events as SSE |
| POST | /api/workflows/{workflow_id}/approve | Resume LangGraph after explicit approval |
| POST | /api/workflows/{workflow_id}/submit | Backward-compatible approval route |
| GET | /health | Health check
| GET | /api/health | Health check alias |

## Demonstration behavior and limits

- The subsidy formula and generation/payback assumptions are deterministic examples from the supplied blueprint. They are not dynamically verified against government circulars.
- Empanelment and document upload status are applicant-supplied declarations. The portal validates fields but does not query a DISCOM registry or authenticate documents.
- MOCK_PORTAL_FAIL_STATUS=503 makes the portal return a maintenance error for retry-path demonstrations.
- The standalone portal generates synthetic APP-SOL-2026-XXXXX IDs only.
- OCR, Supabase persistence, CAPTCHA solving, and real government submission are not implemented. RAG cites official published source passages; verify their currentness and applicability before making eligibility or filing decisions.
