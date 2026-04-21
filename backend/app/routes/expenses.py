from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app import schemas, models, crud

router = APIRouter(prefix="/expenses", tags=["Expenses"])

@router.get("/")
def list_expenses(department_id: int = None, budget_id: int = None,
                  db: Session = Depends(get_db)):
    q = db.query(models.Expense)
    if department_id:
        q = q.filter(models.Expense.department_id == department_id)
    if budget_id:
        q = q.filter(models.Expense.budget_id == budget_id)
    return q.order_by(models.Expense.created_at.desc()).all()

@router.get("/{expense_id}")
def get_expense(expense_id: int, db: Session = Depends(get_db)):
    e = db.query(models.Expense).filter(
        models.Expense.expense_id == expense_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Not found")
    return e

@router.post("/")
def create_expense(data: schemas.ExpenseCreate, db: Session = Depends(get_db)):
    return crud.create_expense(db, data)

@router.delete("/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    e = db.query(models.Expense).filter(
        models.Expense.expense_id == expense_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(e); db.commit()
    return {"detail": "Deleted"}