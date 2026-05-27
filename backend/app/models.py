# from sqlalchemy import Column, Integer, String, Date, Text, DECIMAL, TIMESTAMP, ForeignKey
# from sqlalchemy.sql import func
# from app.db import Base


# class Department(Base):
#     __tablename__ = "departments"

#     department_id = Column(Integer, primary_key=True, index=True)
#     department_name = Column(String(100), nullable=False)
#     manager_name = Column(String(100))
#     created_date = Column(Date, server_default=func.current_date())


# class Budget(Base):
#     __tablename__ = "budgets"

#     budget_id = Column(Integer, primary_key=True, index=True)
#     department_id = Column(Integer, ForeignKey("departments.department_id", ondelete="CASCADE"), nullable=False)
#     budget_year = Column(Integer, nullable=False)
#     allocated_budget = Column(DECIMAL(14, 2), nullable=False, default=0)
#     created_date = Column(Date, server_default=func.current_date())


# class Commitment(Base):
#     __tablename__ = "commitments"

#     commitment_id = Column(Integer, primary_key=True, index=True)
#     budget_id = Column(Integer, ForeignKey("budgets.budget_id", ondelete="CASCADE"), nullable=False)
#     department_id = Column(Integer, ForeignKey("departments.department_id", ondelete="CASCADE"), nullable=False)
#     description = Column(Text, nullable=False)
#     amount = Column(DECIMAL(14, 2), nullable=False)
#     commitment_date = Column(Date, server_default=func.current_date())
#     created_at = Column(TIMESTAMP, server_default=func.now())


# class Expense(Base):
#     __tablename__ = "expenses"

#     expense_id = Column(Integer, primary_key=True, index=True)
#     budget_id = Column(Integer, ForeignKey("budgets.budget_id", ondelete="CASCADE"), nullable=False)
#     commitment_id = Column(Integer, ForeignKey("commitments.commitment_id", ondelete="SET NULL"), nullable=True)
#     department_id = Column(Integer, ForeignKey("departments.department_id", ondelete="CASCADE"), nullable=False)
#     vendor = Column(String(100))
#     amount = Column(DECIMAL(14, 2), nullable=False)
#     expense_date = Column(Date, server_default=func.current_date())
#     category = Column(String(100))
#     created_at = Column(TIMESTAMP, server_default=func.now())


# class Alert(Base):
#     __tablename__ = "alerts"

#     alert_id = Column(Integer, primary_key=True, index=True)

#     department_id = Column(Integer, ForeignKey("departments.department_id", ondelete="CASCADE"), nullable=True)
#     budget_id = Column(Integer, ForeignKey("budgets.budget_id", ondelete="CASCADE"), nullable=True)
#     commitment_id = Column(Integer, ForeignKey("commitments.commitment_id", ondelete="SET NULL"), nullable=True)
#     expense_id = Column(Integer, ForeignKey("expenses.expense_id", ondelete="SET NULL"), nullable=True)

#     alert_code = Column(String(50), nullable=False)
#     category = Column(String(50), nullable=False)
#     severity = Column(String(20), nullable=False)
#     title = Column(String(200), nullable=False)
#     message = Column(Text, nullable=False)

#     entity_type = Column(String(50), nullable=False)
#     entity_id = Column(Integer, nullable=False)

#     owner_role = Column(String(50), nullable=True)
#     status = Column(String(20), nullable=False, default="open")
#     recommended_action = Column(Text, nullable=True)

#     due_date = Column(Date, nullable=True)
#     acknowledged_by = Column(String(100), nullable=True)
#     acknowledged_at = Column(TIMESTAMP, nullable=True)
#     resolved_at = Column(TIMESTAMP, nullable=True)

#     created_at = Column(TIMESTAMP, server_default=func.now())

###


# backend/app/models.py

from sqlalchemy import Column, Integer, String, Date, Text, DECIMAL, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from app.db import Base


# =========================
# 👤 USER
# =========================
class User(Base):
    __tablename__ = "users"

    user_id      = Column(Integer, primary_key=True, index=True)
    username     = Column(String(100), unique=True, nullable=False)
    email        = Column(String(200), unique=True, nullable=False)
    password_hash = Column(String(200), nullable=False)
    role          = Column(String(50), nullable=False, default="viewer")
    department_id = Column(Integer, ForeignKey("departments.department_id", ondelete="SET NULL"), nullable=True)
    created_at    = Column(TIMESTAMP, server_default=func.now())


# =========================
# 🏢 DEPARTMENT
# =========================
class Department(Base):
    __tablename__ = "departments"

    department_id = Column(Integer, primary_key=True, index=True)
    department_name = Column(String(100), nullable=False)
    manager_name = Column(String(100), nullable=True)

    created_date = Column(Date, server_default=func.current_date())


# =========================
# 💰 BUDGET
# =========================
class Budget(Base):
    __tablename__ = "budgets"

    budget_id = Column(Integer, primary_key=True, index=True)

    department_id = Column(
        Integer,
        ForeignKey("departments.department_id", ondelete="CASCADE"),
        nullable=False
    )

    budget_year = Column(Integer, nullable=False)

    # 🔥 IMPORTANT FIELD (used in AI)
    allocated_budget = Column(DECIMAL(14, 2), nullable=False, default=0)

    created_date = Column(Date, server_default=func.current_date())


