import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException

from app.portal.mock_portal import PortalApplication, create_application
from app.schemas.workflow import (
    EvidenceRecord,
    FinancialSummary,
    WorkflowEvent,
    WorkflowRequest,
    WorkflowResponse,
)

# In-memory response store and LangGraph checkpointer are for the single-process
# demo only. Use a durable repository/checkpointer before horizontal scaling.
_workflows: dict[str, WorkflowResponse] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _subsidy(capacity_kw: float) -> int:
    if capacity_kw <= 2:
        amount = capacity_kw * 30000
    elif capacity_kw < 3:
        amount = 60000 + (capacity_kw - 2) * 18000
    else:
        amount = 78000
    return round(amount)


def _financial_summary(request: WorkflowRequest) -> FinancialSummary:
    capacity = request.proposed_capacity_kw
    subsidy = _subsidy(capacity)
    generation = capacity * 1450
    savings = generation * request.tariff_inr_per_kwh
    net_cost = max(0.0, capacity * request.average_cost_per_kw - subsidy)
    return FinancialSummary(
        eligible_capacity_kw=round(capacity, 2),
        estimated_subsidy_inr=subsidy,
        estimated_annual_generation_kwh=round(generation),
        estimated_annual_savings_inr=round(savings),
        estimated_payback_years=round(net_cost / savings, 1) if savings else 0.0,
    )


