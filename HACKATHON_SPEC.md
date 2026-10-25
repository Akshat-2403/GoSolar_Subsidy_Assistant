# Ziro Agentic AI Hackathon 2026 — Official Dashboard Spec

**Retrieved:** 25 October 2026
**Source:** [Participant dashboard — Agentic AI Hackathon 2026](https://ziro.digital/challenges/ziro-agentic-ai-hackathon-2026/dashboard)
**Assigned brief:** Rooftop Solar Subsidy Assistant
**Dashboard category:** Social Impact & Sustainability · AI

## Problem statement and track

### Assigned problem: Rooftop Solar Subsidy Assistant

Build an AI agent that helps a homeowner learn the steps for a rooftop-solar subsidy and start an application. Demonstrate the workflow against the **Mock subsidy portal**.

The agent should:

1. **Collect details:** consumer number, roof ownership, and planned system capacity.
2. **Plan next steps:** apply official scheme and vendor conditions to the collected information.
3. **Find information:** retrieve relevant information from solar-scheme and electricity-board portals. Build and test against the Mock subsidy portal; retain source IDs or URLs and retrieval times with extracted values so decisions can be checked.
4. **Take action:** prepare/fill the application only after human review and approval. Show the proposed destination and change before execution. Store the approved version and avoid duplicate execution on retries.
5. **Produce a result:** show the steps, application ID, and pending items.
6. **Verify:** independently check that an application ID exists; compare observed state with intended state and keep failed or pending outcomes visible.

Keep the evidence and reason for each eligibility/condition decision. If required evidence is missing, return an uncertain state rather than inventing a conclusion. The official brief says the demo target is a mock portal. If a live service blocks access or requires a paid plan, ask ZIO or the organizer for the permitted demonstration workflow.

### Track

The assigned project brief is categorized as **Social Impact & Sustainability · AI**. The dashboard assigns this project to the participant; it says a replacement requires organizer approval. No additional track list was shown in the assigned dashboard brief.

## Objective, expected behavior, and official test cases

### Objective

Demonstrate a working, traceable agent workflow from homeowner inputs through source-backed eligibility/condition reasoning, a human-approved application action, and independent application-ID verification. Surface unresolved or pending items clearly.

### Required scenarios

Run all four official cases. Preserve each case’s specified input, expected result, actual result, and evidence; explain any mismatch rather than reporting it as a success.

| Test case | Scenario | Expected result |
| --- | --- | --- |
| TC1 | Eligible home | Draft application |
| TC2 | Vendor not empanelled | Flagged |
| TC3 | Tenant, not owner | Consent needed |
| TC4 | Application ID | Subsidy not promised |

### Safety and demo rules

- Ask for human approval before actions that cannot easily be undone.
- Use mock or synthetic data when a workflow involves personal or sensitive information.
- Do not bypass OTP or CAPTCHA; show a safe manual step or use a mock instead.
- Run every official test case and show its input, result, and evidence.

## Evaluation and 100-point scoring rubric

The dashboard lists these six scoring dimensions:

| Criterion | Points |
| --- | ---: |
| Problem fit & usefulness | 20 |
| Agentic capability | 25 |
| Technical implementation | 20 |
| Innovation | 15 |
| User experience | 10 |
| Presentation | 10 |
| **Total** | **100** |

The dashboard also describes the review process: assess the agent against its assigned problem and industry (problem fit); check the demo, source, and submitted evidence (working evidence); then organizers confirm the shortlist for jury review (jury selection).

The dashboard does not publish separate point allocations for multi-agent orchestration or documentation. It does require agent architecture and solution/workflow information in the submission, and source/evidence are reviewed.

## Build guidance and technology

### Implementation guidance

The official step-by-step guide calls for:

- stable IDs and validation for the consumer number, ownership, and capacity inputs;
- source IDs/URLs and retrieval times alongside extracted source values;
- explicit comparisons/classifications/model outputs for scheme and vendor conditions, with saved evidence and reasons;
- an approval step showing the proposed action before execution, plus duplicate prevention on retries;
- verification separated from the action itself, with observed state captured;
- a result view linking steps, application ID, and pending items to their input/evidence; and
- four labelled test runs with inputs, expected and actual outcomes, and evidence.

### Tools and stack

No programming language or framework is mandated in the visible brief. Suggested (optional) tools are **HTTP Request + Cheerio** (Playwright if needed) for retrieval, and **SQLite or Supabase + a simple web interface** for storing/showing inputs, evidence, action states, and test results. Equivalent tools are allowed. These are suggestions, not extra judging requirements. A paid service or real customer account is not required unless the official brief explicitly says otherwise.

## Submission constraints and required materials

The dashboard’s **Build & Submit** section states that a deployed working AI agent, source evidence, presentation, and test cases are mandatory. Submission fields shown:

- Project name — required
- Tools used — required
- Deployed demo URL — required
- **2–3 minute demo video URL** — required
- GitHub URL — optional if a source link is supplied
- Source code / n8n JSON file URL — optional if a GitHub URL is supplied
- Presentation URL — required
- Agent architecture — required
- Test cases / proof of working agent — required
- Solution & agent workflow — required
- Team selfie/photo — required (solo entries: selfie; teams: group photo showing all members; JPG, PNG, or WebP, up to 5 MB)
- LinkedIn post link — required
- LinkedIn post screenshot — required (JPG, PNG, or WebP, up to 5 MB)
- Confirmation that the post tagged the official Ziro Digital LinkedIn page using an @mention — required

Team members may save drafts; only the team leader can finalize the submission. The team setup panel shows a maximum team size of **3**.

## References and scope

- [Assigned participant dashboard](https://ziro.digital/challenges/ziro-agentic-ai-hackathon-2026/dashboard)
- All requirements above are transcribed or summarized from the dashboard’s assigned problem brief, build guide, test cases, safety checklist, Build & Submit form, and review criteria. The dashboard’s build guide and suggested tools are explicitly marked as implementation suggestions rather than additional judging requirements.
