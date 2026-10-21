
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def valid_application():
    return {
        "state": "Maharashtra",
        "consumer_category": "residential",
        "sanctioned_load_kw": 5,
        "proposed_capacity_kw": 3,
        "owns_rooftop": True,
        "has_grid_connection": True,
        "installer_empanelled": True,
    }


def test_valid_application_passes():
    response = client.post(
        "/api/applications/validate",
        json=valid_application(),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert data["issues"] == []


def test_capacity_exceeding_load_is_flagged():
    payload = valid_application()
    payload["sanctioned_load_kw"] = 1
    payload["proposed_capacity_kw"] = 5

    response = client.post(
        "/api/applications/validate",
        json=payload,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False
    assert any(
        "exceeds the sanctioned load" in issue
        for issue in data["issues"]
    )


def test_rooftop_ownership_is_required():
    payload = valid_application()
    payload["owns_rooftop"] = False

    response = client.post(
        "/api/applications/validate",
        json=payload,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False
    assert any("ownership" in issue for issue in data["issues"])


def test_grid_connection_is_required():
    payload = valid_application()
    payload["has_grid_connection"] = False

    response = client.post(
        "/api/applications/validate",
        json=payload,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False
    assert any("grid electricity connection" in issue for issue in data["issues"])


def test_installer_must_be_empanelled():
    payload = valid_application()
    payload["installer_empanelled"] = False

    response = client.post(
        "/api/applications/validate",
        json=payload,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False
    assert any("empanelled" in issue for issue in data["issues"])


def test_invalid_numeric_input_is_rejected():
    payload = valid_application()
    payload["proposed_capacity_kw"] = 0

    response = client.post(
        "/api/applications/validate",
        json=payload,
    )

    assert response.status_code == 422
