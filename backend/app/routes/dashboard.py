from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from .. import crud

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/{budget_id}")
def get_dashboard(budget_id: int, db: Session = Depends(get_db)):
    result = crud.get_budget_summary(db, budget_id)
    if not result:
        raise HTTPException(status_code=404, detail="Budget not found")
    return result