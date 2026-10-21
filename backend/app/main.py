
from fastapi import FastAPI

app = FastAPI(
    title="Rooftop Solar Subsidy Agent",
    description="Backend API for rooftop solar subsidy eligibility and financial analysis.",
    version="0.1.0",
)


@app.get("/")
def root():
    return {
        "message": "Rooftop Solar Subsidy Agent API",
        "status": "running",
    }


@app.get("/api/health")
def health():
    return {"status": "healthy"}
