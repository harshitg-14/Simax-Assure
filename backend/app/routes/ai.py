import os
import json
from fastapi import APIRouter
from app.db import SessionLocal
from app.models import Expense, Budget, Department
from app.services.query_classifier import classify_query
from app.services.slm_service import ask_slm

from google import genai

router = APIRouter(prefix="/ai", tags=["AI"])

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY"),
    http_options={"api_version": "v1"}
)


def build_gemini_context(db) -> str:
    expenses    = db.query(Expense).all()
    budgets     = db.query(Budget).all()
    departments = db.query(Department).all()

    total_expense = sum(float(e.amount) for e in expenses) if expenses else 0
    total_budget  = sum(float(b.allocated_budget) for b in budgets) if budgets else 0

    dept_map = {}
    for e in expenses:
        dept_map[e.department_id] = dept_map.get(e.department_id, 0) + float(e.amount)

    dept_context = "\n".join(
        f"- {d.department_name}: {dept_map.get(d.department_id, 0)}"
        for d in departments
    )

    vendor_map = {}
    for e in expenses:
        if e.vendor:
            vendor_map[e.vendor] = vendor_map.get(e.vendor, 0) + float(e.amount)

    top_vendors = sorted(vendor_map.items(), key=lambda x: x[1], reverse=True)[:5]
    vendor_context = "\n".join(f"- {v}: {a}" for v, a in top_vendors)

    return f"""Total Budget: {total_budget}
Total Expense: {total_expense}
Department Spend:
{dept_context}
Top Vendors:
{vendor_context}"""


def call_gemini(query: str, context: str) -> dict:
    prompt = f"""You are a financial AI assistant.

Return ONLY raw JSON. No markdown. No explanation.

Format:
{{
  "summary": "...",
  "insight": "...",
  "risk": "...",
  "recommendation": "..."
}}

DATA:
{context}

User Question: {query}"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.replace("```json", "").replace("```", "").strip()

    try:
        return {**json.loads(raw), "model": "gemini"}
    except Exception:
        return {
            "summary": "AI response parsing failed",
            "insight": raw,
            "risk": "Unstructured output",
            "recommendation": "Check AI formatting",
            "model": "gemini"
        }


@router.get("/ask")
def ask_ai(query: str):
    db = SessionLocal()
    try:
        query_type = classify_query(query)

        # ── Simple query → try SLM first ─────────────────────────
        if query_type == "simple":
            slm_result = ask_slm(query, db)
            if slm_result is not None:
                return slm_result
            # SLM offline → fall back to Gemini silently

        # ── Complex query or SLM fallback → Gemini ───────────────
        context = build_gemini_context(db)
        return call_gemini(query, context)

    except Exception as e:
        return {
            "summary": "Error occurred",
            "insight": str(e),
            "risk": "System failure",
            "recommendation": "Check backend logs",
            "model": "error"
        }
    finally:
        db.close()
