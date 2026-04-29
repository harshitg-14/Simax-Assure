from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import Base, engine
from app import models

from app.routes import (
    departments,
    budgets,
    commitments,
    expenses,
    dashboard,
    alerts,
    ai
)

# ✅ CREATE APP FIRST
app = FastAPI(title="Simax Assure API")

# ✅ DB CREATE
Base.metadata.create_all(bind=engine)

# ✅ CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ ROUTERS (AFTER app is created)
app.include_router(departments.router)
app.include_router(budgets.router)
app.include_router(commitments.router)
app.include_router(expenses.router)
app.include_router(dashboard.router)
app.include_router(alerts.router)
app.include_router(ai.router)


# ✅ ROOT
@app.get("/")
def root():
    return {"message": "Simax Assure API running", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "healthy"}


