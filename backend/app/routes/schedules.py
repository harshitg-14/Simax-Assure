import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app import models
from app.auth import get_current_user
from app.services import scheduler_service

router = APIRouter(prefix="/schedules", tags=["Schedules"])


class ScheduleConfig(BaseModel):
    enabled: bool
    frequency: str
    day_of_week: Optional[int] = 0
    day_of_month: Optional[int] = 1
    hour: int = 8
    recipients: List[str] = []


def _get_or_create(db: Session) -> models.ScheduledReport:
    config = db.query(models.ScheduledReport).filter_by(id=1).first()
    if not config:
        config = models.ScheduledReport(id=1, enabled=0, frequency="weekly",
                                        day_of_week=0, day_of_month=1, hour=8, recipients="[]")
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.get("/")
def get_schedule(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    config = _get_or_create(db)
    return {
        "enabled":      bool(config.enabled),
        "frequency":    config.frequency or "weekly",
        "day_of_week":  config.day_of_week if config.day_of_week is not None else 0,
        "day_of_month": config.day_of_month or 1,
        "hour":         config.hour if config.hour is not None else 8,
        "recipients":   json.loads(config.recipients or "[]"),
        "last_sent_at": str(config.last_sent_at) if config.last_sent_at else None,
    }


@router.put("/")
def update_schedule(
    body: ScheduleConfig,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "finance_manager"):
        raise HTTPException(status_code=403, detail="Not authorized")

    config = _get_or_create(db)
    config.enabled      = 1 if body.enabled else 0
    config.frequency    = body.frequency
    config.day_of_week  = body.day_of_week
    config.day_of_month = body.day_of_month
    config.hour         = body.hour
    config.recipients   = json.dumps(body.recipients)
    db.commit()

    scheduler_service.reschedule(config)

    return {"detail": "Schedule updated", "enabled": bool(config.enabled)}


@router.post("/send-now")
def send_now(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "finance_manager"):
        raise HTTPException(status_code=403, detail="Not authorized")

    from app.routes.reports import _build_pdf
    config = _get_or_create(db)
    recipients = json.loads(config.recipients or "[]")
    if not recipients:
        raise HTTPException(status_code=400, detail="No recipients configured. Add recipients and save first.")

    year = datetime.now().year
    try:
        pdf_bytes = _build_pdf(year, db)
        scheduler_service._send_report_email(pdf_bytes, year, recipients)
        config.last_sent_at = datetime.now()
        db.commit()
        return {"detail": f"Report sent to {len(recipients)} recipient(s)"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send: {str(e)}")
