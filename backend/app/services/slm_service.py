import json
import logging
import requests
from app.models import Expense, Budget, Department

# Use 127.0.0.1 explicitly — on Windows, localhost can resolve to IPv6 (::1)
# which may not be what Ollama is listening on.
OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
OLLAMA_MODEL = "mistral"
TIMEOUT = 120  # Mistral cold-start on first request can take 60-90s on CPU

logger = logging.getLogger(__name__)


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

    logger.info("SLM request: model=%s url=%s", OLLAMA_MODEL, OLLAMA_URL)
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
        logger.info("SLM response status: %s", response.status_code)
        response.raise_for_status()
        raw = response.json().get("response", "").strip()
        logger.info("SLM raw response (first 200 chars): %s", raw[:200])

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

    except requests.exceptions.ConnectionError as e:
        logger.error("SLM ConnectionError — Ollama not reachable at %s: %s", OLLAMA_URL, e)
        return None  # signals caller to fall back to Gemini

    except requests.exceptions.Timeout:
        logger.error("SLM Timeout — model took longer than %ss to respond", TIMEOUT)
        return None

    except requests.exceptions.HTTPError as e:
        # 404 = model not found (wrong model name), 500 = Ollama internal error
        logger.error("SLM HTTPError %s — body: %s", e.response.status_code, e.response.text[:300])
        return None

    except Exception as e:
        logger.error("SLM unexpected error: %s: %s", type(e).__name__, e)
        return None