def _post_to_portal(parameters: dict) -> dict:
    payload = {
        "applicant_name": parameters["applicant_name"],
        "consumer_number": parameters["consumer_number"],
        "discom_code": parameters["discom_code"],
        "state": parameters["state"],
        "planned_capacity_kw": parameters["proposed_capacity_kw"],
        "sanctioned_load_kw": parameters["sanctioned_load_kw"],
        "vendor_id": parameters["installer_id"],
        "vendor_empanelled": parameters["installer_empanelled"],
    }
    portal_url = os.getenv("MOCK_PORTAL_URL", "").rstrip("/")
    if not portal_url:
        local_request = PortalApplication.model_validate(payload)
        for attempt in range(3):
            try:
                return create_application(local_request)
            except HTTPException as exc:
                if exc.status_code != 503 or attempt == 2:
                    raise
                time.sleep(0.25 * (2**attempt))

    request = urllib.request.Request(
        f"{portal_url}/api/applications",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code != 503 or attempt == 2:
                raise
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = exc
            if attempt == 2:
                raise
        time.sleep(0.25 * (2**attempt))
    raise RuntimeError("Mock portal submission failed.") from last_error


def _record_event(workflow: WorkflowResponse, node: str, status: str, message: str) -> WorkflowResponse:
    event = WorkflowEvent(node=node, status=status, message=message, timestamp=_now())
    return workflow.model_copy(update={"events": [*workflow.events, event]}, deep=True)


def _evaluate_workflow_core(request: WorkflowRequest, workflow_id: str) -> WorkflowResponse:
    issues: list[str] = []
    evidence: list[EvidenceRecord] = []

    def record(rule: str, outcome: str, excerpt: str) -> None:
        evidence.append(EvidenceRecord(
            evidence_id=f"{workflow_id}-input-{len(evidence) + 1}",
            rule_applied=rule,
            source_title="Applicant-provided declaration / input",
            verbatim_snippet=excerpt,
            rule=rule,
            outcome=outcome,
            source_url=None,
            excerpt=excerpt,
            checked_at=_now(),
        ))

    record("input_validation", "passed", "Request fields passed Pydantic validation.")
    if not request.owns_rooftop:
        issues.append("Rooftop ownership has not been established.")
        record("rooftop_ownership", "needs_review", "Applicant reports no ownership confirmation.")
    else:
        record("rooftop_ownership", "passed", "Applicant reports rooftop ownership.")
    if not request.has_grid_connection:
        issues.append("A grid electricity connection is required.")
        record("grid_connection", "failed", "Applicant reports no grid connection.")
    else:
        record("grid_connection", "passed", "Applicant reports an existing grid connection.")
    if request.proposed_capacity_kw > request.sanctioned_load_kw:
        issues.append("Proposed capacity exceeds sanctioned load; reduce capacity or request load enhancement.")
        record("capacity_check", "failed", "Proposed capacity exceeds the declared sanctioned load.")
    else:
        record("capacity_check", "passed", "Proposed capacity is within the declared sanctioned load.")
    if not request.installer_empanelled:
        issues.append(f"Installer '{request.installer_id}' is not verified as empanelled.")
        record("installer_empanelment", "failed", "Installer status is supplied by the applicant and is not independently verified.")
    else:
        record("installer_empanelment", "passed", "Installer is marked empanelled in the submitted request; registry lookup is not configured.")

    uploaded = {doc.strip().casefold() for doc in request.uploaded_documents}
    required = list(dict.fromkeys(request.required_documents))
    missing_documents = [doc for doc in required if doc.strip().casefold() not in uploaded]
    for document in missing_documents:
        record("document_check", "missing", f"Required document has not been recorded as uploaded: {document}.")

    if request.applicant_type == "tenant" and not request.landlord_noc_uploaded:
        issues.append("Landlord No Objection Certificate (NOC) is needed.")
        record("landlord_consent", "pending", "Tenant application is paused until landlord NOC is recorded.")
    elif request.applicant_type == "tenant":
        record("landlord_consent", "provided", "NOC upload is reported by the applicant; authenticity is not verified.")

    if not request.installer_empanelled:
        state = "vendor_warning"
        status = "blocked"
    elif request.applicant_type == "tenant" and not request.landlord_noc_uploaded:
        state = "consent_needed"
        status = "blocked"
    elif not request.owns_rooftop or not request.has_grid_connection or request.proposed_capacity_kw > request.sanctioned_load_kw or missing_documents:
        state = "pending_items"
        status = "blocked"
    else:
        state = "human_review_required"
        status = "waiting"

    parameters = {
        "applicant_name": request.applicant_name,
        "consumer_number": request.consumer_number,
        "discom_code": request.discom_code,
        "state": request.state,
        "applicant_type": request.applicant_type,
        "sanctioned_load_kw": request.sanctioned_load_kw,
        "proposed_capacity_kw": request.proposed_capacity_kw,
        "owns_rooftop": request.owns_rooftop,
        "has_grid_connection": request.has_grid_connection,
        "installer_id": request.installer_id,
        "installer_empanelled": request.installer_empanelled,
        "landlord_noc_uploaded": request.landlord_noc_uploaded,
        "uploaded_documents": request.uploaded_documents,
    }
    response = WorkflowResponse(
        workflow_id=workflow_id,
        state=state,
        can_proceed=state == "human_review_required",
        human_approval_required=state == "human_review_required",
        issues=issues,
        missing_documents=missing_documents,
        application_parameters=parameters,
        evidence_log=evidence,
        financial_summary=(
            _financial_summary(request)
            if request.proposed_capacity_kw <= request.sanctioned_load_kw
            else None
        ),
        events=[],
        application_id=None,
    )
    response = _record_event(response, "validate_input", "completed", "Application data passed structural validation.")
    response = _record_event(response, "policy_checks", status, "Ownership, grid, capacity, vendor, consent, and document checks completed.")
    if response.financial_summary:
        response = _record_event(response, "financial_calculation", "completed", "Deterministic subsidy and savings estimate prepared.")
    else:
        response = _record_event(response, "financial_calculation", "blocked", "Estimate withheld because planned capacity exceeds sanctioned load.")
    if state == "human_review_required":
        response = _record_event(response, "human_review", "waiting", "Review the prepared portal payload and approve before submission.")
    else:
        response = _record_event(response, "human_review", "blocked", "Resolve the listed issues before submission.")
    return response


def evaluate_workflow(request: WorkflowRequest) -> WorkflowResponse:
    from app.agents.graph import evaluate_with_graph

    workflow_id = f"WF-{uuid4().hex[:10].upper()}"
    result = evaluate_with_graph(workflow_id, request.model_dump(mode="json"))
    response = WorkflowResponse.model_validate(result["workflow_data"])
    _workflows[workflow_id] = response
    return response


def get_workflow(workflow_id: str) -> WorkflowResponse | None:
    return _workflows.get(workflow_id)


def _submit_approved_workflow(workflow: WorkflowResponse) -> WorkflowResponse:
    try:
        portal_result = _post_to_portal(workflow.application_parameters)
    except Exception as exc:
        queued = workflow.model_copy(
            update={
                "state": "portal_queued",
                "can_proceed": False,
                "human_approval_required": False,
                "issues": [*workflow.issues, f"Mock portal is unavailable: {exc}"],
            },
            deep=True,
        )
        return _record_event(queued, "portal_submission", "blocked", "Portal submission failed after three attempts; the approved application remains pending.")

    submitted = workflow.model_copy(
        update={
            "state": "submitted",
            "can_proceed": False,
            "human_approval_required": False,
            "application_id": portal_result["application_id"],
            "issues": [],
        },
        deep=True,
    )
    submitted = _record_event(submitted, "portal_submission", "submitted", f"Mock portal accepted the application as {portal_result['application_id']}.")
    return _record_event(submitted, "audit_record", "completed", "Simulated submission result recorded in the workflow evidence trail.")


def submit_workflow(workflow_id: str, human_approved: bool) -> WorkflowResponse:
    workflow = _workflows.get(workflow_id)
    if workflow is None:
        raise KeyError("Workflow not found.")
    if workflow.application_id is not None:
        return workflow
    if not human_approved:
        raise PermissionError("Explicit human approval is required before mock submission.")
    if workflow.state == "portal_queued":
        retried = _submit_approved_workflow(workflow)
        _workflows[workflow_id] = retried
        return retried
    if workflow.state != "human_review_required":
        raise ValueError(f"Workflow state '{workflow.state}' cannot be submitted. Resolve all issues first.")

    from app.agents.graph import resume_with_approval

    result = resume_with_approval(workflow_id, approved=human_approved)
    updated = WorkflowResponse.model_validate(result["workflow_data"])
    _workflows[workflow_id] = updated
    return updated




