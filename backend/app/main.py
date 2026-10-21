
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.applications import router as applications_router
from app.api.workflow import router as workflows_router


app = FastAPI(
    title="Rooftop Solar Subsidy Agent",
    description="Backend API for rooftop solar subsidy eligibility and financial analysis.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(applications_router)
app.include_router(workflows_router)


@app.get("/")
def root():
    return {
        "message": "Rooftop Solar Subsidy Agent API",
        "status": "running",
    }


@app.get("/api/health")
def health():
    return {"status": "healthy"}


