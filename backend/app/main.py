from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import Base, engine
from app.routes import departments, budgets, commitments, expenses, dashboard, alerts
from app import models

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Simax Assure API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(departments.router)
app.include_router(budgets.router)
app.include_router(commitments.router)
app.include_router(expenses.router)
app.include_router(dashboard.router)
app.include_router(alerts.router)

@app.get("/")
def root():
    return {"message": "Simax Assure API running", "status": "ok"}

@app.get("/health")
def health():
    return {"status": "healthy"}