from dotenv import load_dotenv
load_dotenv()

import os
import json
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import extract
from google import genai
from app.models import Expense, Budget, Alert

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY"),
    http_options={"api_version": "v1"}
)


def _already_alerted(db, budget_id: int, alert_type: str) -> bool:
    """Return True if an AI alert of this type was created in the last 24 hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    existing = db.query(Alert).filter(
        Alert.budget_id == budget_id,
        Alert.category == "ai_generated",
        Alert.alert_code == alert_type,
        Alert.created_at >= cutoff
    ).first()
    return existing is not None


def _call_gemini(context: str) -> dict:
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=context
    )
    text = response.text.strip()
    if text.startswith("```"):
        text = text.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(text)
    except Exception:
        return {
            "summary": "Budget alert",
            "insight": text,
            "risk": "High spending detected",
            "recommendation": "Review expenses"
        }


# ─────────────────────────────────────────────────────────────
# REACTIVE ALERT — fires only when budget is actually exceeded
# ─────────────────────────────────────────────────────────────
def generate_ai_alert(db, expense):
    try:
        budget = db.query(Budget).filter(
            Budget.budget_id == expense.budget_id
        ).first()
        if not budget:
            return None

        total_expense = sum(
            float(e.amount)
            for e in db.query(Expense)
            .filter(Expense.budget_id == budget.budget_id).all()
        )
        allocated = float(budget.allocated_budget)

        # ── Guard: only proceed if budget is actually exceeded ──
        if total_expense <= allocated:
            return None

        # ── Dedup: skip if same alert already created today ─────
        if _already_alerted(db, budget.budget_id, "AI_REACTIVE"):
            return None

        overrun     = total_expense - allocated
        overrun_pct = (overrun / allocated) * 100 if allocated else 0

        if overrun_pct > 25:
            severity, score = "critical", 90
        elif overrun_pct > 10:
            severity, score = "high", 70
        else:
            severity, score = "medium", 50

        context = f"""You are a financial risk AI.
Return ONLY raw JSON. No markdown.

Format:
{{"summary": "...", "insight": "...", "risk": "...", "recommendation": "..."}}

Budget: {allocated}
Total Expense: {total_expense}
Overrun: {overrun_pct:.2f}%"""

        parsed = _call_gemini(context)

        return {
            "summary":        parsed.get("summary"),
            "insight":        parsed.get("insight"),
            "risk":           parsed.get("risk"),
            "recommendation": parsed.get("recommendation"),
            "severity":       severity,
            "score":          score,
            "type":           "REACTIVE"
        }

    except Exception as e:
        return {
            "summary": "AI Error", "insight": str(e),
            "risk": "System issue", "recommendation": "Check logs",
            "severity": "low", "score": 10, "type": "REACTIVE"
        }


# ─────────────────────────────────────────────────────────────
# PREDICTIVE ALERT — fires only when 30-day projection exceeds budget
# ─────────────────────────────────────────────────────────────
def generate_predictive_alert(db, expense):
    try:
        budget = db.query(Budget).filter(
            Budget.budget_id == expense.budget_id
        ).first()
        if not budget:
            return None

        allocated = float(budget.allocated_budget)
        today     = date.today()

        month_expenses = db.query(Expense).filter(
            Expense.budget_id == budget.budget_id,
            extract("month", Expense.expense_date) == today.month,
            extract("year",  Expense.expense_date) == today.year
        ).all()

        if not month_expenses:
            return None

        total_month = sum(float(e.amount) for e in month_expenses)
        days_passed = today.day if today.day > 0 else 1
        avg_daily   = total_month / days_passed
        projected   = avg_daily * 30

        # ── Guard: only proceed if projection actually exceeds budget ──
        if projected <= allocated:
            return None

        # ── Dedup: skip if same alert already created today ───────────
        if _already_alerted(db, budget.budget_id, "AI_PREDICTIVE"):
            return None

        over_pct = ((projected - allocated) / allocated) * 100 if allocated else 0

        if over_pct > 25:
            severity, score = "critical", 85
        elif over_pct > 10:
            severity, score = "high", 65
        else:
            severity, score = "medium", 45

        context = f"""You are a predictive financial AI.
Return ONLY raw JSON. No markdown.

Format:
{{"summary": "...", "insight": "...", "risk": "...", "recommendation": "..."}}

Allocated Budget: {allocated}
Current Month Spend: {total_month}
Projected 30-day Spend: {projected:.2f}
Daily Average: {avg_daily:.2f}"""

        parsed = _call_gemini(context)

        return {
            "summary":        parsed.get("summary"),
            "insight":        parsed.get("insight"),
            "risk":           parsed.get("risk"),
            "recommendation": parsed.get("recommendation"),
            "severity":       severity,
            "score":          score,
            "type":           "PREDICTIVE"
        }

    except Exception as e:
        return {
            "summary": "Prediction Error", "insight": str(e),
            "risk": "System issue", "recommendation": "Check logs",
            "severity": "low", "score": 10, "type": "PREDICTIVE"
        }
