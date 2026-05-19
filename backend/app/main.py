import logging
from fastapi import FastAPI

logging.basicConfig(level=logging.INFO)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.db import Base, engine, SessionLocal
from app import models
from app.auth import hash_password

from app.routes import (
    departments,
    budgets,
    commitments,
    expenses,
    dashboard,
    alerts,
    ai,
    auth,
    users,
    approvals,
    slm,
)

app = FastAPI(title="Simax Assure API")

Base.metadata.create_all(bind=engine)


def migrate_db():
    """Add approval workflow columns to existing tables without dropping data."""
    migrations = [
        ("commitments", "status",           "VARCHAR(20)",  "'pending'"),
        ("commitments", "submitted_by",     "VARCHAR(100)", "NULL"),
        ("commitments", "approved_by",      "VARCHAR(100)", "NULL"),
        ("commitments", "approved_at",      "TIMESTAMP",    "NULL"),
        ("commitments", "rejection_reason", "TEXT",         "NULL"),
        ("expenses",    "status",           "VARCHAR(20)",  "'pending'"),
        ("expenses",    "submitted_by",     "VARCHAR(100)", "NULL"),
        ("expenses",    "approved_by",      "VARCHAR(100)", "NULL"),
        ("expenses",    "approved_at",      "TIMESTAMP",    "NULL"),
        ("expenses",    "rejection_reason", "TEXT",         "NULL"),
        ("users",       "department_id",    "INTEGER",      "NULL"),
    ]
    with engine.connect() as conn:
        for table, col, typ, default in migrations:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {typ} DEFAULT {default}"))
                conn.commit()
            except Exception:
                pass  # column already exists


migrate_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(departments.router)
app.include_router(budgets.router)
app.include_router(commitments.router)
app.include_router(expenses.router)
app.include_router(dashboard.router)
app.include_router(alerts.router)
app.include_router(ai.router)
app.include_router(approvals.router)
app.include_router(slm.router)


DEFAULT_USERS = [
    {"username": "admin",           "email": "admin@simax.com",           "password": "admin123",   "role": "admin"},
    {"username": "finance_manager", "email": "finance@simax.com",         "password": "finance123", "role": "finance_manager"},
    {"username": "marketing_head",  "email": "marketing@simax.com",       "password": "mkt123",     "role": "department_head"},
    {"username": "it_head",         "email": "it@simax.com",              "password": "it123",      "role": "department_head"},
    {"username": "ops_head",        "email": "ops@simax.com",             "password": "ops123",     "role": "department_head"},
]


def seed_users():
    db = SessionLocal()
    try:
        for u in DEFAULT_USERS:
            exists = db.query(models.User).filter(models.User.username == u["username"]).first()
            if not exists:
                db.add(models.User(
                    username=u["username"],
                    email=u["email"],
                    password_hash=hash_password(u["password"]),
                    role=u["role"],
                ))
        db.commit()
    finally:
        db.close()


seed_users()


@app.get("/")
def root():
    return {"message": "Simax Assure API running", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "healthy"}
