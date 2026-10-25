# Judge submission notes

## 2-minute demo script

| Time | Show | Talk track |
| --- | --- | --- |
| 0:00–0:15 | GoSolar home and problem-fit statement | “GoSolar helps a homeowner understand rooftop-solar subsidy steps and prepare a mock application. It does not file with a government portal or promise subsidy.” |
| 0:15–0:35 | Open **Official benchmark scenarios** and run TC1 | Show synthetic homeowner inputs prefilled across the assessment. Explain that the expected result is a draft awaiting human review. |
| 0:35–0:55 | Open **Agentic decision engine & tool logs** | Expand the execution trace, JSON input/output, source evidence and visible pending DISCOM sanction. Explain that the trace records actual workflow events rather than hidden model thoughts. |
| 0:55–1:15 | Run TC2 and TC3 | Show the vendor flag and tenant consent/NOC block. Point to the issue text and case-by-case pass badge. |
| 1:15–1:30 | Run TC4 | Show the synthetic application ID and the explicit “receipt only” wording. It is not subsidy approval or payment evidence. |
| 1:30–1:45 | Review the human approval screen and mock portal | Show where approval is required. If demonstrating filing, use only synthetic data and the local mock portal. |
| 1:45–2:00 | Show test evidence and architecture | Close with the benchmark output, source links, and the fact that feeder capacity remains pending until DISCOM technical sanction. |

Keep the demo to 2–3 minutes as required by the dashboard. Do not use real consumer data or claim that a mock action was a government submission.

## Official benchmark verification matrix

| Case | Synthetic input change | Expected | Evidence to capture |
| --- | --- | --- | --- |
| TC1 — Eligible home | Residential owner, load/roof within plan, empanelled vendor, required documents present | Draft application | Benchmark badge, backend workflow state `human_review_required`, human-review event, and source evidence when API is available. |
| TC2 — Vendor not empanelled | Set installer empanelment to false | Flagged | Benchmark badge, `vendor_warning` state, and vendor issue/evidence. |
| TC3 — Tenant, not owner | Tenant, ownership false, no landlord NOC | Consent needed | Benchmark badge, `consent_needed` state, and pending NOC issue. |
| TC4 — Application ID | Read a synthetic receipt ID only | Subsidy not promised | TC4 badge and text that the ID is a mock receipt, not subsidy approval/payment. No filing is performed by the benchmark button. |

Run the executable matrix from the repository root:

~~~powershell
uv run --project backend --group dev python scripts/run_benchmarks.py
~~~

## Local replication

### Node and Python

1. Install Node.js/npm, Python 3.12+, and uv.
2. In `backend/`, run `uv sync --group dev`.
3. Start the backend API with a configured `PORT`. Set `MOCK_PORTAL_URL` to the mock service only if running it as a separate process. Start the mock portal in another terminal with its own configured `PORT`.
4. In `frontend/`, run `npm ci`, set `VITE_BACKEND_URL` to the backend origin, and start the Vite dev server with `npm run dev`.
5. Open the local frontend, select each official benchmark case, and capture the evidence listed above.
6. Run `npm run build:check`, `npm run lint`, `uv run --project backend --group dev pytest -v backend/tests`, and the benchmark command.

### Docker Compose

1. Copy `.env.example` to `.env` and confirm host ports are free or adjust them.
2. Run `docker compose up --build` from the repository root.
3. Open the frontend at the configured frontend host port and run TC1–TC4. Compose runs a local API and a local mock portal; no live government service is involved.

## Submission field checklist from the participant dashboard

- [ ] Project name and tools used
- [ ] Deployed demo URL
- [ ] 2–3 minute demo video URL
- [ ] GitHub URL or alternative source code / n8n JSON URL
- [ ] Presentation URL
- [ ] Agent architecture
- [ ] Test cases / proof of working agent
- [ ] Solution & agent workflow
- [ ] Team selfie/group photo (JPG, PNG or WebP; up to 5 MB)
- [ ] LinkedIn post link and screenshot
- [ ] Confirm the post tags the official Ziro Digital LinkedIn page with an @mention

Only the team leader can finalize the dashboard submission. This checklist documents the organizer’s required fields; it does not submit anything.
