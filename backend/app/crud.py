from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from app import models, schemas


def create_department(db: Session, data: schemas.DepartmentCreate):
    obj = models.Department(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def create_budget(db: Session, data: schemas.BudgetCreate):
    obj = models.Budget(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def create_commitment(db: Session, data: schemas.CommitmentCreate):
    obj = models.Commitment(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def create_alert(
    db: Session,
    department_id=None,
    budget_id=None,
    commitment_id=None,
    expense_id=None,
    alert_code="GENERIC",
    category="budget_control",
    severity="medium",
    title="Alert",
    message="Alert generated",
    entity_type="expense",
    entity_id=0,
    owner_role="finance_manager",
    status="open",
    recommended_action=None,
    due_date=None,
):
    alert = models.Alert(
        department_id=department_id,
        budget_id=budget_id,
        commitment_id=commitment_id,
        expense_id=expense_id,
        alert_code=alert_code,
        category=category,
        severity=severity,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
        owner_role=owner_role,
        status=status,
        recommended_action=recommended_action,
        due_date=due_date,
    )
    db.add(alert)
    return alert


def create_expense(db: Session, data: schemas.ExpenseCreate):
    obj = models.Expense(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)

    budget = db.query(models.Budget).filter(models.Budget.budget_id == obj.budget_id).first()
    commitment = None
    if obj.commitment_id is not None:
        commitment = db.query(models.Commitment).filter(
            models.Commitment.commitment_id == obj.commitment_id
        ).first()

    total_spent = db.query(func.coalesce(func.sum(models.Expense.amount), 0)).filter(
        models.Expense.budget_id == obj.budget_id
    ).scalar()

    recent_high_expense_count = db.query(func.count(models.Expense.expense_id)).filter(
        models.Expense.department_id == obj.department_id,
        models.Expense.amount >= 10000
    ).scalar()

    # Rule 1: Expense without commitment
    if obj.commitment_id is None:
        create_alert(
            db=db,
            department_id=obj.department_id,
            budget_id=obj.budget_id,
            expense_id=obj.expense_id,
            alert_code="NO_COMMITMENT",
            category="policy_violation",
            severity="high",
            title="Expense without commitment",
            message=f"Expense of {float(obj.amount):,.2f} was recorded without a linked approved commitment.",
            entity_type="expense",
            entity_id=obj.expense_id,
            owner_role="procurement",
            recommended_action="Link this expense to an approved commitment or record a formal exception justification.",
            due_date=date.today() + timedelta(days=2),
        )

    # Rule 2: High-value expense
    if float(obj.amount) >= 10000:
        create_alert(
            db=db,
            department_id=obj.department_id,
            budget_id=obj.budget_id,
            expense_id=obj.expense_id,
            alert_code="HIGH_VALUE_EXPENSE",
            category="spend_anomaly",
            severity="medium",
            title="High-value expense detected",
            message=f"Expense of {float(obj.amount):,.2f} exceeded the monitoring threshold.",
            entity_type="expense",
            entity_id=obj.expense_id,
            owner_role="finance_manager",
            recommended_action="Review supporting documents and approval trail.",
            due_date=date.today() + timedelta(days=3),
        )

    # Rule 3: Expense exceeds linked commitment
    if commitment and float(obj.amount) > float(commitment.amount):
        create_alert(
            db=db,
            department_id=obj.department_id,
            budget_id=obj.budget_id,
            commitment_id=commitment.commitment_id,
            expense_id=obj.expense_id,
            alert_code="EXPENSE_EXCEEDS_COMMITMENT",
            category="commitment_breach",
            severity="high",
            title="Expense exceeds commitment",
            message=f"Expense of {float(obj.amount):,.2f} exceeds linked commitment amount of {float(commitment.amount):,.2f}.",
            entity_type="commitment",
            entity_id=commitment.commitment_id,
            owner_role="department_head",
            recommended_action="Review commitment scope and approve variance before settlement.",
            due_date=date.today() + timedelta(days=1),
        )

    # Rule 4: Budget utilization above 80%
    if budget and float(budget.allocated_budget) > 0:
        utilization = (float(total_spent) / float(budget.allocated_budget)) * 100

        if utilization >= 80 and utilization < 100:
            create_alert(
                db=db,
                department_id=obj.department_id,
                budget_id=obj.budget_id,
                expense_id=obj.expense_id,
                alert_code="BUDGET_UTILIZATION_80",
                category="forecast_risk",
                severity="medium",
                title="Budget utilization above 80%",
                message=f"Budget utilization has reached {utilization:.2f}%.",
                entity_type="budget",
                entity_id=obj.budget_id,
                owner_role="finance_manager",
                recommended_action="Review burn rate and planned spending before month end.",
                due_date=date.today() + timedelta(days=5),
            )

        if utilization >= 100:
            create_alert(
                db=db,
                department_id=obj.department_id,
                budget_id=obj.budget_id,
                expense_id=obj.expense_id,
                alert_code="BUDGET_EXCEEDED",
                category="budget_control",
                severity="critical",
                title="Budget exceeded",
                message=f"Total spend {float(total_spent):,.2f} has exceeded allocated budget {float(budget.allocated_budget):,.2f}.",
                entity_type="budget",
                entity_id=obj.budget_id,
                owner_role="finance_manager",
                recommended_action="Freeze further spending or initiate formal budget revision approval.",
                due_date=date.today() + timedelta(days=1),
            )

    # Rule 5: Multiple high-value expenses
    if recent_high_expense_count >= 3:
        create_alert(
            db=db,
            department_id=obj.department_id,
            budget_id=obj.budget_id,
            expense_id=obj.expense_id,
            alert_code="MULTIPLE_HIGH_EXPENSES",
            category="spend_anomaly",
            severity="high",
            title="Repeated high-value spending pattern",
            message=f"{recent_high_expense_count} high-value expenses have been recorded for this department.",
            entity_type="department",
            entity_id=obj.department_id,
            owner_role="internal_audit",
            recommended_action="Review whether this spending pattern indicates fragmentation or control weakness.",
            due_date=date.today() + timedelta(days=2),
        )

    db.commit()
    return obj


def get_budget_summary(db: Session, budget_id: int):
    budget = db.query(models.Budget).filter(models.Budget.budget_id == budget_id).first()
    if not budget:
        return None

    committed = db.query(func.coalesce(func.sum(models.Commitment.amount), 0)).filter(
        models.Commitment.budget_id == budget_id
    ).scalar()

    spent = db.query(func.coalesce(func.sum(models.Expense.amount), 0)).filter(
        models.Expense.budget_id == budget_id
    ).scalar()

    remaining = float(budget.allocated_budget) - float(committed) - float(spent)

    return {
        "budget_id": budget.budget_id,
        "department_id": budget.department_id,
        "budget_year": budget.budget_year,
        "allocated_budget": float(budget.allocated_budget),
        "committed_amount": float(committed),
        "spent_amount": float(spent),
        "remaining_amount": remaining
    }


def serialize_alert(a):
    return {
        "alert_id": a.alert_id,
        "department_id": a.department_id,
        "budget_id": a.budget_id,
        "commitment_id": a.commitment_id,
        "expense_id": a.expense_id,
        "alert_code": a.alert_code,
        "category": a.category,
        "severity": a.severity,
        "title": a.title,
        "message": a.message,
        "entity_type": a.entity_type,
        "entity_id": a.entity_id,
        "owner_role": a.owner_role,
        "status": a.status,
        "recommended_action": a.recommended_action,
        "due_date": str(a.due_date) if a.due_date else None,
        "acknowledged_by": a.acknowledged_by,
        "acknowledged_at": str(a.acknowledged_at) if a.acknowledged_at else None,
        "resolved_at": str(a.resolved_at) if a.resolved_at else None,
        "created_at": str(a.created_at) if a.created_at else None,
    }


def get_all_alerts(db: Session):
    alerts = db.query(models.Alert).order_by(models.Alert.created_at.desc()).all()
    return [serialize_alert(a) for a in alerts]


def get_open_alerts(db: Session):
    alerts = db.query(models.Alert).filter(
        models.Alert.status == "open"
    ).order_by(models.Alert.created_at.desc()).all()
    return [serialize_alert(a) for a in alerts]


def get_alerts_by_severity(db: Session, severity: str):
    alerts = db.query(models.Alert).filter(
        models.Alert.severity == severity
    ).order_by(models.Alert.created_at.desc()).all()
    return [serialize_alert(a) for a in alerts]


def acknowledge_alert(db: Session, alert_id: int, user_name: str):
    alert = db.query(models.Alert).filter(models.Alert.alert_id == alert_id).first()
    if not alert:
        return None

    alert.status = "acknowledged"
    alert.acknowledged_by = user_name
    alert.acknowledged_at = datetime.utcnow()
    db.commit()
    db.refresh(alert)
    return serialize_alert(alert)


def resolve_alert(db: Session, alert_id: int, user_name: str):
    alert = db.query(models.Alert).filter(models.Alert.alert_id == alert_id).first()
    if not alert:
        return None

    alert.status = "resolved"
    alert.acknowledged_by = user_name
    if alert.acknowledged_at is None:
        alert.acknowledged_at = datetime.utcnow()
    alert.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(alert)
    return serialize_alert(alert)


def dismiss_alert(db: Session, alert_id: int):
    alert = db.query(models.Alert).filter(models.Alert.alert_id == alert_id).first()
    if not alert:
        return None

    alert.status = "dismissed"
    db.commit()
    db.refresh(alert)
    return serialize_alert(alert)