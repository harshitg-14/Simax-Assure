from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app import schemas, models, crud

router = APIRouter(prefix="/commitments", tags=["Commitments"])

@router.get("/")
def list_commitments(department_id: int = None, budget_id: int = None,
                     db: Session = Depends(get_db)):
    q = db.query(models.Commitment)
    if department_id:
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
def create_commitment(data: schemas.CommitmentCreate, db: Session = Depends(get_db)):
    return crud.create_commitment(db, data)

@router.delete("/{commitment_id}")
def delete_commitment(commitment_id: int, db: Session = Depends(get_db)):
    c = db.query(models.Commitment).filter(
        models.Commitment.commitment_id == commitment_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(c); db.commit()
    return {"detail": "Deleted"}