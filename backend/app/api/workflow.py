
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.schemas.workflow import WorkflowRequest, WorkflowResponse
from app.services.workflow import (
    evaluate_workflow,
    get_workflow,
    submit_workflow,
)

router = APIRouter(
    prefix="/api/workflows",
    tags=["Workflows"],
)


class SubmitRequest(BaseModel):
    human_approved: bool


@router.post("/evaluate", response_model=WorkflowResponse)
def evaluate(request: WorkflowRequest):
    return evaluate_workflow(request)


@router.get("/{workflow_id}", response_model=WorkflowResponse)
def read_workflow(workflow_id: str):
    workflow = get_workflow(workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found.")
    return workflow


@router.post("/{workflow_id}/submit", response_model=WorkflowResponse)
def submit(workflow_id: str, request: SubmitRequest):
    try:
        return submit_workflow(workflow_id, request.human_approved)
    except KeyError:
        raise HTTPException(status_code=404, detail="Workflow not found.")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
