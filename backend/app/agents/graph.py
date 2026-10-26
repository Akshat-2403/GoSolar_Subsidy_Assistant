from typing import Any
from datetime import datetime, timezone

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.constants import END, START
from langgraph.graph import StateGraph
from langgraph.types import Command, interrupt

from app.agents.state import AgentWorkflowState


def _evaluate_node(state: AgentWorkflowState) -> dict[str, Any]:
    from app.schemas.workflow import WorkflowEvent, WorkflowRequest
    from app.services.workflow import _evaluate_workflow_core

    request = WorkflowRequest.model_validate(state["request_data"])
    result = _evaluate_workflow_core(request, state["workflow_id"])
    reports = state.get("agent_reports", {})
    agent_events = [WorkflowEvent(node=f"agent_{name}", status="completed", message="Specialist assessment completed; see its structured agent report for scope and outcome.", timestamp=datetime.now(timezone.utc).isoformat()) for name in ("supervisor", "grid_feasibility", "subsidy_optimizer", "policy_compliance")]
    updates: dict[str, Any] = {"agent_reports": reports, "events": [*result.events, *agent_events]}
    grid_checks = reports.get("grid_feasibility", {}).get("checks", {})
    if grid_checks.get("distribution_transformer") == "pending_discom_study" and grid_checks.get("transformer_loading_pct") is not None:
        updates.update({"state": "pending_discom_study", "can_proceed": False, "human_approval_required": False,
                        "issues": [*result.issues, "Distribution transformer capacity requires DISCOM technical study; GoSolar does not infer capacity clearance."]})
        updates["events"].append(WorkflowEvent(node="distribution_transformer_review", status="blocked", message="Feeder/transformer clearance is pending DISCOM study; the 40% threshold is a demo screening assumption, not a verified legal approval rule.", timestamp=datetime.now(timezone.utc).isoformat()))
    result = result.model_copy(update=updates, deep=True)
    return {"workflow_data": result.model_dump(mode="json")}


def _specialist_node(name: str):
    def run(state: AgentWorkflowState) -> dict[str, Any]:
        from app.agents import grid_feasibility_agent, policy_compliance_agent, subsidy_optimizer_agent
        from app.schemas.workflow import WorkflowRequest

        request = WorkflowRequest.model_validate(state["request_data"])
        assessors = {
            "grid_feasibility": grid_feasibility_agent.assess,
            "subsidy_optimizer": subsidy_optimizer_agent.assess,
            "policy_compliance": policy_compliance_agent.assess,
        }
        return {"agent_reports": {name: assessors[name](request)}}
    return run


def _supervisor_node(state: AgentWorkflowState) -> dict[str, Any]:
    from app.agents.supervisor import route
    # The supervisor selects the three domain specialists for this application.
    selected = route(state["request_data"])
    return {"agent_reports": {"supervisor": {"agent": "supervisor", **selected}}}


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
    from app.agents.portal_submission_agent import submit_after_human_approval

    current = WorkflowResponse.model_validate(state["workflow_data"])
    updated = submit_after_human_approval(current)
    return {"workflow_data": updated.model_dump(mode="json")}


builder = StateGraph(AgentWorkflowState)
builder.add_node("supervisor", _supervisor_node)
builder.add_node("grid_feasibility_agent", _specialist_node("grid_feasibility"))
builder.add_node("subsidy_optimizer_agent", _specialist_node("subsidy_optimizer"))
builder.add_node("policy_compliance_agent", _specialist_node("policy_compliance"))
builder.add_node("evaluate", _evaluate_node)
builder.add_node("policy_evidence", _retrieve_evidence_node)
builder.add_node("human_review", _human_review_node)
builder.add_node("portal_submission", _portal_submission_node)
builder.add_edge(START, "supervisor")
builder.add_edge("supervisor", "grid_feasibility_agent")
builder.add_edge("grid_feasibility_agent", "subsidy_optimizer_agent")
builder.add_edge("subsidy_optimizer_agent", "policy_compliance_agent")
builder.add_edge("policy_compliance_agent", "evaluate")
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
