import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.db import get_db
from app import models
from app.auth import get_current_user
from app.services.email_service import (
    notify_expense_approved, notify_expense_rejected,
    notify_commitment_approved, notify_commitment_rejected,
    notify_commitment_submitted,
)


def _dept_name(db, dept_id) -> str:
    d = db.query(models.Department).filter(models.Department.department_id == dept_id).first()
    return d.department_name if d else "Unknown"


def _user_email(db, username: str) -> str:
    u = db.query(models.User).filter(models.User.username == username).first()
    return u.email if u and u.email else ""

router = APIRouter(prefix="/approvals", tags=["Approvals"])


class ActionRequest(BaseModel):
    reason: Optional[str] = None


def get_approver(current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ("admin", "finance_manager"):
        raise HTTPException(status_code=403, detail="Finance manager or admin role required")
    return current_user


def _serialize_commitment(c, depts, budgets):
    dept   = next((d for d in depts   if d.department_id == c.department_id), None)
    budget = next((b for b in budgets if b.budget_id      == c.budget_id),     None)
    return {
        "id":               c.commitment_id,
        "type":             "commitment",
        "ref":              f"CMT-{str(c.commitment_id).zfill(3)}",
        "description":      c.description,
        "amount":           float(c.amount),
        "department_name":  dept.department_name if dept else "—",
        "budget_year":      budget.budget_year   if budget else "—",
        "date":             str(c.commitment_date) if c.commitment_date else "—",
        "status":           c.status or "pending",
        "submitted_by":     c.submitted_by,
        "approved_by":      c.approved_by,
        "approved_at":      str(c.approved_at) if c.approved_at else None,
        "rejection_reason": c.rejection_reason,
        "created_at":       str(c.created_at)  if c.created_at  else None,
    }


def _serialize_expense(e, depts, budgets):
    dept   = next((d for d in depts   if d.department_id == e.department_id), None)
    budget = next((b for b in budgets if b.budget_id      == e.budget_id),     None)
    return {
        "id":               e.expense_id,
        "type":             "expense",
        "ref":              f"EXP-{str(e.expense_id).zfill(4)}",
        "description":      e.vendor or e.category or "Expense",
        "vendor":           e.vendor,
        "category":         e.category,
        "amount":           float(e.amount),
        "department_name":  dept.department_name if dept else "—",
        "budget_year":      budget.budget_year   if budget else "—",
        "date":             str(e.expense_date)  if e.expense_date  else "—",
        "status":           e.status or "pending",
        "submitted_by":     e.submitted_by,
        "approved_by":      e.approved_by,
        "approved_at":      str(e.approved_at) if e.approved_at else None,
        "rejection_reason": e.rejection_reason,
        "created_at":       str(e.created_at)  if e.created_at  else None,
    }


@router.get("/summary")
def get_summary(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    pending_c  = db.query(models.Commitment).filter(models.Commitment.status == "pending").count()
    pending_e  = db.query(models.Expense).filter(models.Expense.status == "pending").count()
    approved_c = db.query(models.Commitment).filter(models.Commitment.status == "approved").count()
    approved_e = db.query(models.Expense).filter(models.Expense.status == "approved").count()
    rejected_c = db.query(models.Commitment).filter(models.Commitment.status == "rejected").count()
    rejected_e = db.query(models.Expense).filter(models.Expense.status == "rejected").count()
    return {
        "pending":  pending_c + pending_e,
        "approved": approved_c + approved_e,
        "rejected": rejected_c + rejected_e,
    }


@router.get("/pending")
def get_pending(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    depts   = db.query(models.Department).all()
    budgets = db.query(models.Budget).all()
    commitments = (db.query(models.Commitment)
                   .filter(models.Commitment.status == "pending")
                   .order_by(models.Commitment.created_at.desc()).all())
    expenses = (db.query(models.Expense)
                .filter(models.Expense.status == "pending")
                .order_by(models.Expense.created_at.desc()).all())
    return {
        "commitments": [_serialize_commitment(c, depts, budgets) for c in commitments],
        "expenses":    [_serialize_expense(e, depts, budgets)    for e in expenses],
    }


@router.get("/history")
def get_history(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    depts   = db.query(models.Department).all()
    budgets = db.query(models.Budget).all()
    commitments = (db.query(models.Commitment)
                   .filter(models.Commitment.status.in_(["approved", "rejected"]))
                   .order_by(models.Commitment.approved_at.desc()).limit(60).all())
    expenses = (db.query(models.Expense)
                .filter(models.Expense.status.in_(["approved", "rejected"]))
                .order_by(models.Expense.approved_at.desc()).limit(60).all())
    return {
        "commitments": [_serialize_commitment(c, depts, budgets) for c in commitments],
        "expenses":    [_serialize_expense(e, depts, budgets)    for e in expenses],
    }


@router.put("/commitments/{commitment_id}/approve")
def approve_commitment(commitment_id: int, db: Session = Depends(get_db),
                       current_user: models.User = Depends(get_approver)):
    c = db.query(models.Commitment).filter(models.Commitment.commitment_id == commitment_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Commitment not found")
    if (c.status or "pending") != "pending":
        raise HTTPException(status_code=400, detail="Only pending items can be approved")
    c.status      = "approved"
    c.approved_by = current_user.username
    c.approved_at = datetime.utcnow()
    db.commit()
    if c.submitted_by:
        email = _user_email(db, c.submitted_by)
        if email:
            asyncio.create_task(notify_commitment_approved(
                email, c, _dept_name(db, c.department_id), current_user.username
            ))
    return {"detail": "Approved", "status": "approved"}


@router.put("/commitments/{commitment_id}/reject")
def reject_commitment(commitment_id: int, data: ActionRequest, db: Session = Depends(get_db),
                      current_user: models.User = Depends(get_approver)):
    c = db.query(models.Commitment).filter(models.Commitment.commitment_id == commitment_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Commitment not found")
    if (c.status or "pending") != "pending":
        raise HTTPException(status_code=400, detail="Only pending items can be rejected")
    c.status           = "rejected"
    c.approved_by      = current_user.username
    c.approved_at      = datetime.utcnow()
    c.rejection_reason = data.reason
    db.commit()
    if c.submitted_by:
        email = _user_email(db, c.submitted_by)
        if email:
            asyncio.create_task(notify_commitment_rejected(
                email, c, _dept_name(db, c.department_id),
                current_user.username, data.reason
            ))
    return {"detail": "Rejected", "status": "rejected"}


@router.put("/expenses/{expense_id}/approve")
def approve_expense(expense_id: int, db: Session = Depends(get_db),
                    current_user: models.User = Depends(get_approver)):
    e = db.query(models.Expense).filter(models.Expense.expense_id == expense_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Expense not found")
    if (e.status or "pending") != "pending":
        raise HTTPException(status_code=400, detail="Only pending items can be approved")
    e.status      = "approved"
    e.approved_by = current_user.username
    e.approved_at = datetime.utcnow()
    db.commit()
    if e.submitted_by:
        email = _user_email(db, e.submitted_by)
        if email:
            asyncio.create_task(notify_expense_approved(
                email, e, _dept_name(db, e.department_id), current_user.username
            ))
    return {"detail": "Approved", "status": "approved"}


@router.put("/expenses/{expense_id}/reject")
def reject_expense(expense_id: int, data: ActionRequest, db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_approver)):
    e = db.query(models.Expense).filter(models.Expense.expense_id == expense_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Expense not found")
    if (e.status or "pending") != "pending":
        raise HTTPException(status_code=400, detail="Only pending items can be rejected")
    e.status           = "rejected"
    e.approved_by      = current_user.username
    e.approved_at      = datetime.utcnow()
    e.rejection_reason = data.reason
    db.commit()
    if e.submitted_by:
        email = _user_email(db, e.submitted_by)
        if email:
            asyncio.create_task(notify_expense_rejected(
                email, e, _dept_name(db, e.department_id),
                current_user.username, data.reason
            ))
    return {"detail": "Rejected", "status": "rejected"}
