from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.db import get_db
from app import models
from app.auth import hash_password, get_current_user

router = APIRouter(prefix="/users", tags=["Users"])

ROLES = {"admin", "finance_manager", "department_head", "viewer"}


class UserCreate(BaseModel):
    username:      str
    email:         str
    password:      str
    role:          str = "viewer"
    department_id: Optional[int] = None


class UserUpdate(BaseModel):
    email:         Optional[str] = None
    role:          Optional[str] = None
    department_id: Optional[int] = None


class PasswordReset(BaseModel):
    new_password: str


def serialize(u: models.User):
    return {
        "user_id":       u.user_id,
        "username":      u.username,
        "email":         u.email,
        "role":          u.role,
        "department_id": u.department_id,
        "created_at":    u.created_at.isoformat() if u.created_at else None,
    }


def require_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/")
def list_users(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return [serialize(u) for u in db.query(models.User).order_by(models.User.user_id).all()]


@router.post("/", status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    if data.role not in ROLES:
        raise HTTPException(400, detail=f"Invalid role. Must be one of: {', '.join(ROLES)}")
    if db.query(models.User).filter(models.User.username == data.username).first():
        raise HTTPException(400, detail="Username already exists")
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(400, detail="Email already exists")
    user = models.User(
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role,
        department_id=data.department_id if data.role == "department_head" else None,
    )
    db.add(user); db.commit(); db.refresh(user)
    return serialize(user)


@router.put("/{user_id}")
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(404, detail="User not found")
    if data.role and data.role not in ROLES:
        raise HTTPException(400, detail=f"Invalid role")
    if data.email:
        user.email = data.email
    if data.role:
        user.role = data.role
    # Update department: only relevant for dept heads; clear it for other roles
    effective_role = data.role or user.role
    if effective_role == "department_head":
        if data.department_id is not None:
            user.department_id = data.department_id
    else:
        user.department_id = None
    db.commit(); db.refresh(user)
    return serialize(user)


@router.put("/{user_id}/reset-password")
def reset_password(user_id: int, data: PasswordReset, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(404, detail="User not found")
    if not data.new_password or len(data.new_password) < 4:
        raise HTTPException(400, detail="Password must be at least 4 characters")
    user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"detail": "Password updated"}


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current: models.User = Depends(require_admin)):
    if current.user_id == user_id:
        raise HTTPException(400, detail="Cannot delete your own account")
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(404, detail="User not found")
    db.delete(user); db.commit()
    return {"detail": "Deleted"}
