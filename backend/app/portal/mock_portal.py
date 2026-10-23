import os
import re
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field


app = FastAPI(
    title="Rooftop Solar Mock DISCOM Portal",
    description="Standalone simulated net-metering application portal.",
    version="0.1.0",
)


class PortalApplication(BaseModel):
    applicant_name: str = Field(min_length=2, max_length=100)
    consumer_number: str = Field(min_length=8, max_length=16)
    discom_code: str
    state: str
    planned_capacity_kw: float = Field(gt=0, le=1000)
    sanctioned_load_kw: float = Field(gt=0, le=1000)
    vendor_id: str
    vendor_empanelled: bool


_records: dict[str, dict] = {}


@app.get("/", response_class=HTMLResponse)
def portal_home():
    return """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>DISCOM Rooftop Solar Portal</title>
<style>
body{font:16px system-ui;background:#f3f6f3;color:#203329;margin:0}
header{background:#143d2b;color:#fff;padding:24px max(24px,calc((100% - 980px)/2))}
main{max-width:980px;margin:36px auto;padding:0 20px;display:grid;grid-template-columns:1fr 300px;gap:22px}
.card{background:#fff;border:1px solid #dce6dc;border-radius:12px;padding:24px}
label{display:block;font-size:13px;font-weight:650;margin:15px 0 6px}
input{width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd8cc;border-radius:7px}
button{margin-top:20px;padding:12px 18px;border:0;border-radius:7px;background:#247748;color:white;font-weight:700}
small{color:#6d7c70;line-height:1.6}.tag{color:#277248;font-weight:700}
#result{margin-top:16px;padding:12px;background:#edf7ef;border-radius:7px;display:none}
@media(max-width:760px){main{grid-template-columns:1fr}}
</style></head><body><header><strong>State DISCOM · Rooftop Solar Applications</strong><div>Net metering and subsidy registration</div></header>
<main><section class="card"><span class="tag">NEW APPLICATION</span><h1>Rooftop solar registration</h1>
<p>Submit a simulated application for the demonstration portal.</p>
<form id="portal-form">
<label>Applicant name</label><input name="applicant_name" required minlength="2">
<label>Consumer number</label><input name="consumer_number" required minlength="8" maxlength="16">
<label>DISCOM code</label><input name="discom_code" required>
<label>State</label><input name="state" required>
<label>Planned capacity (kW)</label><input name="planned_capacity_kw" type="number" min="0.1" step="0.1" required>
<label>Sanctioned load (kW)</label><input name="sanctioned_load_kw" type="number" min="0.1" step="0.1" required>
<label>Empanelled vendor ID</label><input name="vendor_id" required>
<button>Submit simulated application</button></form><div id="result"></div></section>
<aside class="card"><h2>Portal information</h2><p><small>This is a demonstration portal. Application IDs and statuses are simulated and do not represent a government filing or subsidy approval.</small></p><p><small>Applications are checked for consumer number format, sanctioned load, and vendor empanelment.</small></p></aside></main>
<script>
const form=document.querySelector('#portal-form'),result=document.querySelector('#result');
form.addEventListener('submit',async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(form));d.planned_capacity_kw=Number(d.planned_capacity_kw);d.sanctioned_load_kw=Number(d.sanctioned_load_kw);d.vendor_empanelled=true;const r=await fetch('/api/applications',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(d)});const j=await r.json();result.style.display='block';result.textContent=r.ok?'Application received · '+j.application_id:(j.detail||'Submission failed')});
</script></body></html>"""


@app.post("/api/applications")
def create_application(request: PortalApplication):
    configured_failure = os.getenv("MOCK_PORTAL_FAIL_STATUS")
    if configured_failure == "503":
        raise HTTPException(status_code=503, detail="Simulated portal maintenance.")
    if not re.fullmatch(r"[A-Z0-9]{8,16}", request.consumer_number.upper()):
        raise HTTPException(status_code=422, detail="Invalid consumer number.")
    if request.planned_capacity_kw > request.sanctioned_load_kw:
        raise HTTPException(status_code=422, detail="Planned capacity exceeds sanctioned load.")
    if not request.vendor_empanelled:
        raise HTTPException(status_code=422, detail="Vendor is not empanelled.")
    application_id = f"APP-SOL-2026-{uuid4().hex[:5].upper()}"
    record = {
        **request.model_dump(),
        "application_id": application_id,
        "status": "received",
        "received_at": datetime.now(timezone.utc).isoformat(),
    }
    _records[application_id] = record
    return record


@app.get("/api/applications/{application_id}")
def read_application(application_id: str):
    record = _records.get(application_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Application not found.")
    return record

