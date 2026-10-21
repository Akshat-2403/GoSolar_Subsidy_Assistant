
from app.schemas.application import ApplicationRequest


def validate_application(
    application: ApplicationRequest,
) -> dict:
    issues = []

    if not application.owns_rooftop:
        issues.append(
            "Rooftop ownership needs to be verified."
        )

    if not application.has_grid_connection:
        issues.append(
            "A grid electricity connection is required for this initial assessment."
        )

    if not application.installer_empanelled:
        issues.append(
            "The installer must be verified as empanelled."
        )

    if application.proposed_capacity_kw > application.sanctioned_load_kw:
        issues.append(
            "Proposed solar capacity exceeds the sanctioned load. "
            "Verify applicable technical and utility requirements."
        )

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "message": (
            "Initial checks passed."
            if not issues
            else "Some checks need attention."
        ),
    }
