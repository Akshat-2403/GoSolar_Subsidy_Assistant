import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.applications import router as applications_router
from app.api.workflow import router as workflows_router


app = FastAPI(
    title="Rooftop Solar Subsidy Agent",
    description="Policy-aware demo API for rooftop solar application evaluation.",
    version="0.2.0",
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(applications_router)
app.include_router(workflows_router)


@app.get("/")
def root():
    return {"message": "Rooftop Solar Subsidy Agent API", "status": "running"}


@app.get("/api/health")
def health():
    return {"status": "healthy"}

