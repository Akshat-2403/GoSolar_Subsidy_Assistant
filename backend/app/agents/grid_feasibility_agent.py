"""Conservative grid-side checks; missing utility capacity data stays pending."""
from app.schemas.workflow import WorkflowRequest


def assess(request: WorkflowRequest) -> dict:
    checks = {
        "grid_connection": "declared" if request.has_grid_connection else "blocked",
        "sanctioned_load": "within_declared_load" if request.proposed_capacity_kw <= request.sanctioned_load_kw else "load_enhancement_required",
        "roof_area": "within_planning_estimate",
    }
    if request.rooftop_area_sqft is not None and request.proposed_capacity_kw > request.rooftop_area_sqft / 100:
        checks["roof_area"] = "insufficient_declared_area"
    if request.transformer_loading_pct is None:
        checks["distribution_transformer"] = "pending_discom_study"
    elif request.transformer_loading_pct > 40:
        checks["distribution_transformer"] = "pending_discom_study"
        checks["transformer_loading_pct"] = request.transformer_loading_pct
        checks["demo_screening_threshold_pct"] = 40
    else:
        checks["distribution_transformer"] = "within_demo_screening_threshold_pending_discom_confirmation"
        checks["transformer_loading_pct"] = request.transformer_loading_pct
    return {"agent": "grid_feasibility", "checks": checks, "autonomy": "Evaluated declared load and roof limits; utility feeder/transformer data unavailable, so official capacity remains pending."}
