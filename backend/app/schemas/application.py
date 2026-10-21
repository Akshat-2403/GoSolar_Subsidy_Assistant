
from typing import Literal

from pydantic import BaseModel, Field


class ApplicationRequest(BaseModel):
    state: str = Field(min_length=2, max_length=100)
    consumer_category: Literal["residential"] = "residential"
    sanctioned_load_kw: float = Field(gt=0, le=1000)
    proposed_capacity_kw: float = Field(gt=0, le=1000)
    owns_rooftop: bool
    has_grid_connection: bool
    installer_empanelled: bool
