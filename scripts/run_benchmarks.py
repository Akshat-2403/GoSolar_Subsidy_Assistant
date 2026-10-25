"""Run the four dashboard-assigned rooftop solar benchmark cases offline."""

from __future__ import annotations

import os
import sys
from contextlib import contextmanager
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY_ROOT / "backend"))

from app.schemas.workflow import WorkflowRequest  # noqa: E402
from app.services.workflow import (  # noqa: E402
    _evaluate_workflow_core,
    _submit_approved_workflow,
)


def _base_payload() -> dict[str, object]:
    return {
        "applicant_name": "Synthetic Benchmark Applicant",
        "state": "Maharashtra",
        "applicant_type": "owner",
        "consumer_number": "MH12345678",
        "discom_code": "MSEDCL",
        "sanctioned_load_kw": 5.0,
        "proposed_capacity_kw": 3.0,
        "owns_rooftop": True,
        "has_grid_connection": True,
        "roof_shadow_clearance_declared": True,
        "installer_id": "BENCHMARK-VENDOR",
        "installer_empanelled": True,
        "landlord_noc_uploaded": False,
        "required_documents": ["Electricity bill"],
        "uploaded_documents": ["Electricity bill"],
        "tariff_inr_per_kwh": 8.0,
        "average_cost_per_kw": 60_000.0,
        "rooftop_area_sqft": 350.0,
    }


@contextmanager
def _local_mock_portal_only():
    """Ensure the benchmark never calls a configured external portal."""
    configured_url = os.environ.pop("MOCK_PORTAL_URL", None)
    try:
        yield
    finally:
        if configured_url is not None:
            os.environ["MOCK_PORTAL_URL"] = configured_url


def _case(case_id: str, payload: dict[str, object], expected_label: str) -> tuple[str, str, str, str, bool]:
    request = WorkflowRequest.model_validate(payload)
    workflow = _evaluate_workflow_core(request, f"BENCH-{case_id}")
    actual = ""
    expected_subsidy = 78_000
    actual_subsidy = workflow.financial_summary.estimated_subsidy_inr if workflow.financial_summary else 0
    feeder = "Awaiting DISCOM sanction"

    if case_id == "TC1":
        actual = "Draft application" if workflow.state == "human_review_required" else workflow.state
    elif case_id == "TC2":
        actual = "Flagged" if workflow.state == "vendor_warning" else workflow.state
    elif case_id == "TC3":
        actual = "Consent needed" if workflow.state == "consent_needed" else workflow.state
    elif case_id == "TC4":
        with _local_mock_portal_only():
            receipt = _submit_approved_workflow(workflow)
        receipt_event = next((event.message for event in receipt.events if event.node == "portal_submission"), "")
        verification_event = next((event for event in receipt.events if event.node == "application_id_verification"), None)
        has_mock_receipt = receipt.state == "submitted" and bool(receipt.application_id)
        independently_verified = verification_event is not None and verification_event.status == "completed"
        explicit_no_promise = "not a subsidy approval" in receipt_event.casefold()
        actual = "Subsidy not promised" if has_mock_receipt and independently_verified and explicit_no_promise else "Unexpected subsidy claim"
        feeder = "Receipt only; DISCOM sanction pending"

    passed = actual == expected_label
    return actual, str(expected_subsidy), str(actual_subsidy), feeder, passed


def main() -> int:
    cases: list[tuple[str, str, dict[str, object], str]] = []
    eligible = _base_payload()
    cases.append(("TC1", "5.0 kW", eligible, "Draft application"))

    vendor = _base_payload()
    vendor["installer_empanelled"] = False
    cases.append(("TC2", "5.0 kW", vendor, "Flagged"))

    tenant = _base_payload()
    tenant.update({"applicant_type": "tenant", "owns_rooftop": False})
    cases.append(("TC3", "5.0 kW", tenant, "Consent needed"))

    application_id = _base_payload()
    cases.append(("TC4", "5.0 kW", application_id, "Subsidy not promised"))

    results = []
    for case_id, load, payload, expected in cases:
        try:
            actual, expected_subsidy, actual_subsidy, feeder, passed = _case(case_id, payload, expected)
        except Exception as error:  # A failed case must be visible and fail the process.
            actual, expected_subsidy, actual_subsidy, feeder, passed = f"ERROR: {error}", "78,000", "-", "Unknown", False
        results.append((case_id, load, str(payload["proposed_capacity_kw"]), expected_subsidy, actual_subsidy, feeder, actual, passed))

    headers = ("Case ID", "Input Load", "Recommended Size", "Subsidy Expected", "Subsidy Actual", "Feeder Check", "Actual Verdict", "Status")
    rows = [headers, *[(
        case_id, load, size, expected_subsidy, actual_subsidy, feeder, actual,
        f"\033[32mPASS\033[0m" if passed else f"\033[31mFAIL\033[0m",
    ) for case_id, load, size, expected_subsidy, actual_subsidy, feeder, actual, passed in results]]
    widths = [max(len(str(row[index]).replace("\033[32m", "").replace("\033[31m", "").replace("\033[0m", "")) for row in rows) for index in range(len(headers))]
    line = "+-" + "-+-".join("-" * width for width in widths) + "-+"
    print(line)
    for index, row in enumerate(rows):
        rendered = "| " + " | ".join(str(value).ljust(widths[column]) for column, value in enumerate(row)) + " |"
        print(rendered)
        if index == 0:
            print(line)
    print(line)
    return 0 if all(result[-1] for result in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
