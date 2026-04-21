from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app import schemas, models

router = APIRouter(prefix="/departments", tags=["Departments"])

@router.get("/")
def list_departments(db: Session = Depends(get_db)):
    return db.query(models.Department).all()

@router.get("/{dept_id}")
def get_department(dept_id: int, db: Session = Depends(get_db)):
    dept = db.query(models.Department).filter(
        models.Department.department_id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Not found")
    return dept

@router.post("/")
def create_department(data: schemas.DepartmentCreate, db: Session = Depends(get_db)):
    obj = models.Department(**data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

@router.put("/{dept_id}")
def update_department(dept_id: int, data: schemas.DepartmentCreate, db: Session = Depends(get_db)):
    dept = db.query(models.Department).filter(
        models.Department.department_id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in data.model_dump().items():
        setattr(dept, k, v)
    db.commit(); db.refresh(dept)
    return dept

@router.delete("/{dept_id}")
def delete_department(dept_id: int, db: Session = Depends(get_db)):
    dept = db.query(models.Department).filter(
        models.Department.department_id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(dept); db.commit()
    return {"detail": "Deleted"}