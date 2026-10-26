# GoSolar Verification Evidence

This file records repository-level implementation evidence for code review. Every benchmark uses synthetic inputs. A passed fixture is not a real utility or government decision.

## System benchmark matrix

| Case | Synthetic input | Expected agent behavior | Gate / result |
| --- | --- | --- | --- |
| TC1 | Domestic owner, 3 kW proposed, 5 kW declared load, required bill present | Supervisor routes grid, subsidy, and policy specialists; subsidy estimate is ₹78,000 under the current demo formula | Workflow pauses for human review; no portal filing occurs without approval |
| TC2 | TC1 with vendor marked not empanelled | Policy compliance specialist flags applicant-provided vendor status | `vendor_warning`; portal dispatch is blocked |
| TC3 | 3 kW proposed against 2 kW sanctioned load | Grid feasibility specialist detects proposed capacity above declared load | `pending_items`; load enhancement or revised sizing is required |
| TC4 | Synthetic feeder fixture described as over 40% loading | Grid specialist does not infer feeder clearance from the fixture; transformer capacity is absent from the connected utility data | Audit returns `pending_discom_study`; actual feeder measurement and the applicability of any threshold require DISCOM verification |
| TC5 | Tenant applicant without landlord NOC | Policy compliance specialist identifies missing consent | `consent_needed`; filing remains blocked |

The browser audit modal runs these cases through `POST /api/benchmark/run` and reads the case catalogue from `GET /api/benchmark/status`. TC4 is explicitly a synthetic conservative hold; GoSolar has no feeder telemetry. The cited [CEA electricity distribution planning criteria](https://cea.nic.in/wp-content/uploads/notification/2024/01/Final_Approved__Revised_Distribution_Planning_Criteria.pdf) does not substantiate a blanket 40% rooftop distribution-transformer ceiling in the available material, so GoSolar treats 40% only as the requested demo screening assumption, not a verified legal rule.

## Architecture and action boundary

The LangGraph topology is `supervisor → grid_feasibility_agent → subsidy_optimizer_agent → policy_compliance_agent → evaluation/evidence → human approval interrupt → portal_submission_agent`. Specialist reports are carried in `WorkflowResponse.agent_reports` and workflow events. The portal agent calls only the isolated mock portal adapter and independent receipt lookup. It does not submit live DISCOM registrations.

Live submission is intentionally simulated. The product has no authenticated utility portal integration, authority to register consumer applications, or source of verified feeder data. It keeps an explicit human approval gate before mock dispatch to prevent a demo workflow from being mistaken for an official filing. No legal claim is made here about a blanket cybersecurity rule under a specific statute.

## Deterministic benchmark command output

Captured from `backend\.venv\Scripts\python.exe scripts\run_benchmarks.py` in this workspace (ANSI color escapes retained as visible `\x1b` markers):

```text
+---------+------------+------------------+------------------+----------------+---------------------------------------+----------------------+--------+
| Case ID | Input Load | Recommended Size | Subsidy Expected | Subsidy Actual | Feeder Check                          | Actual Verdict       | Status |
+---------+------------+------------------+------------------+----------------+---------------------------------------+----------------------+--------+
| TC1     | 5.0 kW     | 3.0              | 78000            | 78000          | Awaiting DISCOM sanction              | Draft application    | \x1b[32mPASS\x1b[0m |
| TC2     | 5.0 kW     | 3.0              | 78000            | 78000          | Awaiting DISCOM sanction              | Flagged              | \x1b[32mPASS\x1b[0m |
| TC3     | 5.0 kW     | 3.0              | 78000            | 78000          | Awaiting DISCOM sanction              | Consent needed       | \x1b[32mPASS\x1b[0m |
| TC4     | 5.0 kW     | 3.0              | 78000            | 78000          | Receipt only; DISCOM sanction pending | Subsidy not promised | \x1b[32mPASS\x1b[0m |
+---------+------------+------------------+------------------+----------------+---------------------------------------+----------------------+--------+
```

## Pytest status from this editing environment

The repository currently contains 25 backend tests, including the five-case audit endpoint checks. The attempted command `backend\.venv\Scripts\python.exe -m pytest -v backend\tests` collected 25 items but stalled at the first synchronous `TestClient` request. A minimal standalone FastAPI + Starlette `TestClient` request also stalled in this environment, so there is no complete pytest stdout to claim here. The direct benchmark command above passed, the LangGraph workflow was exercised directly and returned all four agent reports, and the frontend `npm run build:check` and `npm run lint` commands passed. The full pytest suite must be rerun in a functioning TestClient environment before treating the suite as verified.
