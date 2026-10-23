import asyncio
import json
import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.schemas.workflow import WorkflowRequest, WorkflowResponse
from app.services.workflow import evaluate_workflow, get_workflow, submit_workflow


router = APIRouter(prefix="/api/workflows", tags=["Workflows"])


class ApprovalRequest(BaseModel):
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


@router.get("/{workflow_id}/events")
async def workflow_events(workflow_id: str):
    workflow = get_workflow(workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found.")

    async def event_stream():
        for event in workflow.events:
            data = json.dumps(event.model_dump())
            yield f"data: {data}\n\n"
            await asyncio.sleep(0)
        yield "event: complete\ndata: {}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _approve(workflow_id: str, request: ApprovalRequest):
    try:
        return submit_workflow(workflow_id, request.human_approved)
    except KeyError:
        raise HTTPException(status_code=404, detail="Workflow not found.")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.post("/{workflow_id}/approve", response_model=WorkflowResponse)
def approve(workflow_id: str, request: ApprovalRequest):
    return _approve(workflow_id, request)


# Keep the original endpoint available for existing API clients.
@router.post("/{workflow_id}/submit", response_model=WorkflowResponse)
def submit(workflow_id: str, request: ApprovalRequest):
    return _approve(workflow_id, request)

