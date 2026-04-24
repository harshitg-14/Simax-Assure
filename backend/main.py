from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db import Base, engine
from app.routes import departments, budgets, commitments, expenses, dashboard, alerts
from app import models
from app.routes import ai
# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Simax Assure API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(departments.router)
app.include_router(budgets.router)
app.include_router(commitments.router)
app.include_router(expenses.router)
app.include_router(dashboard.router)
app.include_router(alerts.router)
app.include_router(ai.router)
# Root APIs
@app.get("/")
def root():
    return {"message": "Simax Assure API running", "status": "ok"}

@app.get("/health")
def health():
    return {"status": "healthy"}


# 🔥 DATABASE DEPENDENCY
from database import get_db


# 🔥 EXPENSES API (already working)
@app.get("/expenses-total")
def get_expenses_total(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT SUM(amount) FROM expenses"))
    total = result.fetchone()[0]
    return {"total_expenses": total or 0}


# 🔥 REVENUE API (SAFE VERSION)
@app.get("/revenue-total")
def get_revenue_total(db: Session = Depends(get_db)):
    try:
        result = db.execute(text("SELECT SUM(amount) FROM revenue"))
        total = result.fetchone()[0]
        return {"total_revenue": total or 0}
    except:
        return {"total_revenue": 0}


# 🔥 PROFIT API (SAFE VERSION)
@app.get("/profit")
def get_profit(db: Session = Depends(get_db)):
    try:
        revenue = db.execute(text("SELECT SUM(amount) FROM revenue")).fetchone()[0] or 0
    except:
        revenue = 0

    expenses = db.execute(text("SELECT SUM(amount) FROM expenses")).fetchone()[0] or 0

    return {
        "revenue": revenue,
        "expenses": expenses,
        "profit": revenue - expenses
    }