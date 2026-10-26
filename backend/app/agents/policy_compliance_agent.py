"""Policy and documentary gate checks based only on applicant declarations."""
from app.schemas.workflow import WorkflowRequest


def assess(request: WorkflowRequest) -> dict:
    uploaded = {item.strip().casefold() for item in request.uploaded_documents}
    missing = [item for item in dict.fromkeys(request.required_documents) if item.strip().casefold() not in uploaded]
    return {
        "agent": "policy_compliance",
        "tenant_noc": "missing" if request.applicant_type == "tenant" and not request.landlord_noc_uploaded else "recorded_or_not_required",
        "vendor": "unverified_warning" if not request.installer_empanelled else "applicant_declared_empanelled_not_registry_verified",
        "missing_documents": missing,
        "module_standard": "not_verified_by_demo",
    }
