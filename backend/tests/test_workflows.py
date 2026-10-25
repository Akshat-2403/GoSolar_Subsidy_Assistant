from fastapi.testclient import TestClient

from app.main import app
from app.portal.mock_portal import app as portal_app


client = TestClient(app)
portal_client = TestClient(portal_app)


def payload(**overrides):
    base = {
        "applicant_name": "Asha Sharma",
        "state": "Maharashtra",
        "applicant_type": "owner",
        "consumer_number": "ABCD12345678",
        "discom_code": "MSEDCL",
        "sanctioned_load_kw": 5,
        "proposed_capacity_kw": 3,
        "owns_rooftop": True,
        "has_grid_connection": True,
        "installer_id": "VENDOR-001",
        "installer_empanelled": True,
        "landlord_noc_uploaded": False,
        "required_documents": ["Electricity bill"],
        "uploaded_documents": ["Electricity Bill"],
    }
    return {**base, **overrides}


def evaluate(**overrides):
    response = client.post("/api/workflows/evaluate", json=payload(**overrides))
    assert response.status_code == 200, response.text
    return response.json()


def test_valid_workflow_waits_at_human_review_and_calculates():
    data = evaluate()
    assert data["state"] == "human_review_required"
    assert data["human_approval_required"] is True
    assert data["financial_summary"]["estimated_subsidy_inr"] == 78000
    assert any(event["node"] == "human_review" and event["status"] == "waiting" for event in data["events"])
    feeder_event = next(event for event in data["events"] if event["node"] == "net_metering_feasibility")
    assert feeder_event["status"] == "waiting"
    assert "transformer capacity are not available" in feeder_event["message"]


