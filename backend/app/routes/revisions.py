import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from app.db import get_db
from app import models
from app.auth import get_current_user
from app.services.email_service import (
    notify_revision_submitted, notify_revision_approved, notify_revision_rejected,
)

router = APIRouter(prefix="/revisions", tags=["Budget Revisions"])


class RevisionCreate(BaseModel):
    budget_id: int
    requested_amount: float
    reason: str


class RejectRequest(BaseModel):
    reason: Optional[str] = None


def _dept_name(db, dept_id) -> str:
    d = db.query(models.Department).filter(models.Department.department_id == dept_id).first()
    return d.department_name if d else "Unknown"


def _user_email(db, username: str) -> str:
    u = db.query(models.User).filter(models.User.username == username).first()
    return u.email if u and u.email else ""


def _finance_emails(db) -> list[str]:
    users = db.query(models.User).filter(
        models.User.role.in_(["admin", "finance_manager"])
    ).all()
    return [u.email for u in users if u.email and "@" in u.email]


def _serialize(r, depts, budgets):
    dept   = next((d for d in depts   if d.department_id == r.department_id), None)
    budget = next((b for b in budgets if b.budget_id      == r.budget_id),     None)
    return {
        "id":               r.revision_id,
        "ref":              f"REV-{str(r.revision_id).zfill(3)}",
        "budget_id":        r.budget_id,
        "department_id":    r.department_id,
        "department_name":  dept.department_name   if dept   else "—",
        "budget_year":      budget.budget_year      if budget else "—",
        "current_amount":   float(r.current_amount),
        "requested_amount": float(r.requested_amount),
        "difference":       float(r.requested_amount) - float(r.current_amount),
        "reason":           r.reason,
        "status":           r.status,
        "requested_by":     r.requested_by,
        "reviewed_by":      r.reviewed_by,
        "reviewed_at":      str(r.reviewed_at)  if r.reviewed_at  else None,
        "rejection_reason": r.rejection_reason,
        "created_at":       str(r.created_at)   if r.created_at   else None,
    }


def get_approver(current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ("admin", "finance_manager"):
        raise HTTPException(status_code=403, detail="Finance manager or admin role required")
    return current_user


@router.get("/pending-count")
def pending_count(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    count = db.query(models.BudgetRevision).filter(models.BudgetRevision.status == "pending").count()
    return {"count": count}


@router.get("/")
def list_revisions(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    depts   = db.query(models.Department).all()
    budgets = db.query(models.Budget).all()
    q = db.query(models.BudgetRevision)
    if current_user.role == "department_head":
        q = q.filter(models.BudgetRevision.requested_by == current_user.username)
    revisions = q.order_by(models.BudgetRevision.created_at.desc()).all()
    return [_serialize(r, depts, budgets) for r in revisions]


@router.post("/")
def create_revision(
    data: RevisionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    budget = db.query(models.Budget).filter(models.Budget.budget_id == data.budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    if current_user.role == "department_head" and current_user.department_id:
        if budget.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="You can only request revisions for your own department")

    existing = db.query(models.BudgetRevision).filter(
        models.BudgetRevision.budget_id == data.budget_id,
        models.BudgetRevision.status    == "pending",
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A pending revision already exists for this budget")

    revision = models.BudgetRevision(
        budget_id=data.budget_id,
        department_id=budget.department_id,
        requested_by=current_user.username,
        current_amount=budget.allocated_budget,
        requested_amount=data.requested_amount,
        reason=data.reason,
        status="pending",
    )
    db.add(revision)
    db.commit()
    db.refresh(revision)

    finance_emails = _finance_emails(db)
    if finance_emails:
        asyncio.create_task(notify_revision_submitted(
            finance_emails, revision,
            _dept_name(db, budget.department_id),
            current_user.username,
        ))

    depts   = db.query(models.Department).all()
    budgets = db.query(models.Budget).all()
    return _serialize(revision, depts, budgets)


@router.put("/{revision_id}/approve")
def approve_revision(
    revision_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_approver),
):
    r = db.query(models.BudgetRevision).filter(models.BudgetRevision.revision_id == revision_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Revision not found")
    if r.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending revisions can be approved")

    budget = db.query(models.Budget).filter(models.Budget.budget_id == r.budget_id).first()
    if budget:
        budget.allocated_budget = r.requested_amount

    r.status      = "approved"
    r.reviewed_by = current_user.username
    r.reviewed_at = datetime.utcnow()
    db.add(models.AuditLog(action="approved", entity_type="revision",
        entity_ref=f"REV-{str(r.revision_id).zfill(3)}", entity_id=r.revision_id,
        actor=current_user.username,
        detail=f"Budget revised from {float(r.current_amount):,.0f} to {float(r.requested_amount):,.0f}",
        amount=float(r.requested_amount), dept_name=_dept_name(db, r.department_id)))
    db.commit()

    if r.requested_by:
        email = _user_email(db, r.requested_by)
        if email:
            asyncio.create_task(notify_revision_approved(
                email, r, _dept_name(db, r.department_id), current_user.username
            ))

    return {"detail": "Approved", "new_budget": float(r.requested_amount)}


@router.put("/{revision_id}/reject")
def reject_revision(
    revision_id: int,
    data: RejectRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_approver),
):
    r = db.query(models.BudgetRevision).filter(models.BudgetRevision.revision_id == revision_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Revision not found")
    if r.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending revisions can be rejected")

    r.status           = "rejected"
    r.reviewed_by      = current_user.username
    r.reviewed_at      = datetime.utcnow()
    r.rejection_reason = data.reason
    db.add(models.AuditLog(action="rejected", entity_type="revision",
        entity_ref=f"REV-{str(r.revision_id).zfill(3)}", entity_id=r.revision_id,
        actor=current_user.username, detail=data.reason or r.reason,
        amount=float(r.requested_amount), dept_name=_dept_name(db, r.department_id)))
    db.commit()

    if r.requested_by:
        email = _user_email(db, r.requested_by)
        if email:
            asyncio.create_task(notify_revision_rejected(
                email, r, _dept_name(db, r.department_id),
                current_user.username, data.reason,
            ))

    return {"detail": "Rejected"}
