from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app import schemas, models, crud

from app.services.ai_service import generate_ai_alert, generate_predictive_alert
from app.auth import get_current_user

router = APIRouter(prefix="/expenses", tags=["Expenses"])


@router.get("/")
def list_expenses(department_id: int = None, budget_id: int = None,
                  db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_user)):
    q = db.query(models.Expense)
    if current_user.role == "department_head" and current_user.department_id:
        q = q.filter(models.Expense.department_id == current_user.department_id)
    elif department_id:
        q = q.filter(models.Expense.department_id == department_id)
    if budget_id:
        q = q.filter(models.Expense.budget_id == budget_id)
    return q.order_by(models.Expense.created_at.desc()).all()


@router.get("/{expense_id}")
def get_expense(expense_id: int, db: Session = Depends(get_db)):
    e = db.query(models.Expense).filter(
        models.Expense.expense_id == expense_id
    ).first()

    if not e:
        raise HTTPException(status_code=404, detail="Not found")

    return e


@router.post("/")
def create_expense(data: schemas.ExpenseCreate, db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):

    if current_user.role == "department_head" and current_user.department_id:
        if data.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="You can only create expenses for your own department")

    # ✅ Create expense
    expense = crud.create_expense(db, data)
    expense.submitted_by = current_user.username
    expense.status = "pending"
    db.commit()

    # =========================
    # 🔴 REACTIVE ALERT
    # =========================
    ai_result = generate_ai_alert(db, expense)

    if ai_result:
        alert = models.Alert(
            department_id=expense.department_id,
            budget_id=expense.budget_id,
            expense_id=expense.expense_id,

            alert_code="BUDGET_EXCEEDED",
            category="Financial",
            severity=ai_result.get("severity"),

            title=ai_result.get("summary"),
            message=ai_result.get("insight"),

            entity_type="expense",
            entity_id=expense.expense_id,

            recommended_action=ai_result.get("recommendation"),
            status="open"
        )
        db.add(alert)
        db.commit()

    # =========================
    # 🔮 PREDICTIVE ALERT
    # =========================
    predict_result = generate_predictive_alert(db, expense)

    if predict_result:
        alert = models.Alert(
            department_id=expense.department_id,
            budget_id=expense.budget_id,
            expense_id=expense.expense_id,

            alert_code="PREDICTED_OVERRUN",
            category="Prediction",
            severity=predict_result.get("severity"),

            title=predict_result.get("summary"),
            message=predict_result.get("insight"),

            entity_type="expense",
            entity_id=expense.expense_id,

            recommended_action=predict_result.get("recommendation"),
            status="open"
        )
        db.add(alert)
        db.commit()

    return expense


@router.delete("/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    e = db.query(models.Expense).filter(
        models.Expense.expense_id == expense_id
    ).first()

    if not e:
        raise HTTPException(status_code=404, detail="Not found")

    db.delete(e)
    db.commit()

    return {"detail": "Deleted"}