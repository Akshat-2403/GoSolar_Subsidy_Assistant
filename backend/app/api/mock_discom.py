import json
import os
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse


router = APIRouter(prefix="/api/mock-discom", tags=["Mock DISCOM portal"])


def _portal_url() -> str:
    return os.getenv("MOCK_PORTAL_URL", "").rstrip("/")


@router.get("/portal", response_class=HTMLResponse)
def portal():
    upstream = _portal_url()
    if upstream:
        try:
            with urlopen(f"{upstream}/", timeout=5) as response:
                page = response.read().decode("utf-8", errors="replace")
            page = page.replace("fetch('/api/applications'", "fetch('/api/mock-discom/applications'")
            page = page.replace('fetch("/api/applications"', 'fetch("/api/mock-discom/applications"')
            return HTMLResponse(page)
        except (HTTPError, URLError, TimeoutError) as exc:
            raise HTTPException(status_code=502, detail="The configured mock DISCOM portal is unavailable.") from exc
    return HTMLResponse("""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GoSolar · Mock DISCOM Portal</title><style>body{font:16px system-ui;background:#f3f6f3;color:#203329;margin:0}header{background:#143d2b;color:#fff;padding:24px max(24px,calc((100% - 760px)/2))}main{max-width:760px;margin:36px auto;padding:24px;background:#fff;border:1px solid #dce6dc;border-radius:12px}small{color:#6d7c70}</style></head><body><header><strong>GoSolar · Mock DISCOM Portal</strong><div>Simulated rooftop solar filing target</div></header><main><h1>Mock portal is ready</h1><p>This route is served through the GoSolar API and does not expose a container address.</p><small>Applications are demonstrations only. No government system is contacted.</small></main></body></html>""")


@router.post("/applications")
def submit_to_portal(payload: dict):
    upstream = _portal_url()
    if upstream:
        request = Request(f"{upstream}/api/applications", data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urlopen(request, timeout=10) as response:
                return JSONResponse(status_code=response.status, content=json.loads(response.read()))
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            try:
                return JSONResponse(status_code=exc.code, content=json.loads(detail))
            except json.JSONDecodeError:
                raise HTTPException(status_code=exc.code, detail="Mock portal rejected the application.") from exc
        except (URLError, TimeoutError) as exc:
            raise HTTPException(status_code=502, detail="The configured mock DISCOM portal is unavailable.") from exc
    application_id = f"APP-SOL-DEMO-{uuid4().hex[:6].upper()}"
    return {**payload, "application_id": application_id, "status": "received", "received_at": datetime.now(timezone.utc).isoformat()}
