from __future__ import annotations

import os
from pathlib import Path


DESKTOP = Path(os.path.expanduser("~/Desktop"))

TEST_CASES = """# GoSolar Jury Test Case Prep

> Use synthetic records only. The first four are the organizer-assigned scenarios shown on the Ziro dashboard. TC5 and TC6 are optional GoSolar guardrail demonstrations, not organizer requirements. No case contacts a live government portal.

## Demo order and shared setup

Start the deployed GoSolar app, open **Benchmarks · 6**, select a case and read the explainer aloud. Choose **Fill demo and run check**. The app shows populated values and a result/guardrail. Use the expected result and distinguish an actual check from a mock or client-side demonstration.

## TC1 — Eligible home (official)

- **What:** Standard residential owner eligibility and the required human-review pause.
- **Where:** Benchmarks tray → TC1. Synthetic consumer, state/DISCOM, sanctioned load, roof area, usage, documents and empanelled installer populate the intake; policy outcome appears in the vendor review step.
- **When:** First, to establish the normal path before showing exception handling.
- **Expected agent behavior:** Validate the connection and feasibility inputs, apply scheme/vendor/document rules, retain evidence, calculate an estimate and stop at human review with a draft. No portal submission happens until the person approves.
- **Guardrails:** Required inputs and numeric fields are checked; proposed capacity must fit both sanctioned load and roof-area estimate. Final eligibility remains subject to official review.
- **Live presentation:** Show synthetic inputs, the scenario explanation, policy result, evidence trail and the human approval boundary. State clearly that the result is preliminary.

## TC2 — Vendor not empanelled (official)

- **What:** Vendor empanelment must be checked before advancing a draft.
- **Where:** Benchmarks tray → TC2. The installer is set to a synthetic unverified vendor and policy evaluation returns the result.
- **When:** After the happy path, as the first blocked case.
- **Expected agent behavior:** Return **Flagged** / vendor warning and prevent progression to submission.
- **Guardrails:** The vendor check is an explicit policy gate; an unverified installer is not silently accepted.
- **Live presentation:** Point at the synthetic vendor value, then show the warning and blocked state. Do not imply the demo checked a live registry unless the displayed evidence confirms it.

## TC3 — Tenant, not owner (official)

- **What:** Consent handling when the applicant is a tenant without a landlord NOC.
- **Where:** Benchmarks tray → TC3. Applicant type, ownership and missing NOC fields are filled with synthetic values.
- **When:** After TC2, to show an evidence/document dependency.
- **Expected agent behavior:** Return **Consent needed** and identify the landlord NOC as pending; do not file.
- **Guardrails:** The ownership/consent condition blocks an irreversible submission until evidence is supplied and reviewed.
- **Live presentation:** Show the tenant/no-NOC combination and the named missing item. Explain that an optional demo case does not bypass the approval gate.

## TC4 — Application ID (official)

- **What:** Verify receipt interpretation without claiming subsidy approval or payment.
- **Where:** Benchmarks tray → TC4. A synthetic application ID is placed in a read-only verification result; this case does not submit.
- **When:** After blocked workflow cases, to demonstrate truthful status reporting.
- **Expected agent behavior:** Treat an ID as a mock receipt only and report **Subsidy not promised** unless separate authoritative evidence proves approval/payment.
- **Guardrails:** Read-only interpretation; no filing or payment claim.
- **Live presentation:** Show the synthetic ID and the explicit receipt-only wording. Point out that receipt verification and subsidy sanction are separate events.

## TC5 — Capacity above sanctioned load (optional GoSolar guardrail)

- **What:** Requested system size must not exceed the grid sanctioned load.
- **Where:** Benchmarks tray → TC5. It fills a 5 kW system request against a 4 kW sanctioned load while keeping roof area adequate.
- **When:** After the four official cases, as an optional validation stress check.
- **Expected agent behavior:** The intake remains on Step 1 and shows a hard inline block: reduce capacity or apply for load enhancement. The client guardrail result is marked passed when the invalid request is blocked.
- **Guardrails:** `proposedCapacityKw > sanctionedLoadKw` prevents continuing or evaluating.
- **Live presentation:** Show the comparison and disabled Continue button; explain this optional case is a product guardrail, not one of the four organizer-assigned test cases.

## TC6 — Insufficient roof area (optional GoSolar guardrail)

- **What:** Verify the approximate 100 sq. ft. of usable roof per kW rule.
- **Where:** Benchmarks tray → TC6. It fills a 3 kW system request against 250 sq. ft. of roof.
- **When:** Last, paired with TC5 to show independent physical feasibility gates.
- **Expected agent behavior:** The intake remains on Step 1 and shows the maximum supported system size (2.50 kW); the guardrail result is marked passed when the oversized request is blocked.
- **Guardrails:** `proposedCapacityKw * 100 > roofAreaSqft` prevents continuing or evaluating.
- **Live presentation:** Show the inline roof-area calculation and disabled Continue button. Clarify that exact usable area and shadow conditions still require site survey.

## Evidence and claims

The benchmark dropdown is a deterministic demonstration. TC1–TC3 call the configured evaluation backend and use a local deterministic fallback only when unavailable; TC4 is read-only; TC5–TC6 run client-side feasibility guards. Describe what ran in the displayed result. Do not describe all six as official hackathon tests or claim live DISCOM/government access.
"""

