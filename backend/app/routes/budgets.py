from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app import schemas, models, crud

router = APIRouter(prefix="/budgets", tags=["Budgets"])

@router.get("/")
def list_budgets(year: int = None, department_id: int = None, db: Session = Depends(get_db)):
    q = db.query(models.Budget)
    if year:
        q = q.filter(models.Budget.budget_year == year)
    if department_id:
        q = q.filter(models.Budget.department_id == department_id)
    return q.all()

@router.get("/dashboard")
def dashboard_kpis(year: int = 2025, db: Session = Depends(get_db)):
    budgets = db.query(models.Budget).filter(
        models.Budget.budget_year == year).all()
    result = []
    total_budget = total_spent = total_committed = 0
    for b in budgets:
        s = crud.get_budget_summary(db, b.budget_id)
        if s:
            dept = db.query(models.Department).filter(
                models.Department.department_id == b.department_id).first()
            s["department_name"] = dept.department_name if dept else "Unknown"
            result.append(s)
            total_budget    += s["allocated_budget"]
            total_spent     += s["spent_amount"]
            total_committed += s["committed_amount"]
    utilization = round(total_spent / total_budget * 100, 2) if total_budget > 0 else 0
    open_alerts = db.query(models.Alert).filter(models.Alert.status == "open").count()
    return {
        "total_budget":      total_budget,
        "total_expenses":    total_spent,
        "total_commitments": total_committed,
        "remaining_budget":  total_budget - total_spent - total_committed,
        "utilization_pct":   utilization,
        "active_alerts":     open_alerts,
        "departments":       result,
        "year":              year,
    }

@router.get("/{budget_id}")
def get_budget(budget_id: int, db: Session = Depends(get_db)):
    b = db.query(models.Budget).filter(
        models.Budget.budget_id == budget_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    return b

@router.post("/")
def create_budget(data: schemas.BudgetCreate, db: Session = Depends(get_db)):
    return crud.create_budget(db, data)

@router.delete("/{budget_id}")
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    b = db.query(models.Budget).filter(
        models.Budget.budget_id == budget_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(b); db.commit()
    return {"detail": "Deleted"}