from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_benchmark_status_lists_five_cases_and_specialists():
    result = client.get("/api/benchmark/status").json()
    assert len(result["cases"]) == 5
    assert {"supervisor", "grid_feasibility", "subsidy_optimizer", "policy_compliance", "portal_submission"} <= set(result["agents"])


def test_synthetic_benchmarks_pass_expected_gates():
    for case_id in ("TC1", "TC2", "TC3", "TC4", "TC5"):
        result = client.post("/api/benchmark/run", json={"case_id": case_id})
        assert result.status_code == 200
        assert result.json()["passed"] is True
        assert result.json()["synthetic"] is True


def test_unknown_benchmark_is_rejected():
    assert client.post("/api/benchmark/run", json={"case_id": "TC99"}).status_code == 404