ARCHITECTURE = """# GoSolar System Architecture Guide

## Purpose and boundaries

GoSolar is a rooftop-solar subsidy assessment and workflow demonstration. It uses synthetic/demo data and an isolated mock DISCOM portal. It is not a government service, a final eligibility determination, or proof of subsidy approval/payment. Human review is required before portal-style submission.

## High-level architecture

```mermaid
flowchart LR
  U[Applicant / reviewer] --> UI[React 19 + TypeScript SPA\nVite, Tailwind CSS, custom CSS]
  UI -->|REST evaluation / submission| API[FastAPI backend]
  UI -->|drafts and demo tracker| LS[(Browser localStorage)]
  API --> WF[LangGraph workflow]
  WF --> V[Input and feasibility validation]
  WF --> P[Scheme / vendor policy checks]
  WF --> E[Source-linked policy evidence]
  WF --> F[Financial estimate]
  F --> H{Human approval gate}
  H -->|approved demo action| MP[Mock DISCOM portal]
  MP --> R[Receipt ID]
  R --> Q[Independent receipt verification]
  Q --> UI
```

## Frontend

- **Application:** React 19 and TypeScript, built and served as a Vite single-page application for Vercel.
- **UI:** Tailwind CSS is installed through the Vite plugin; the application uses its own component CSS and theme styles for the dashboard, forms, cards, modals, and responsive layout. There is no external component library.
- **Key components:** `App.tsx` orchestrates the assessment and tracking views; `ProgressBar` shows the journey; `SubsidySelector` and `VendorSelector` present choices; `FinancialPlan` and `DashboardSummary` show estimates; `AgentInspector` and evidence panels expose workflow trace; `MockDiscomPortalModal` demonstrates the isolated action; `ApplicationLifecycleTracker` displays milestones; `ThemeToggle` switches light/dark presentation.
- **State:** React state holds the active form, selected options, workflow/evidence, theme and current view. `applicationStore.ts` persists GoSolar application records to browser `localStorage`; draft form data and mock tracking receipts also use localStorage. These records are local to that browser and are not a shared server database.

## Backend and agent logic

- FastAPI exposes evaluation, workflow event, scheme/vendor, submission and tracking endpoints.
- Pydantic schemas validate request shapes. Deterministic feasibility and policy checks cover consumer inputs, roof ownership/consent, grid connection, capacity vs. sanctioned load/roof, vendor and required documents.
- LangGraph organizes validation, policy/evidence retrieval and financial calculation, then pauses for human approval.
- The approved demo action targets the mock DISCOM portal. The receipt ID is verified separately. Retry behavior and duplicate-submission protections are part of the workflow service.
- When the configured API is unavailable, selected UI paths offer clearly labeled local previews/deterministic benchmark behavior. These do not contact official services.

## Data and safety boundaries

Use synthetic consumer numbers, names, addresses and application IDs for demos. Never bypass OTP/CAPTCHA. Missing DISCOM feeder/transformer details remain pending until an authoritative check. Estimates and scheme values are indicative; only the competent authority can approve eligibility or subsidy payment.

## Repository references

- Frontend: `frontend/src/App.tsx`, `frontend/src/components/`, `frontend/src/utils/`
- Local application store: `frontend/src/utils/applicationStore.ts`
- Backend workflow: `backend/app/services/workflow.py`
- API routes and schemas: `backend/app/`
- Benchmarks: `frontend/src/utils/benchmarks.ts`, `scripts/run_benchmarks.py`
- Tests: `backend/tests/`
- Build and run instructions: `README.md`, `SUBMISSION.md`
"""


def write_pdf(path: Path, text: str) -> bool:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer
    except ImportError:
        return False

    styles = getSampleStyleSheet()
    story = []
    for block in text.split("\n\n"):
        if block.startswith("# "):
            story.append(Paragraph(block[2:], styles["Title"]))
        elif block.startswith("## "):
            story.append(Paragraph(block[3:], styles["Heading2"]))
        elif block.startswith("### "):
            story.append(Paragraph(block[4:], styles["Heading3"]))
        elif block.startswith("- "):
            story.append(Paragraph("• " + block[2:].replace("&", "&amp;"), styles["BodyText"]))
        else:
            story.append(Paragraph(block.replace("&", "&amp;").replace("\n", "<br/>"), styles["BodyText"]))
        story.append(Spacer(1, 5 * mm))
    doc = SimpleDocTemplate(str(path), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm, topMargin=18 * mm, bottomMargin=18 * mm)
    doc.build(story)
    return True


def main() -> None:
    DESKTOP.mkdir(parents=True, exist_ok=True)
    prep_path = DESKTOP / "Jury_TestCase_Prep.md"
    prep_path.write_text(TEST_CASES, encoding="utf-8")
    pdf_path = DESKTOP / "System_Architecture_Guide.pdf"
    if not write_pdf(pdf_path, ARCHITECTURE):
        md_path = DESKTOP / "System_Architecture_Guide.md"
        md_path.write_text(ARCHITECTURE, encoding="utf-8")
        print(f"PDF library unavailable; wrote {md_path}")
    else:
        print(f"Wrote {pdf_path}")
    print(f"Wrote {prep_path}")


if __name__ == "__main__":
    main()
