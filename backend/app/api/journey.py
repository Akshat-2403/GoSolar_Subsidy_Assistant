"""Catalog and application lifecycle API for the client journey demo."""
from datetime import datetime, timezone
import secrets
import re
from threading import Lock
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.schemas.workflow import WorkflowRequest
from app.db.database import get_application, save_application
from app.services.subsidy_catalog import SUBSIDIES, VENDORS, estimate_subsidy
from app.services.workflow import evaluate_workflow, get_workflow, submit_workflow

router = APIRouter(prefix="/api", tags=["Application journey"])
_records: dict[str, dict] = {}
_lock = Lock()
_stages = [
    "Application Submitted", "DISCOM Technical Feasibility Approved",
    "Vendor Site Inspection Scheduled", "Net Meter Installed",
    "Subsidy Disbursed to Bank Account",
]


def _get_record(tracking_id: str) -> dict | None:
    return get_application(tracking_id) or _records.get(tracking_id)


class JourneySubmission(WorkflowRequest):
    address: str = Field(default="", max_length=300)
    consumer_group: Literal["residential", "agricultural", "rwa"] = "residential"
    subsidy_id: str = "pm-surya-ghar"
    vendor_id: str = "waaree-eco"
    workflow_id: str | None = None


def _state_code(state: str) -> str:
    known = {"maharashtra": "MH", "gujarat": "GJ", "delhi": "DL", "karnataka": "KA", "rajasthan": "RJ", "tamil nadu": "TN"}
    return known.get(state.strip().casefold(), "".join(part[0] for part in re.findall(r"[A-Za-z]+", state.upper()))[:2] or "IN")


@router.get("/subsidies")
def list_subsidies(state: str = "", capacity_kw: float = 1, consumer_group: str = "residential"):
    return [{**item, "estimated_subsidy_inr": estimate_subsidy(item["id"], capacity_kw, state, consumer_group), "net_effective_cost_note": "Deduct this estimate from selected vendor gross price. Eligibility and amount require official confirmation."} for item in SUBSIDIES]


@router.get("/vendors")
def list_vendors():
    return VENDORS


@router.post("/submit-application")
def create_submission(request: JourneySubmission):
    vendor = next((item for item in VENDORS if item["id"] == request.vendor_id), None)
    subsidy = next((item for item in SUBSIDIES if item["id"] == request.subsidy_id), None)
    if vendor is None or subsidy is None:
        raise HTTPException(status_code=422, detail="Select a catalog vendor and subsidy scheme.")
    if request.proposed_capacity_kw > request.sanctioned_load_kw:
        raise HTTPException(status_code=422, detail="Proposed capacity exceeds sanctioned load.")

    workflow_request = WorkflowRequest.model_validate(request.model_dump(exclude={"address", "consumer_group", "subsidy_id", "vendor_id", "workflow_id"}) | {
        "installer_id": vendor["id"], "installer_empanelled": True,
    })
    workflow = get_workflow(request.workflow_id) if request.workflow_id else None
    if request.workflow_id and workflow is None:
        raise HTTPException(status_code=404, detail="The reviewed workflow has expired; run the policy check again.")
    if workflow:
        params = workflow.application_parameters
        submitted_values = {
            "applicant_name": request.applicant_name,
            "consumer_number": request.consumer_number,
            "state": request.state,
            "discom_code": request.discom_code,
            "installer_id": vendor["id"],
            "proposed_capacity_kw": request.proposed_capacity_kw,
        }
        if any(params.get(key) != value for key, value in submitted_values.items()):
            raise HTTPException(status_code=409, detail="The application changed after review. Run the policy check again.")
    else:
        workflow = evaluate_workflow(workflow_request)
    if not workflow.can_proceed:
        raise HTTPException(status_code=422, detail={"message": "Resolve the policy checks before submission.", "issues": workflow.issues, "workflow_id": workflow.workflow_id})
    try:
        submitted = submit_workflow(workflow.workflow_id, True)
    except (KeyError, PermissionError, ValueError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    state_code = _state_code(request.state)
    with _lock:
        tracking_id = f"SOLAR-{state_code}-{datetime.now().year}-{secrets.randbelow(900_000) + 100_000}"
        while _get_record(tracking_id) is not None:
            tracking_id = f"SOLAR-{state_code}-{datetime.now().year}-{secrets.randbelow(900_000) + 100_000}"
        now = datetime.now(timezone.utc).isoformat()
        logs = [{"timestamp": event.timestamp, "stage": event.node, "message": event.message, "status": event.status} for event in submitted.events]
        record = {
            "tracking_id": tracking_id, "application_id": submitted.application_id,
            "status": "submitted" if submitted.state == "submitted" else "portal_queued",
            "current_stage": 0, "submitted_at": now, "updated_at": now,
            "milestones": [{"title": title, "status": "completed" if index == 0 else "pending", "timestamp": now if index == 0 else None} for index, title in enumerate(_stages)],
            "agent_validation_logs": logs,
            "application": {
                "applicant_name": request.applicant_name, "state": request.state,
                "consumer_number": request.consumer_number, "discom_code": request.discom_code,
                "address": " ".join(request.address.split()), "system_size_kw": request.proposed_capacity_kw,
                "sanctioned_load_kw": request.sanctioned_load_kw,
                "subsidy": {"id": subsidy["id"], "name": subsidy["name"], "estimated_inr": estimate_subsidy(subsidy["id"], request.proposed_capacity_kw, request.state, request.consumer_group)},
                "vendor": {"id": vendor["id"], "name": vendor["name"], "price_per_kw": vendor["price_per_kw"]},
            },
        }
        _records[tracking_id] = record
        save_application(record)
    return record


@router.get("/track/{tracking_id}")
def read_tracking(tracking_id: str):
    record = _get_record(tracking_id.strip().upper())
    if record is None:
        raise HTTPException(status_code=404, detail="Tracking ID not found in this demo service.")
    return record


@router.post("/track/{tracking_id}/advance")
def advance_tracking(tracking_id: str):
    record = _get_record(tracking_id.strip().upper())
    if record is None:
        raise HTTPException(status_code=404, detail="Tracking ID not found in this demo service.")
    with _lock:
        index = min(record["current_stage"] + 1, len(_stages) - 1)
        now = datetime.now(timezone.utc).isoformat()
        record["current_stage"] = index
        record["updated_at"] = now
        record["milestones"][index].update(status="completed", timestamp=now)
        record["status"] = "completed" if index == len(_stages) - 1 else "in_progress"
        record["agent_validation_logs"].append({"timestamp": now, "stage": "demo_stage_advance", "message": f"Demo lifecycle advanced to: {_stages[index]}.", "status": "completed"})
        save_application(record)
    return record


@router.post("/track/{tracking_id}/reschedule")
def reschedule_tracking(tracking_id: str, requested_date: str = ""):
    record = _get_record(tracking_id.strip().upper())
    if record is None:
        raise HTTPException(status_code=404, detail="Tracking ID not found in this demo service.")
    now = datetime.now(timezone.utc).isoformat()
    record["updated_at"] = now
    record["agent_validation_logs"].append({"timestamp": now, "stage": "site_survey_reschedule", "message": f"Demo reschedule request recorded{f' for {requested_date}' if requested_date else ''}; vendor confirmation is pending.", "status": "waiting"})
    save_application(record)
    return record
