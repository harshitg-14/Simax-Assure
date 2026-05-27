from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db import get_db
from app import models
from app.auth import get_current_user

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("/")
def list_audit(
    entity_type: str = Query(None),
    limit: int       = Query(100, le=500),
    offset: int      = Query(0),
    db: Session      = Depends(get_db),
    _: models.User   = Depends(get_current_user),
):
    q = db.query(models.AuditLog).order_by(models.AuditLog.created_at.desc())
    if entity_type and entity_type != "all":
        q = q.filter(models.AuditLog.entity_type == entity_type)
    total = q.count()
    rows  = q.offset(offset).limit(limit).all()
    return {
        "total": total,
        "logs": [
            {
                "id":          r.id,
                "action":      r.action,
                "entity_type": r.entity_type,
                "entity_ref":  r.entity_ref,
                "entity_id":   r.entity_id,
                "actor":       r.actor,
                "detail":      r.detail,
                "amount":      float(r.amount) if r.amount else None,
                "dept_name":   r.dept_name,
                "created_at":  str(r.created_at),
            }
            for r in rows
        ],
    }
