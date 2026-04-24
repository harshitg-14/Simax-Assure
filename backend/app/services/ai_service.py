# backend/app/services/ai_service.py

import os
import json
from datetime import date
from sqlalchemy import extract
from google import genai
from app.models import Expense, Budget

# ✅ Gemini client
client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY"),
    http_options={"api_version": "v1"}
)


# =====================================================
# 🔴 REACTIVE ALERT (AFTER BUDGET EXCEEDED)
# =====================================================
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
            .filter(Expense.budget_id == budget.budget_id)
            .all()
        )

        allocated_budget = float(budget.allocated_budget)

        if total_expense > allocated_budget:

            overrun = total_expense - allocated_budget
            overrun_pct = (overrun / allocated_budget) * 100 if allocated_budget else 0

            # 🎯 Severity
            if overrun_pct > 25:
                severity = "Critical"
                score = 90
            elif overrun_pct > 10:
                severity = "High"
                score = 70
            else:
                severity = "Medium"
                score = 50

            context = f"""
You are a financial risk AI.

Return ONLY raw JSON.

Format:
{{
  "summary": "...",
  "insight": "...",
  "risk": "...",
  "recommendation": "..."
}}

Budget: {allocated_budget}
Total Expense: {total_expense}
Overrun: {overrun_pct:.2f}%
"""

            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=context
            )

            text = response.text.strip()

            if text.startswith("```"):
                text = text.replace("```json", "").replace("```", "").strip()

            try:
                parsed = json.loads(text)
            except:
                parsed = {
                    "summary": "Budget exceeded",
                    "insight": text,
                    "risk": "High spending",
                    "recommendation": "Review expenses"
                }

            return {
                "summary": parsed.get("summary"),
                "insight": parsed.get("insight"),
                "risk": parsed.get("risk"),
                "recommendation": parsed.get("recommendation"),
                "severity": severity,
                "score": score,
                "type": "REACTIVE"
            }

        return None

    except Exception as e:
        return {
            "summary": "AI Error",
            "insight": str(e),
            "risk": "System issue",
            "recommendation": "Check logs",
            "severity": "Low",
            "score": 10,
            "type": "REACTIVE"
        }


# =====================================================
# 🔮 PREDICTIVE ALERT (BEFORE BREACH)
# =====================================================
def generate_predictive_alert(db, expense):
    try:
        budget = db.query(Budget).filter(
            Budget.budget_id == expense.budget_id
        ).first()

        if not budget:
            return None

        allocated = float(budget.allocated_budget)

        today = date.today()
        month = today.month
        year = today.year

        month_expenses = db.query(Expense).filter(
            Expense.budget_id == budget.budget_id,
            extract("month", Expense.expense_date) == month,
            extract("year", Expense.expense_date) == year
        ).all()

        if not month_expenses:
            return None

        total_month_spend = sum(float(e.amount) for e in month_expenses)

        days_passed = today.day
        avg_daily = total_month_spend / days_passed if days_passed else 0

        projected = avg_daily * 30

        # 🔮 Trigger BEFORE breach
        if projected > allocated:

            over_pct = ((projected - allocated) / allocated) * 100 if allocated else 0

            if over_pct > 25:
                severity = "Critical"
                score = 85
            elif over_pct > 10:
                severity = "High"
                score = 65
            else:
                severity = "Medium"
                score = 45

            context = f"""
You are a predictive financial AI.

Return ONLY raw JSON.

Format:
{{
  "summary": "...",
  "insight": "...",
  "risk": "...",
  "recommendation": "..."
}}

Allocated Budget: {allocated}
Current Spend: {total_month_spend}
Projected Spend: {projected}
Daily Avg: {avg_daily:.2f}
"""

            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=context
            )

            text = response.text.strip()

            if text.startswith("```"):
                text = text.replace("```json", "").replace("```", "").strip()

            try:
                parsed = json.loads(text)
            except:
                parsed = {
                    "summary": "Projected budget overrun",
                    "insight": text,
                    "risk": "Future overspending",
                    "recommendation": "Reduce spending pace"
                }

            return {
                "summary": parsed.get("summary"),
                "insight": parsed.get("insight"),
                "risk": parsed.get("risk"),
                "recommendation": parsed.get("recommendation"),
                "severity": severity,
                "score": score,
                "type": "PREDICTIVE"
            }

        return None

    except Exception as e:
        return {
            "summary": "Prediction Error",
            "insight": str(e),
            "risk": "System issue",
            "recommendation": "Check logs",
            "severity": "Low",
            "score": 10,
            "type": "PREDICTIVE"
        }