from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


WorkflowState = Literal[
    "pending_items",
    "vendor_warning",
    "consent_needed",
    "human_review_required",
    "submitted",
    "portal_queued",
]


class WorkflowRequest(BaseModel):
    applicant_name: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    applicant_type: Literal["owner", "tenant"]
    consumer_number: str = Field(min_length=8, max_length=16)
    discom_code: str = Field(min_length=2, max_length=32)
    sanctioned_load_kw: float = Field(gt=0, le=1000)
    proposed_capacity_kw: float = Field(gt=0, le=1000)
    owns_rooftop: bool = True
    has_grid_connection: bool = True
    installer_id: str = Field(min_length=1, max_length=100)
    installer_empanelled: bool
    landlord_noc_uploaded: bool = False
    required_documents: list[str] = Field(default_factory=list)
    uploaded_documents: list[str] = Field(default_factory=list)
    tariff_inr_per_kwh: float = Field(default=8.0, gt=0, le=1000)
    average_cost_per_kw: float = Field(default=60000.0, gt=0, le=10000000)
    monthly_avg_consumption_kwh: float | None = Field(default=None, gt=0)
    rooftop_area_sqft: float | None = Field(default=None, gt=0)

    @field_validator("consumer_number")
    @classmethod
    def normalize_consumer_number(cls, value: str) -> str:
        value = value.strip().upper()
        if not value.isalnum():
            raise ValueError("Consumer number must contain only letters and digits.")
        return value


class EvidenceRecord(BaseModel):
    rule: str
    outcome: str
    source_url: str | None = None
    excerpt: str
    checked_at: str


class WorkflowEvent(BaseModel):
    node: str
    status: Literal["completed", "blocked", "waiting", "submitted"]
    message: str
    timestamp: str


class FinancialSummary(BaseModel):
    eligible_capacity_kw: float
    estimated_subsidy_inr: int
    estimated_annual_generation_kwh: int
    estimated_annual_savings_inr: int
    estimated_payback_years: float


class WorkflowResponse(BaseModel):
    workflow_id: str
    state: WorkflowState
    can_proceed: bool
    human_approval_required: bool
    issues: list[str]
    missing_documents: list[str]
    application_parameters: dict[str, Any]
    evidence_log: list[EvidenceRecord]
    events: list[WorkflowEvent] = Field(default_factory=list)
    financial_summary: FinancialSummary | None = None
    application_id: str | None = None


