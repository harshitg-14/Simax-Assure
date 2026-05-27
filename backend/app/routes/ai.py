import os
import json
from fastapi import APIRouter
from sqlalchemy import func
from app.db import SessionLocal
from app.models import Expense, Budget, Department, Commitment
from app.services.query_classifier import classify_query
from app.services.slm_service import ask_slm

from google import genai

router = APIRouter(prefix="/ai", tags=["AI"])

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY"),
    http_options={"api_version": "v1"}
)


def build_gemini_context(db) -> str:
    """Aggregated summary only — no raw rows."""
    budgets     = db.query(Budget).all()
    departments = db.query(Department).all()

    total_budget  = sum(float(b.allocated_budget) for b in budgets)
    total_expense = db.query(func.coalesce(func.sum(Expense.amount), 0)).scalar() or 0
    total_expense = float(total_expense)

    # Per-department: budget vs spent
    dept_lines = []
    for d in departments:
        dept_budget = sum(float(b.allocated_budget) for b in budgets if b.department_id == d.department_id)
        dept_spent  = db.query(func.coalesce(func.sum(Expense.amount), 0))\
                        .filter(Expense.department_id == d.department_id).scalar() or 0
        dept_lines.append(f"- {d.department_name}: budget={dept_budget:.0f}, spent={float(dept_spent):.0f}")

    # Top 5 vendors by total spend
    vendor_rows = db.query(Expense.vendor, func.sum(Expense.amount).label("total"))\
                    .filter(Expense.vendor != None)\
                    .group_by(Expense.vendor)\
                    .order_by(func.sum(Expense.amount).desc())\
                    .limit(5).all()
    vendor_lines = [f"- {v}: {float(t):.0f}" for v, t in vendor_rows]

    # Pending approvals count
    pending_expenses    = db.query(func.count(Expense.expense_id)).filter(Expense.status == "pending").scalar() or 0
    pending_commitments = db.query(func.count(Commitment.commitment_id)).filter(Commitment.status == "pending").scalar() or 0

    return f"""Total Budget: {total_budget:.0f}
Total Spent: {total_expense:.0f}
Remaining: {total_budget - total_expense:.0f}
Utilization: {(total_expense / total_budget * 100) if total_budget else 0:.1f}%
Pending Approvals: {pending_expenses + pending_commitments}

Department Summary:
{chr(10).join(dept_lines)}

Top Vendors by Spend:
{chr(10).join(vendor_lines) if vendor_lines else "No vendor data"}"""


def _try_direct_answer(query: str, db) -> dict | None:
    """
    For simple lookups, answer directly from the DB without calling any AI.
    Returns a response dict if handled, None if Gemini should take over.
    """
    q = query.lower()

    # Total budget
    if any(w in q for w in ["total budget", "overall budget", "how much budget"]):
        total = db.query(func.coalesce(func.sum(Budget.allocated_budget), 0)).scalar() or 0
        return _db_answer(f"Total allocated budget is ₹{float(total):,.0f}.")

    # Total spent / expenditure
    if any(w in q for w in ["total spent", "total expense", "total expenditure", "how much spent", "how much has been spent"]):
        total = db.query(func.coalesce(func.sum(Expense.amount), 0)).scalar() or 0
        return _db_answer(f"Total expenditure so far is ₹{float(total):,.0f}.")

    # Pending approvals
    if any(w in q for w in ["pending", "awaiting approval", "pending approval"]):
        pe = db.query(func.count(Expense.expense_id)).filter(Expense.status == "pending").scalar() or 0
        pc = db.query(func.count(Commitment.commitment_id)).filter(Commitment.status == "pending").scalar() or 0
        return _db_answer(f"There are {pe + pc} items pending approval ({pe} expenses, {pc} commitments).")

    # Number of departments
    if any(w in q for w in ["how many department", "number of department"]):
        count = db.query(func.count(Department.department_id)).scalar() or 0
        return _db_answer(f"There are {count} departments in the system.")

    # Remaining budget
    if any(w in q for w in ["remaining budget", "budget left", "how much left", "budget remaining"]):
        budget  = float(db.query(func.coalesce(func.sum(Budget.allocated_budget), 0)).scalar() or 0)
        spent   = float(db.query(func.coalesce(func.sum(Expense.amount), 0)).scalar() or 0)
        remaining = budget - spent
        return _db_answer(f"Remaining budget is ₹{remaining:,.0f} out of ₹{budget:,.0f} allocated ({spent/budget*100:.1f}% utilized)." if budget else "No budget data available.")

    return None


def _db_answer(text: str) -> dict:
    return {
        "summary":        text,
        "insight":        text,
        "risk":           "None",
        "recommendation": "No action needed.",
        "model":          "db-direct",
    }


def call_gemini(query: str, context: str) -> dict:
    prompt = f"""You are a financial AI assistant for Simax Assure.
Return ONLY raw JSON. No markdown. No explanation.

Format:
{{
  "summary": "...",
  "insight": "...",
  "risk": "...",
  "recommendation": "..."
}}

FINANCIAL DATA:
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
            "summary":        "AI response parsing failed",
            "insight":        raw,
            "risk":           "Unstructured output",
            "recommendation": "Check AI formatting",
            "model":          "gemini",
        }


@router.get("/ask")
def ask_ai(query: str):
    db = SessionLocal()
    try:
        query_type = classify_query(query)

        # Simple query → try direct DB answer first (zero tokens)
        if query_type == "simple":
            direct = _try_direct_answer(query, db)
            if direct:
                return direct

            # DB couldn't answer → try local SLM
            slm_result = ask_slm(query, db)
            if slm_result is not None:
                return slm_result

        # Complex query or SLM offline → Gemini with lean context
        context = build_gemini_context(db)
        return call_gemini(query, context)

    except Exception as e:
        return {
            "summary":        "Error occurred",
            "insight":        str(e),
            "risk":           "System failure",
            "recommendation": "Check backend logs",
            "model":          "error",
        }
    finally:
        db.close()
