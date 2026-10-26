"""Human-gated mock portal adapter and receipt verification entry points."""
from app.services.workflow import _submit_approved_workflow


def submit_after_human_approval(workflow):
    if not workflow.human_approval_required:
        raise ValueError("Portal dispatch requires an eligible workflow and explicit human approval.")
    return _submit_approved_workflow(workflow)
