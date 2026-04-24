from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import extract, func
from datetime import datetime
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
        "critical": len([a for a in alerts if a.severity == "Critical"]),
        "high": len([a for a in alerts if a.severity == "High"]),
        "medium": len([a for a in alerts if a.severity == "Medium"])
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