"""Supervisor coordinates specialist assessments for one application."""
from app.schemas.workflow import WorkflowRequest


def route(request_data: dict) -> dict:
    WorkflowRequest.model_validate(request_data)
    # All three checks are required for every residential assessment. A future
    # intent may skip a financial estimate, but policy and grid gates stay mandatory.
    return {"routed_to": ["grid_feasibility", "subsidy_optimizer", "policy_compliance"]}
