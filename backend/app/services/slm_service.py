import json
import requests
from app.models import Expense, Budget, Department

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "mistral"
TIMEOUT = 60


def build_context(db) -> str:
    expenses    = db.query(Expense).all()
    budgets     = db.query(Budget).all()
    departments = db.query(Department).all()

    total_expense = sum(float(e.amount) for e in expenses) if expenses else 0
    total_budget  = sum(float(b.allocated_budget) for b in budgets) if budgets else 0
    remaining     = total_budget - total_expense

    dept_map = {}
    for e in expenses:
        dept_map[e.department_id] = dept_map.get(e.department_id, 0) + float(e.amount)

    dept_lines = "\n".join(
        f"- {d.department_name}: spent {dept_map.get(d.department_id, 0)}"
        for d in departments
    )

    vendor_map = {}
    for e in expenses:
        if e.vendor:
            vendor_map[e.vendor] = vendor_map.get(e.vendor, 0) + float(e.amount)

    top_vendors = sorted(vendor_map.items(), key=lambda x: x[1], reverse=True)[:3]
    vendor_lines = "\n".join(f"- {v}: {a}" for v, a in top_vendors)

    return f"""Total Budget: {total_budget}
Total Spent: {total_expense}
Remaining: {remaining}
Departments:
{dept_lines}
Top Vendors:
{vendor_lines}"""


def ask_slm(query: str, db) -> dict:
    context = build_context(db)

    prompt = f"""You are a financial assistant for Simax Assure, an internal financial management platform.

Financial Data:
{context}

User Question: {query}

Reply with ONLY raw JSON, no markdown, no explanation:
{{"summary": "...", "insight": "...", "risk": "...", "recommendation": "..."}}"""

    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.3, "num_predict": 400}
            },
            timeout=TIMEOUT
        )
        response.raise_for_status()
        raw = response.json().get("response", "").strip()

        if raw.startswith("```"):
            raw = raw.replace("```json", "").replace("```", "").strip()

        try:
            return {**json.loads(raw), "model": "slm"}
        except Exception:
            return {
                "summary": raw[:200] if raw else "No response",
                "insight": "SLM returned unstructured output",
                "risk": "Low",
                "recommendation": "Rephrase your question",
                "model": "slm"
            }

    except requests.exceptions.ConnectionError:
        return None  # signals caller to fall back to Gemini

    except Exception as e:
        return None