def test_health_alias_and_offline_policy_mode(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    from app.rag.retriever import policy_reasoning, retrieve_policy_evidence

    assert client.get("/health").json() == {"status": "healthy"}
    assert client.get("/api/health").json() == {"status": "healthy"}
    evidence = retrieve_policy_evidence(
        "residential PM Surya Ghar CFA",
        rule_applied="offline_test",
        source_ids={"mnre-pmsg"},
    )
    assert evidence and evidence[0]["source_url"].startswith("https://")
    assert "Offline policy retrieval" in policy_reasoning("test query", evidence)

def test_policy_evidence_has_citations_before_human_gate():
    data = evaluate()
    evidence = [item for item in data["evidence_log"] if item["source_url"]]
    assert any(item["rule_applied"] == "pm_surya_ghar_cfa" for item in evidence)
    assert any(item["rule_applied"] == "discom_connectivity" for item in evidence)
    assert all(item["evidence_id"] and item["source_title"] and item["verbatim_snippet"] for item in evidence)
    assert any(event["node"] == "policy_evidence" for event in data["events"])

def test_tenant_without_noc_is_blocked():
    data = evaluate(applicant_type="tenant")
    assert data["state"] == "consent_needed"
    assert any("NOC" in issue for issue in data["issues"])


def test_unregistered_vendor_is_blocked():
    data = evaluate(installer_empanelled=False)
    assert data["state"] == "vendor_warning"
    assert data["can_proceed"] is False


def test_capacity_above_sanctioned_load_is_blocked():
    data = evaluate(proposed_capacity_kw=6, sanctioned_load_kw=3)
    assert data["state"] == "pending_items"
    assert any("exceeds sanctioned load" in issue for issue in data["issues"])


def test_capacity_above_roof_area_limit_is_blocked():
    data = evaluate(proposed_capacity_kw=3.6, rooftop_area_sqft=350)
    assert data["state"] == "pending_items"
    assert any("Roof area supports at most 3.50 kW" in issue for issue in data["issues"])
    assert any(item["rule_applied"] == "roof_capacity_check" and item["outcome"] == "failed" for item in data["evidence_log"])


def test_missing_documents_are_reported_case_insensitively():
    data = evaluate(required_documents=["Electricity bill", "Identity proof"], uploaded_documents=["electricity BILL"])
    assert data["state"] == "pending_items"
    assert data["missing_documents"] == ["Identity proof"]


def test_approval_is_required_and_submits_to_mock_portal():
    data = evaluate()
    workflow_id = data["workflow_id"]
    denied = client.post(f"/api/workflows/{workflow_id}/approve", json={"human_approved": False})
    assert denied.status_code == 403
    approved = client.post(f"/api/workflows/{workflow_id}/approve", json={"human_approved": True})
    assert approved.status_code == 200
    result = approved.json()
    assert result["state"] == "submitted"
    assert result["application_id"].startswith("APP-SOL-2026-")
    assert any(event["node"] == "portal_submission" for event in result["events"])
    receipt_event = next(event for event in result["events"] if event["node"] == "portal_submission")
    assert "not a subsidy approval" in receipt_event["message"]
    verification_event = next(event for event in result["events"] if event["node"] == "application_id_verification")
    assert verification_event["status"] == "completed"
    assert result["application_id"] in verification_event["message"]


def test_blocked_workflow_cannot_be_submitted():
    data = evaluate(applicant_type="tenant")
    response = client.post(f"/api/workflows/{data['workflow_id']}/approve", json={"human_approved": True})
    assert response.status_code == 409


def test_workflow_event_stream_replays_events():
    data = evaluate()
    response = client.get(f"/api/workflows/{data['workflow_id']}/events")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert '"node": "policy_checks"' in response.text
    assert "event: complete" in response.text


def test_portal_rejects_capacity_above_load():
    response = portal_client.post("/api/applications", json={
        "applicant_name": "Asha Sharma",
        "consumer_number": "ABCD12345678",
        "discom_code": "MSEDCL",
        "state": "Maharashtra",
        "planned_capacity_kw": 6,
        "sanctioned_load_kw": 3,
        "vendor_id": "VENDOR-001",
        "vendor_empanelled": True,
    })
    assert response.status_code == 422


def test_mock_portal_submission_key_prevents_duplicate_receipts():
    request = {
        "applicant_name": "Asha Sharma",
        "consumer_number": "ABCD12345678",
        "discom_code": "MSEDCL",
        "state": "Maharashtra",
        "planned_capacity_kw": 3,
        "sanctioned_load_kw": 5,
        "vendor_id": "VENDOR-001",
        "vendor_empanelled": True,
        "submission_key": "BENCHMARK-IDEMPOTENCY-001",
    }
    first = portal_client.post("/api/applications", json=request)
    second = portal_client.post("/api/applications", json=request)
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["application_id"] == second.json()["application_id"]



def test_portal_503_queues_approved_submission_and_can_retry(monkeypatch):
    monkeypatch.setenv("MOCK_PORTAL_FAIL_STATUS", "503")
    data = evaluate()
    response = client.post(f"/api/workflows/{data['workflow_id']}/approve", json={"human_approved": True})
    assert response.status_code == 200
    queued = response.json()
    assert queued["state"] == "portal_queued"
    assert queued["application_id"] is None

    monkeypatch.delenv("MOCK_PORTAL_FAIL_STATUS")
    retried = client.post(f"/api/workflows/{data['workflow_id']}/approve", json={"human_approved": True})
    assert retried.status_code == 200
    assert retried.json()["state"] == "submitted"



def test_external_portal_rest_submission(monkeypatch):
    import json
    import urllib.request

    from app.services.workflow import _post_to_portal

    monkeypatch.setenv("MOCK_PORTAL_URL", "https://portal.example.test")
    calls = []

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return json.dumps({"application_id": "APP-SOL-2026-REST1"}).encode()

    def fake_urlopen(request, timeout):
        calls.append((request.full_url, json.loads(request.data), timeout))
        return Response()

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    result = _post_to_portal({
        "applicant_name": "Asha Sharma",
        "consumer_number": "ABCD12345678",
        "discom_code": "MSEDCL",
        "state": "Maharashtra",
        "proposed_capacity_kw": 3,
        "sanctioned_load_kw": 5,
        "installer_id": "VENDOR-001",
        "installer_empanelled": True,
    })
    assert result["application_id"] == "APP-SOL-2026-REST1"
    assert calls[0][0] == "https://portal.example.test/api/applications"
    assert calls[0][1]["planned_capacity_kw"] == 3


def test_external_portal_retries_503(monkeypatch):
    import json
    import time
    import urllib.request
    from urllib.error import HTTPError

    from app.services.workflow import _post_to_portal

    monkeypatch.setenv("MOCK_PORTAL_URL", "https://portal.example.test")
    monkeypatch.setattr(time, "sleep", lambda _seconds: None)
    calls = []

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return json.dumps({"application_id": "APP-SOL-2026-RETRY"}).encode()

    def fake_urlopen(request, timeout):
        calls.append(request.full_url)
        if len(calls) < 3:
            raise HTTPError(request.full_url, 503, "maintenance", {}, None)
        return Response()

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    result = _post_to_portal({
        "applicant_name": "Asha Sharma",
        "consumer_number": "ABCD12345678",
        "discom_code": "MSEDCL",
        "state": "Maharashtra",
        "proposed_capacity_kw": 3,
        "sanctioned_load_kw": 5,
        "installer_id": "VENDOR-001",
        "installer_empanelled": True,
    })
    assert len(calls) == 3
    assert result["application_id"] == "APP-SOL-2026-RETRY"