# =========================
# 📌 COMMITMENT
# =========================
class Commitment(Base):
    __tablename__ = "commitments"

    commitment_id = Column(Integer, primary_key=True, index=True)

    budget_id = Column(
        Integer,
        ForeignKey("budgets.budget_id", ondelete="CASCADE"),
        nullable=False
    )

    department_id = Column(
        Integer,
        ForeignKey("departments.department_id", ondelete="CASCADE"),
        nullable=False
    )

    description = Column(Text, nullable=False)

    # 🔥 Financial field
    amount = Column(DECIMAL(14, 2), nullable=False)

    commitment_date = Column(Date, server_default=func.current_date())
    created_at = Column(TIMESTAMP, server_default=func.now())

    # Approval workflow
    status           = Column(String(20), nullable=True, default="pending")
    submitted_by     = Column(String(100), nullable=True)
    approved_by      = Column(String(100), nullable=True)
    approved_at      = Column(TIMESTAMP, nullable=True)
    rejection_reason = Column(Text, nullable=True)


# =========================
# 💸 EXPENSE
# =========================
class Expense(Base):
    __tablename__ = "expenses"

    expense_id = Column(Integer, primary_key=True, index=True)

    budget_id = Column(
        Integer,
        ForeignKey("budgets.budget_id", ondelete="CASCADE"),
        nullable=False
    )

    commitment_id = Column(
        Integer,
        ForeignKey("commitments.commitment_id", ondelete="SET NULL"),
        nullable=True
    )

    department_id = Column(
        Integer,
        ForeignKey("departments.department_id", ondelete="CASCADE"),
        nullable=False
    )

    vendor = Column(String(100), nullable=True)

    # 🔥 MAIN FIELD USED EVERYWHERE
    amount = Column(DECIMAL(14, 2), nullable=False)

    expense_date = Column(Date, server_default=func.current_date())
    category = Column(String(100), nullable=True)

    created_at = Column(TIMESTAMP, server_default=func.now())

    # Approval workflow
    status           = Column(String(20), nullable=True, default="pending")
    submitted_by     = Column(String(100), nullable=True)
    approved_by      = Column(String(100), nullable=True)
    approved_at      = Column(TIMESTAMP, nullable=True)
    rejection_reason = Column(Text, nullable=True)

    receipt_path     = Column(String(500), nullable=True)


# =========================
# 📝 BUDGET REVISION
# =========================
class BudgetRevision(Base):
    __tablename__ = "budget_revisions"

    revision_id      = Column(Integer, primary_key=True, index=True)
    budget_id        = Column(Integer, ForeignKey("budgets.budget_id", ondelete="CASCADE"), nullable=False)
    department_id    = Column(Integer, ForeignKey("departments.department_id", ondelete="CASCADE"), nullable=False)
    requested_by     = Column(String(100), nullable=False)
    current_amount   = Column(DECIMAL(14, 2), nullable=False)
    requested_amount = Column(DECIMAL(14, 2), nullable=False)
    reason           = Column(Text, nullable=False)
    status           = Column(String(20), nullable=False, default="pending")
    reviewed_by      = Column(String(100), nullable=True)
    reviewed_at      = Column(TIMESTAMP, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at       = Column(TIMESTAMP, server_default=func.now())


# =========================
# 🚨 ALERT
# =========================
class Alert(Base):
    __tablename__ = "alerts"

    alert_id = Column(Integer, primary_key=True, index=True)

    department_id = Column(
        Integer,
        ForeignKey("departments.department_id", ondelete="CASCADE"),
        nullable=True
    )

    budget_id = Column(
        Integer,
        ForeignKey("budgets.budget_id", ondelete="CASCADE"),
        nullable=True
    )

    commitment_id = Column(
        Integer,
        ForeignKey("commitments.commitment_id", ondelete="SET NULL"),
        nullable=True
    )

    expense_id = Column(
        Integer,
        ForeignKey("expenses.expense_id", ondelete="SET NULL"),
        nullable=True
    )

    alert_code = Column(String(50), nullable=False)
    category = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)

    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)

    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)

    owner_role = Column(String(50), nullable=True)

    # 🔥 STATUS CONTROL
    status = Column(String(20), nullable=False, default="open")

    recommended_action = Column(Text, nullable=True)

    due_date = Column(Date, nullable=True)

    acknowledged_by = Column(String(100), nullable=True)
    acknowledged_at = Column(TIMESTAMP, nullable=True)

    resolved_at = Column(TIMESTAMP, nullable=True)

    created_at = Column(TIMESTAMP, server_default=func.now())


# =========================
# 📅 SCHEDULED REPORT CONFIG
# =========================
class ScheduledReport(Base):
    __tablename__ = "scheduled_reports"

    id           = Column(Integer, primary_key=True, index=True)
    enabled      = Column(Integer, nullable=False, default=0)
    frequency    = Column(String(20), nullable=False, default="weekly")
    day_of_week  = Column(Integer, nullable=True, default=0)
    day_of_month = Column(Integer, nullable=True, default=1)
    hour         = Column(Integer, nullable=False, default=8)
    recipients   = Column(Text, nullable=True, default="[]")
    last_sent_at = Column(TIMESTAMP, nullable=True)


# =========================
# 📋 AUDIT LOG
# =========================
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id          = Column(Integer, primary_key=True, index=True)
    action      = Column(String(50),  nullable=False)
    entity_type = Column(String(50),  nullable=False)
    entity_ref  = Column(String(30),  nullable=True)
    entity_id   = Column(Integer,     nullable=False)
    actor       = Column(String(100), nullable=False)
    detail      = Column(Text,        nullable=True)
    amount      = Column(DECIMAL(14, 2), nullable=True)
    dept_name   = Column(String(100), nullable=True)
    created_at  = Column(TIMESTAMP,   server_default=func.now())