from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app import crud, schemas, models

router = APIRouter(prefix="/alerts", tags=["Alerts"])

@router.get("/")
def get_alerts(status: str = None, severity: str = None,
               db: Session = Depends(get_db)):
    q = db.query(models.Alert)
    if status:
        q = q.filter(models.Alert.status == status)
    if severity:
        q = q.filter(models.Alert.severity == severity)
    return [crud.serialize_alert(a) for a in
            q.order_by(models.Alert.created_at.desc()).all()]

@router.get("/open")
def get_open_alerts(db: Session = Depends(get_db)):
    return crud.get_open_alerts(db)

@router.get("/{alert_id}")
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    a = db.query(models.Alert).filter(
        models.Alert.alert_id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Not found")
    return crud.serialize_alert(a)

@router.put("/{alert_id}/acknowledge")
def acknowledge(alert_id: int, data: schemas.AlertActionRequest,
                db: Session = Depends(get_db)):
    r = crud.acknowledge_alert(db, alert_id, data.user_name or "admin")
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    return r

@router.put("/{alert_id}/resolve")
def resolve(alert_id: int, data: schemas.AlertActionRequest,
            db: Session = Depends(get_db)):
    r = crud.resolve_alert(db, alert_id, data.user_name or "admin")
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    return r

@router.put("/{alert_id}/dismiss")
def dismiss(alert_id: int, db: Session = Depends(get_db)):
    r = crud.dismiss_alert(db, alert_id)
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    return r

@router.patch("/{alert_id}")
def update_status(alert_id: int, data: schemas.AlertStatusUpdateRequest,
                  db: Session = Depends(get_db)):
    if data.status == "acknowledged":
        return crud.acknowledge_alert(db, alert_id, data.user_name or "admin")
    elif data.status == "resolved":
        return crud.resolve_alert(db, alert_id, data.user_name or "admin")
    elif data.status == "dismissed":
        return crud.dismiss_alert(db, alert_id)
    a = db.query(models.Alert).filter(models.Alert.alert_id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Not found")
    a.status = data.status
    db.commit()
    return crud.serialize_alert(a)

@router.delete("/{alert_id}")
def delete_alert(alert_id: int, db: Session = Depends(get_db)):
    a = db.query(models.Alert).filter(models.Alert.alert_id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(a); db.commit()
    return {"detail": "Deleted"}