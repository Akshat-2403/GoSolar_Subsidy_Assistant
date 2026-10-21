
from typing import Literal

from pydantic import BaseModel, Field


WorkflowState = Literal[
    "draft_application_ready",
    "vendor_warning",
    "human_review_required",
    "consent_needed",
    "pending_items",
    "ready_for_submission",
    "submitted",
]


class WorkflowRequest(BaseModel):
    applicant_name: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)

    applicant_type: Literal["owner", "tenant"]
    sanctioned_load_kw: float = Field(gt=0, le=1000)
    proposed_capacity_kw: float = Field(gt=0, le=1000)

    owns_rooftop: bool
    has_grid_connection: bool

    installer_id: str = Field(min_length=1, max_length=100)
    installer_empanelled: bool

    landlord_noc_uploaded: bool = False

    required_documents: list[str] = Field(default_factory=list)
    uploaded_documents: list[str] = Field(default_factory=list)


class EvidenceRecord(BaseModel):
    rule: str
    outcome: str
    source_url: str | None = None
    excerpt: str
    checked_at: str


class WorkflowResponse(BaseModel):
    workflow_id: str
    state: WorkflowState
    can_proceed: bool
    human_approval_required: bool
    issues: list[str]
    missing_documents: list[str]
    application_parameters: dict[str, str | float | bool]
    evidence_log: list[EvidenceRecord]
    application_id: str | None = None
