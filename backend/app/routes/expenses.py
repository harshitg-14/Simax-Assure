import csv
import io
from datetime import date as date_type
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.db import get_db
from app import schemas, models, crud

from app.services.ai_service import generate_ai_alert, generate_predictive_alert
from app.services.email_service import notify_expense_submitted
from app.auth import get_current_user

UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(exist_ok=True)

router = APIRouter(prefix="/expenses", tags=["Expenses"])


def _finance_emails(db) -> list[str]:
    users = db.query(models.User).filter(
        models.User.role.in_(["admin", "finance_manager"])
    ).all()
    return [u.email for u in users if u.email and "@" in u.email]


def _dept_name(db, dept_id) -> str:
    d = db.query(models.Department).filter(models.Department.department_id == dept_id).first()
    return d.department_name if d else "Unknown"


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
def create_expense(data: schemas.ExpenseCreate, background_tasks: BackgroundTasks,
                   db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):

    if current_user.role == "department_head" and current_user.department_id:
        if data.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="You can only create expenses for your own department")

    expense = crud.create_expense(db, data)
    expense.submitted_by = current_user.username
    expense.status = "pending"
    db.commit()

    background_tasks.add_task(
        notify_expense_submitted,
        _finance_emails(db), expense,
        _dept_name(db, expense.department_id),
        current_user.username
    )

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


@router.post("/{expense_id}/receipt")
async def upload_receipt(
    expense_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    e = db.query(models.Expense).filter(models.Expense.expense_id == expense_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Not found")

    ext = Path(file.filename).suffix.lower() if file.filename else ""
    allowed = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Only PDF, JPG, PNG, or WEBP files are allowed")

    dest = UPLOADS_DIR / f"exp_{expense_id}{ext}"
    with dest.open("wb") as buf:
        buf.write(await file.read())

    e.receipt_path = str(dest)
    db.commit()
    return {"detail": "Receipt uploaded"}


@router.get("/{expense_id}/receipt")
def download_receipt(expense_id: int, db: Session = Depends(get_db)):
    e = db.query(models.Expense).filter(models.Expense.expense_id == expense_id).first()
    if not e or not e.receipt_path:
        raise HTTPException(status_code=404, detail="No receipt on file")

    path = Path(e.receipt_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on server")

    return FileResponse(path, filename=path.name)


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


@router.post("/bulk")
async def bulk_import(
    file: UploadFile = File(...),
    year: int = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    today = date_type.today()
    target_year = year or today.year

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader  = csv.DictReader(io.StringIO(text))
    depts   = db.query(models.Department).all()
    budgets = db.query(models.Budget).filter(models.Budget.budget_year == target_year).all()

    imported, failed = 0, []

    for i, row in enumerate(reader, start=2):
        def col(*keys):
            for k in keys:
                v = row.get(k, row.get(k.lower(), row.get(k.upper(), ""))).strip()
                if v:
                    return v
            return ""

        dept_name  = col("department", "Department")
        vendor     = col("vendor", "Vendor")
        amount_raw = col("amount", "Amount")
        category   = col("category", "Category") or "Other"
        date_raw   = col("expense_date", "date", "Date", "Expense Date")

        if not dept_name:
            failed.append({"row": i, "reason": "Missing department"}); continue
        if not amount_raw:
            failed.append({"row": i, "reason": "Missing amount"}); continue

        dept = next((d for d in depts if d.department_name.lower() == dept_name.lower()), None)
        if not dept:
            failed.append({"row": i, "reason": f"Department not found: {dept_name}"}); continue

        budget = next((b for b in budgets if b.department_id == dept.department_id), None)
        if not budget:
            failed.append({"row": i, "reason": f"No FY{target_year} budget for {dept_name}"}); continue

        try:
            amount = float(amount_raw.replace(",", "").replace("Rs", "").replace("INR", "").replace("₹", "").strip())
        except ValueError:
            failed.append({"row": i, "reason": f"Invalid amount: {amount_raw}"}); continue

        if date_raw:
            try:
                expense_date = date_type.fromisoformat(date_raw)
            except ValueError:
                failed.append({"row": i, "reason": f"Invalid date (use YYYY-MM-DD): {date_raw}"}); continue
        else:
            expense_date = today

        db.add(models.Expense(
            budget_id=budget.budget_id,
            department_id=dept.department_id,
            vendor=vendor or None,
            amount=amount,
            expense_date=expense_date,
            category=category,
            status="approved",
            submitted_by=current_user.username,
            approved_by=current_user.username,
        ))
        imported += 1

    if imported:
        db.commit()

    return {"imported": imported, "failed": failed, "total_rows": imported + len(failed)}