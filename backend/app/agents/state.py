from typing import Any, TypedDict


class AgentWorkflowState(TypedDict, total=False):
    """Values carried between LangGraph nodes for one application thread."""

    workflow_id: str
    request_data: dict[str, Any]
    workflow_data: dict[str, Any]
    human_approved: bool

