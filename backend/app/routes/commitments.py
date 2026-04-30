from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app import schemas, models, crud
from app.auth import get_current_user

router = APIRouter(prefix="/commitments", tags=["Commitments"])

@router.get("/")
def list_commitments(department_id: int = None, budget_id: int = None,
                     db: Session = Depends(get_db),
                     current_user: models.User = Depends(get_current_user)):
    q = db.query(models.Commitment)
    if current_user.role == "department_head" and current_user.department_id:
        q = q.filter(models.Commitment.department_id == current_user.department_id)
    elif department_id:
        q = q.filter(models.Commitment.department_id == department_id)
    if budget_id:
        q = q.filter(models.Commitment.budget_id == budget_id)
    return q.order_by(models.Commitment.created_at.desc()).all()

@router.get("/{commitment_id}")
def get_commitment(commitment_id: int, db: Session = Depends(get_db)):
    c = db.query(models.Commitment).filter(
        models.Commitment.commitment_id == commitment_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    return c

@router.post("/")
def create_commitment(data: schemas.CommitmentCreate, db: Session = Depends(get_db),
                      current_user: models.User = Depends(get_current_user)):
    if current_user.role == "department_head" and current_user.department_id:
        if data.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="You can only create commitments for your own department")
    c = crud.create_commitment(db, data)
    c.submitted_by = current_user.username
    c.status = "pending"
    db.commit()
    db.refresh(c)
    return c

@router.delete("/{commitment_id}")
def delete_commitment(commitment_id: int, db: Session = Depends(get_db)):
    c = db.query(models.Commitment).filter(
        models.Commitment.commitment_id == commitment_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(c); db.commit()
    return {"detail": "Deleted"}