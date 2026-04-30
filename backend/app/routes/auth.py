from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db import get_db
from app import models
from app.auth import verify_password, hash_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


def serialize_user(user: models.User):
    return {
        "user_id":       user.user_id,
        "username":      user.username,
        "email":         user.email,
        "role":          user.role,
        "department_id": user.department_id,
    }


@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == data.username).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    token = create_access_token({"sub": str(user.user_id), "role": user.role})
    return {
        "access_token": token,
        "token_type":   "bearer",
        "user":         serialize_user(user),
    }


@router.get("/me")
def me(current_user: models.User = Depends(get_current_user)):
    return serialize_user(current_user)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.put("/change-password")
def change_password(data: ChangePasswordRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(data.new_password) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters")
    current_user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"detail": "Password changed successfully"}
