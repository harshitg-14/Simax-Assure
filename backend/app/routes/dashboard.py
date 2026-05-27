from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract, func
from datetime import datetime, date
from app.db import get_db
from app import models

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


# =========================================
# 📊 1. MONTHLY TREND
# =========================================
@router.get("/monthly-trend")
def monthly_trend(budget_id: int, db: Session = Depends(get_db)):

    results = db.query(
        extract("month", models.Expense.expense_date).label("month"),
        func.sum(models.Expense.amount).label("total")
    ).filter(
        models.Expense.budget_id == budget_id
    ).group_by("month").all()

    return [
        {"month": int(r.month), "total": float(r.total)}
        for r in results
    ]


# =========================================
# 🚨 2. ANOMALY DETECTION (SPIKES)
# =========================================
@router.get("/anomalies")
def detect_anomalies(budget_id: int, db: Session = Depends(get_db)):

    expenses = db.query(models.Expense).filter(
        models.Expense.budget_id == budget_id
    ).all()

    if not expenses:
        return []

    amounts = [float(e.amount) for e in expenses]
    avg = sum(amounts) / len(amounts)

    anomalies = [
        {
            "expense_id": e.expense_id,
            "amount": float(e.amount),
            "vendor": e.vendor,
            "reason": "Unusual spike"
        }
        for e in expenses
        if float(e.amount) > avg * 2
    ]

    return anomalies


# =========================================
# 🧠 3. DEPARTMENT RISK RANKING
# =========================================
@router.get("/department-risk")
def department_risk(db: Session = Depends(get_db)):

    data = db.query(
        models.Department.department_name,
        func.sum(models.Expense.amount).label("expense"),
        func.sum(models.Budget.allocated_budget).label("budget")
    ).join(
        models.Expense, models.Department.department_id == models.Expense.department_id
    ).join(
        models.Budget, models.Department.department_id == models.Budget.department_id
    ).group_by(models.Department.department_name).all()

    result = []

    for d in data:
        expense = float(d.expense or 0)
        budget = float(d.budget or 1)

        usage = (expense / budget) * 100

        if usage > 90:
            risk = "High"
        elif usage > 70:
            risk = "Medium"
        else:
            risk = "Low"

        result.append({
            "department": d.department_name,
            "usage_percent": round(usage, 2),
            "risk": risk
        })

    return sorted(result, key=lambda x: x["usage_percent"], reverse=True)


# =========================================
# ⚠️ 4. ALERT SUMMARY (FOR CARDS)
# =========================================
@router.get("/alerts-summary")
def alerts_summary(db: Session = Depends(get_db)):

    alerts = db.query(models.Alert).all()

    return {
        "total": len(alerts),
        "critical": len([a for a in alerts if a.severity == "critical"]),
        "high": len([a for a in alerts if a.severity == "high"]),
        "medium": len([a for a in alerts if a.severity == "medium"]),
        "low": len([a for a in alerts if a.severity == "low"]),
    }


# =========================================
# 🔥 5. TOP ALERTS
# =========================================
@router.get("/top-alerts")
def top_alerts(db: Session = Depends(get_db)):

    alerts = db.query(models.Alert)\
        .order_by(models.Alert.created_at.desc())\
        .limit(5)\
        .all()

    return [
        {
            "title": a.title,
            "severity": a.severity,
            "message": a.message
        }
        for a in alerts
    ]


# =========================================
# 📈 6. BURN-RATE FORECAST
# =========================================
@router.get("/forecast")
def budget_forecast(year: int = Query(None), db: Session = Depends(get_db)):
    today      = date.today()
    target_year = year or today.year

    budgets  = db.query(models.Budget).filter(models.Budget.budget_year == target_year).all()
    expenses = db.query(models.Expense).all()
    depts    = db.query(models.Department).all()
    dept_map = {d.department_id: d.department_name for d in depts}

    result = []
    for b in budgets:
        b_exp = [e for e in expenses
                 if e.budget_id == b.budget_id
                 and e.expense_date
                 and e.expense_date.year == target_year]

        monthly = {}
        for e in b_exp:
            m = e.expense_date.month
            monthly[m] = monthly.get(m, 0) + float(e.amount or 0)

        max_month = today.month if target_year == today.year else 12
        recent    = [monthly.get(m, 0) for m in range(max(1, max_month - 2), max_month + 1)]
        filled    = [x for x in recent if x > 0]
        avg_burn  = sum(filled) / len(filled) if filled else 0

        total_spent = sum(float(e.amount or 0) for e in b_exp)
        allocated   = float(b.allocated_budget or 0)
        remaining   = allocated - total_spent

        projected_exhaustion = None
        months_to_exhaust    = None
        if remaining < 0:
            status = "overrun"
        elif avg_burn > 0:
            months_to_exhaust = remaining / avg_burn
            total_m  = today.month + months_to_exhaust
            proj_yr  = today.year + int((total_m - 1) // 12)
            proj_mo  = int(((total_m - 1) % 12) + 1)
            try:
                projected_exhaustion = date(proj_yr, proj_mo, 1).isoformat()
            except Exception:
                projected_exhaustion = None
            status = "critical" if months_to_exhaust < 2 else "at_risk" if months_to_exhaust < 4 else "on_track"
        else:
            status = "on_track"

        result.append({
            "department":           dept_map.get(b.department_id, "Unknown"),
            "budget_id":            b.budget_id,
            "allocated":            allocated,
            "spent":                round(total_spent, 2),
            "remaining":            round(remaining, 2),
            "monthly_burn":         round(avg_burn, 2),
            "months_to_exhaust":    round(months_to_exhaust, 1) if months_to_exhaust is not None else None,
            "projected_exhaustion": projected_exhaustion,
            "utilization_pct":      round((total_spent / allocated * 100) if allocated else 0, 1),
            "status":               status,
        })

    order = {"overrun": 0, "critical": 1, "at_risk": 2, "on_track": 3}
    return sorted(result, key=lambda x: order.get(x["status"], 4))


# =========================================
# 📊 6. MAIN DASHBOARD SUMMARY (FIX)
# =========================================
@router.get("/{budget_id}")
def dashboard_summary(budget_id: int, db: Session = Depends(get_db)):

    budget = db.query(models.Budget).filter(
        models.Budget.budget_id == budget_id
    ).first()

    if not budget:
        return {"error": "Budget not found"}

    expenses = db.query(models.Expense).filter(
        models.Expense.budget_id == budget_id
    ).all()

    total_spent = sum(float(e.amount) for e in expenses)
    total_budget = float(budget.allocated_budget)
    remaining = total_budget - total_spent

    return {
        "budget_id": budget_id,
        "total_budget": total_budget,
        "total_expense": total_spent,
        "remaining": remaining
    }