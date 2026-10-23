from typing import Any
from datetime import datetime, timezone

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.constants import END, START
from langgraph.graph import StateGraph
from langgraph.types import Command, interrupt

from app.agents.state import AgentWorkflowState


def _evaluate_node(state: AgentWorkflowState) -> dict[str, Any]:
    from app.schemas.workflow import WorkflowRequest
    from app.services.workflow import _evaluate_workflow_core

    request = WorkflowRequest.model_validate(state["request_data"])
    result = _evaluate_workflow_core(request, state["workflow_id"])
    return {"workflow_data": result.model_dump(mode="json")}


def _retrieve_evidence_node(state: AgentWorkflowState) -> dict[str, Any]:
    from app.rag.retriever import policy_reasoning, retrieve_policy_evidence
    from app.schemas.workflow import EvidenceRecord, WorkflowEvent, WorkflowResponse

    workflow = WorkflowResponse.model_validate(state["workflow_data"])
    params = workflow.application_parameters
    query = (
        "PM Surya Ghar residential rooftop solar central financial assistance, "
        "empanelled vendor and DISCOM verification, rooftop grid connectivity and "
        f"capacity requirements for {params.get('discom_code')} in {params.get('state')}; "
        f"proposed {params.get('proposed_capacity_kw')} kW and sanctioned load "
        f"{params.get('sanctioned_load_kw')} kW."
    )
    retrieved = [
        *retrieve_policy_evidence(
            "PM Surya Ghar residential CFA, empanelled vendor and DISCOM verification",
            rule_applied="pm_surya_ghar_cfa",
            k=1,
            source_ids={"mnre-pmsg"},
        ),
        *retrieve_policy_evidence(
            f"MSEDCL rooftop grid connectivity and sanctioned load capacity for {params.get('discom_code')}",
            rule_applied="discom_connectivity",
            k=2,
            source_ids={"msedcl-guidelines", "msedcl-capacity-2025"},
        ),
    ]
    structured = [
        EvidenceRecord(
            evidence_id=item["evidence_id"],
            rule_applied=item["rule_applied"],
            source_title=item["source_title"],
            verbatim_snippet=item["verbatim_snippet"],
            source_url=item["source_url"],
            rule=item["rule_applied"],
            outcome="reference",
            excerpt=item["verbatim_snippet"],
            checked_at=datetime.now(timezone.utc).isoformat(),
        )
        for item in retrieved
    ]
    assessment = policy_reasoning(query, retrieved)
    workflow = workflow.model_copy(
        update={
            "evidence_log": [*workflow.evidence_log, *structured],
            "policy_assessment": assessment,
            "events": [
                *workflow.events,
                WorkflowEvent(
                    node="policy_evidence",
                    status="completed",
                    message=f"Retrieved {len(structured)} source-backed policy passages; assessment prepared.",
                    timestamp=datetime.now(timezone.utc).isoformat(),
                ),
            ],
        },
        deep=True,
    )
    return {"workflow_data": workflow.model_dump(mode="json")}


def _route_evaluation(state: AgentWorkflowState) -> str:
    if state["workflow_data"].get("human_approval_required"):
        return "human_review"
    return END


def _human_review_node(state: AgentWorkflowState) -> dict[str, Any]:
    decision = interrupt({
        "type": "human_approval",
        "workflow_id": state["workflow_id"],
        "message": "Review the application payload and approve simulated portal submission.",
        "payload": state["workflow_data"].get("application_parameters", {}),
    })
    approved = decision.get("approved") is True if isinstance(decision, dict) else decision is True
    return {"human_approved": approved}


def _route_approval(state: AgentWorkflowState) -> str:
    return "portal_submission" if state.get("human_approved") else END


def _portal_submission_node(state: AgentWorkflowState) -> dict[str, Any]:
    from app.schemas.workflow import WorkflowResponse
    from app.services.workflow import _submit_approved_workflow

    current = WorkflowResponse.model_validate(state["workflow_data"])
    updated = _submit_approved_workflow(current)
    return {"workflow_data": updated.model_dump(mode="json")}


builder = StateGraph(AgentWorkflowState)
builder.add_node("evaluate", _evaluate_node)
builder.add_node("policy_evidence", _retrieve_evidence_node)
builder.add_node("human_review", _human_review_node)
builder.add_node("portal_submission", _portal_submission_node)
builder.add_edge(START, "evaluate")
builder.add_edge("evaluate", "policy_evidence")
builder.add_conditional_edges("policy_evidence", _route_evaluation)
builder.add_conditional_edges("human_review", _route_approval)
builder.add_edge("portal_submission", END)
checkpointer = InMemorySaver()
workflow_graph = builder.compile(checkpointer=checkpointer)


def evaluate_with_graph(workflow_id: str, request_data: dict[str, Any]) -> dict[str, Any]:
    config = {"configurable": {"thread_id": workflow_id}}
    return workflow_graph.invoke(
        {"workflow_id": workflow_id, "request_data": request_data},
        config,
    )


def resume_with_approval(workflow_id: str, approved: bool) -> dict[str, Any]:
    config = {"configurable": {"thread_id": workflow_id}}
    return workflow_graph.invoke(
        Command(resume={"approved": approved}),
        config,
    )
