from pydantic import BaseModel
from typing import Optional


class DepartmentCreate(BaseModel):
    department_name: str
    manager_name: Optional[str] = None


class BudgetCreate(BaseModel):
    department_id: int
    budget_year: int
    allocated_budget: float


class CommitmentCreate(BaseModel):
    budget_id: int
    department_id: int
    description: str
    amount: float


class ExpenseCreate(BaseModel):
    budget_id: int
    commitment_id: Optional[int] = None
    department_id: int
    vendor: Optional[str] = None
    amount: float
    category: Optional[str] = None


class AlertActionRequest(BaseModel):
    user_name: Optional[str] = None


class AlertStatusUpdateRequest(BaseModel):
    user_name: Optional[str] = None
    status: str