
from fastapi import APIRouter

from app.schemas.application import ApplicationRequest
from app.services.eligibility import validate_application

router = APIRouter(
    prefix="/api/applications",
    tags=["Applications"],
)


@router.post("/validate")
def validate(application: ApplicationRequest):
    return validate_application(application)
