
from datetime import datetime, timezone
from uuid import uuid4

from app.schemas.workflow import (
    EvidenceRecord,
    WorkflowRequest,
    WorkflowResponse,
)

# In-memory store for the hackathon demo.
# Records reset when the backend restarts.
_workflows: dict[str, WorkflowResponse] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def evaluate_workflow(request: WorkflowRequest) -> WorkflowResponse:
    workflow_id = f"WF-{uuid4().hex[:10].upper()}"
    issues: list[str] = []
    evidence: list[EvidenceRecord] = []

    def record(rule: str, outcome: str, excerpt: str) -> None:
        evidence.append(
            EvidenceRecord(
                rule=rule,
                outcome=outcome,
                source_url=None,
                excerpt=excerpt,
                checked_at=_now(),
            )
        )

    # Check the basic eligibility conditions.
    if not request.owns_rooftop:
        issues.append("Rooftop ownership has not been established.")
        record(
            "rooftop_ownership",
            "needs_review",
            "The applicant has not confirmed rooftop ownership.",
        )
    else:
        record(
            "rooftop_ownership",
            "passed",
            "The applicant reports rooftop ownership.",
        )

    if not request.has_grid_connection:
        issues.append("A grid electricity connection is required.")
        record(
            "grid_connection",
            "failed",
            "The applicant reports no grid connection.",
        )
    else:
        record(
            "grid_connection",
            "passed",
            "The applicant reports an existing grid connection.",
        )

    if request.proposed_capacity_kw > request.sanctioned_load_kw:
        issues.append(
            "Proposed solar capacity exceeds sanctioned load; "
            "technical and utility requirements need review."
        )
        record(
            "capacity_check",
            "needs_review",
            "Proposed capacity exceeds the declared sanctioned load.",
        )
    else:
        record(
            "capacity_check",
            "passed",
            "Proposed capacity does not exceed the declared sanctioned load.",
        )

    if not request.installer_empanelled:
        issues.append(
            f"Installer '{request.installer_id}' is not verified as empanelled. "
            "Choose a verified installer or request human review."
        )
        record(
            "installer_empanelment",
            "warning",
            f"Installer {request.installer_id} is marked as not empanelled.",
        )
    else:
        record(
            "installer_empanelment",
            "passed",
            f"Installer {request.installer_id} is marked as empanelled.",
        )

    # Determine missing documents.
    uploaded = {doc.strip().casefold() for doc in request.uploaded_documents}
    required = list(dict.fromkeys(request.required_documents))
    missing_documents = [
        doc for doc in required if doc.strip().casefold() not in uploaded
    ]

    for document in missing_documents:
        record(
            "document_check",
            "missing",
            f"Required document has not been recorded as uploaded: {document}.",
        )

    if request.applicant_type == "tenant" and not request.landlord_noc_uploaded:
        issues.append("Landlord No Objection Certificate (NOC) is needed.")
        record(
            "landlord_consent",
            "pending",
            "Tenant application is paused until landlord NOC is recorded.",
        )
    elif request.applicant_type == "tenant":
        record(
            "landlord_consent",
            "provided",
            "The request indicates that landlord NOC has been uploaded; "
            "authenticity has not been independently verified.",
        )

    # State priority: stop on safety/eligibility blockers first.
    if not request.installer_empanelled:
        state = "vendor_warning"
        can_proceed = False
        human_approval_required = True

    elif request.applicant_type == "tenant" and not request.landlord_noc_uploaded:
        state = "consent_needed"
        can_proceed = False
        human_approval_required = False

    elif (
        not request.owns_rooftop
        or not request.has_grid_connection
        or request.proposed_capacity_kw > request.sanctioned_load_kw
    ):
        state = "pending_items"
        can_proceed = False
        human_approval_required = True

    elif missing_documents:
        state = "pending_items"
        can_proceed = False
        human_approval_required = False

    else:
        state = "draft_application_ready"
        can_proceed = True
        human_approval_required = False

    parameters = {
        "applicant_name": request.applicant_name,
        "state": request.state,
        "applicant_type": request.applicant_type,
        "sanctioned_load_kw": request.sanctioned_load_kw,
        "proposed_capacity_kw": request.proposed_capacity_kw,
        "owns_rooftop": request.owns_rooftop,
        "has_grid_connection": request.has_grid_connection,
        "installer_id": request.installer_id,
        "installer_empanelled": request.installer_empanelled,
    }

    response = WorkflowResponse(
        workflow_id=workflow_id,
        state=state,
        can_proceed=can_proceed,
        human_approval_required=human_approval_required,
        issues=issues,
        missing_documents=missing_documents,
        application_parameters=parameters,
        evidence_log=evidence,
        application_id=None,
    )

    _workflows[workflow_id] = response
    return response


def get_workflow(workflow_id: str) -> WorkflowResponse | None:
    return _workflows.get(workflow_id)


def submit_workflow(
        
    workflow_id: str,
    human_approved: bool,
) -> WorkflowResponse:
    workflow = _workflows.get(workflow_id)

    if workflow is None:
        raise KeyError("Workflow not found.")

    if not human_approved:
        raise PermissionError(
            "Explicit human approval is required before mock submission."
        )

    if workflow.application_id is not None:
        return workflow

    # This is a simulated submission for the hackathon, not a government portal.
    # TC2 can proceed only through this explicitly approved mock-review path.
    if workflow.state != "draft_application_ready":
        raise ValueError(
            f"Workflow state '{workflow.state}' cannot be mock-submitted. "
            "Resolve all eligibility issues, missing documents, and consent "
        "requirements before submission."
        )

    submitted = workflow.model_copy(
        update={
            "state": "submitted",
            "can_proceed": False,
            "human_approval_required": False,
            "application_id": f"MOCK-APP-{uuid4().hex[:10].upper()}",
            "evidence_log": [
                *workflow.evidence_log,
                EvidenceRecord(
                    rule="mock_submission",
                    outcome="human_approved",
                    source_url=None,
                    excerpt=(
                        "Mock submission recorded after explicit human approval. "
                        "This is not confirmation of government submission "
                        "or subsidy approval."
                    ),
                    checked_at=_now(),
                ),
            ],
        },
        deep=True,
    )

    _workflows[workflow_id] = submitted
    return submitted
