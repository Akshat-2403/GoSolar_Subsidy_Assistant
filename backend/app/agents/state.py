from operator import or_
from typing import Annotated, Any, TypedDict


class AgentWorkflowState(TypedDict, total=False):
    """Values carried between nodes for one application thread."""

    workflow_id: str
    request_data: dict[str, Any]
    workflow_data: dict[str, Any]
    human_approved: bool
    agent_reports: Annotated[dict[str, dict[str, Any]], or_]
