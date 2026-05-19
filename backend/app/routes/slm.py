import json
from fastapi import APIRouter
from app.db import SessionLocal
from app.services.slm_service import ask_slm, build_context
from app.services.query_classifier import classify_query, get_routing_reason

router = APIRouter(prefix="/slm", tags=["SLM"])


@router.get("/query")
def slm_query(query: str):
    """Send a query directly to local Mistral via Ollama."""
    db = SessionLocal()
    try:
        result = ask_slm(query, db)
        if result is None:
            return {
                "summary": "SLM unavailable",
                "insight": "Ollama is not running. Start it with: ollama serve",
                "risk": "None",
                "recommendation": "Run: ollama serve && ollama pull mistral",
                "model": "slm_offline"
            }
        return result
    finally:
        db.close()


@router.get("/classify")
def classify(query: str):
    """Debug endpoint — shows how a query would be classified."""
    return {
        "query": query,
        "classification": classify_query(query),
        "routing": get_routing_reason(query)
    }


@router.get("/status")
def slm_status():
    """Check if Ollama + Mistral is running."""
    import requests as req
    try:
        resp = req.get("http://127.0.0.1:11434/api/tags", timeout=5)
        models = [m["name"] for m in resp.json().get("models", [])]
        mistral_ready = any("mistral" in m for m in models)
        return {
            "ollama": "running",
            "models": models,
            "mistral_ready": mistral_ready,
            "status": "ready" if mistral_ready else "mistral not pulled — run: ollama pull mistral"
        }
    except Exception:
        return {
            "ollama": "offline",
            "mistral_ready": False,
            "status": "Ollama not running — install from ollama.com and run: ollama serve"
        }
