"""Deterministic indicative scheme estimate; never represents an approval."""
from app.services.workflow import _financial_summary
from app.schemas.workflow import WorkflowRequest
from app.services.subsidy_catalog import SUBSIDIES, estimate_subsidy


def assess(request: WorkflowRequest) -> dict:
    summary = _financial_summary(request)
    options = [{"scheme_id": item["id"], "name": item["name"], "estimated_inr": estimate_subsidy(item["id"], request.proposed_capacity_kw, request.state, "residential"), "illustrative": item["illustrative"]} for item in SUBSIDIES]
    applicable = [item for item in options if item["estimated_inr"] > 0]
    preferred = max(applicable, key=lambda item: item["estimated_inr"], default=None)
    return {"agent": "subsidy_optimizer", "options": options, "recommended_option": preferred, "estimated_subsidy_inr": summary.estimated_subsidy_inr, "estimated_annual_savings_inr": summary.estimated_annual_savings_inr, "status": "estimate_only; state top-ups and KUSUM are catalog estimates, not verified entitlements"}
