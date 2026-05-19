# Simax Assure — Complete Architecture & System Documentation

---

## 1. What Is Simax Assure?

Simax Assure is an internal financial management platform built for organizations to track budgets, expenses, commitments, vendor payments, and departmental spending. It includes an AI layer that generates real-time alerts and answers financial queries using both a local language model and a cloud AI fallback.

The platform is designed for three user roles: admins, finance managers, and department heads. Each role has controlled access to data and actions.

---

## 2. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend Framework | FastAPI | 0.135.1 |
| Language | Python | 3.x |
| Database | SQLite (file-based) | via SQLAlchemy 2.0.48 |
| ORM | SQLAlchemy | 2.0.48 |
| Authentication | JWT (python-jose) | 3.3.0 |
| Password Hashing | Passlib + bcrypt | 1.7.4 / 4.0.1 |
| Local AI Model | Mistral 7B (via Ollama) | mistral:latest |
| Cloud AI | Google Gemini 2.5 Flash | google-genai ≥1.0.0 |
| HTTP Client | Requests | 2.32.5 |
| Data Validation | Pydantic | 2.12.5 |
| ASGI Server | Uvicorn | 0.42.0 |
| Frontend (analytics) | Streamlit | 1.55.0 |

---

## 3. Project Structure

```
Simax-Assure/
├── backend/
│   ├── app/
│   │   ├── main.py                  ← App entry point, middleware, seeding
│   │   ├── db.py                    ← SQLite connection, session factory
│   │   ├── models.py                ← SQLAlchemy ORM models (6 tables)
│   │   ├── schemas.py               ← Pydantic request/response models
│   │   ├── auth.py                  ← JWT auth, password hashing
│   │   ├── crud.py                  ← Database helper functions
│   │   ├── routes/
│   │   │   ├── auth.py              ← Login, /me, change-password
│   │   │   ├── users.py             ← User CRUD
│   │   │   ├── departments.py       ← Department CRUD
│   │   │   ├── budgets.py           ← Budget CRUD
│   │   │   ├── commitments.py       ← Commitment CRUD + approval
│   │   │   ├── expenses.py          ← Expense CRUD + AI alert trigger
│   │   │   ├── alerts.py            ← Alert management (ack/resolve/dismiss)
│   │   │   ├── approvals.py         ← Approval workflow (commit + expense)
│   │   │   ├── dashboard.py         ← Analytics endpoints
│   │   │   ├── ai.py                ← Hybrid AI query endpoint
│   │   │   └── slm.py               ← Direct Mistral endpoint + status
│   │   └── services/
│   │       ├── ai_service.py        ← Gemini alert generation
│   │       ├── slm_service.py       ← Mistral (Ollama) query service
│   │       └── query_classifier.py  ← Routes queries to SLM or Gemini
│   └── simax_assure.db              ← SQLite database file
└── requirements.txt
```

---

## 4. Database Schema

### 4.1 Users Table (`users`)

Stores all platform users with role-based access.

| Column | Type | Details |
|--------|------|---------|
| user_id | Integer | Primary key |
| username | String(100) | Unique |
| email | String(200) | Unique |
| password_hash | String(200) | bcrypt hash |
| role | String(50) | admin / finance_manager / department_head / viewer |
| department_id | Integer | FK → departments (nullable) |
| created_at | TIMESTAMP | Auto set on creation |

**Default seeded users:**

| Username | Role | Password |
|----------|------|----------|
| admin | admin | admin123 |
| finance_manager | finance_manager | finance123 |
| marketing_head | department_head | mkt123 |
| it_head | department_head | it123 |
| ops_head | department_head | ops123 |

---

### 4.2 Departments Table (`departments`)

Organizational units that own budgets and expenses.

| Column | Type | Details |
|--------|------|---------|
| department_id | Integer | Primary key |
| department_name | String(100) | Required |
| manager_name | String(100) | Optional |
| created_date | Date | Auto set |

---

### 4.3 Budgets Table (`budgets`)

Yearly allocated budget per department.

| Column | Type | Details |
|--------|------|---------|
| budget_id | Integer | Primary key |
| department_id | Integer | FK → departments (CASCADE delete) |
| budget_year | Integer | e.g. 2024, 2025 |
| allocated_budget | DECIMAL(14,2) | Total approved budget |
| created_date | Date | Auto set |

---

### 4.4 Commitments Table (`commitments`)

A commitment is a planned or forecasted expense — not yet spent, but reserved.

| Column | Type | Details |
|--------|------|---------|
| commitment_id | Integer | Primary key |
| budget_id | Integer | FK → budgets (CASCADE) |
| department_id | Integer | FK → departments (CASCADE) |
| description | Text | Required |
| amount | DECIMAL(14,2) | Reserved amount |
| commitment_date | Date | Auto set |
| created_at | TIMESTAMP | Auto set |
| status | String(20) | pending / approved / rejected |
| submitted_by | String(100) | Username who submitted |
| approved_by | String(100) | Username who approved/rejected |
| approved_at | TIMESTAMP | When action taken |
| rejection_reason | Text | Optional rejection note |

---

### 4.5 Expenses Table (`expenses`)

Actual money spent, linked to a budget and optionally a commitment.

| Column | Type | Details |
|--------|------|---------|
| expense_id | Integer | Primary key |
| budget_id | Integer | FK → budgets (CASCADE) |
| commitment_id | Integer | FK → commitments (SET NULL, optional) |
| department_id | Integer | FK → departments (CASCADE) |
| vendor | String(100) | Who was paid (optional) |
| amount | DECIMAL(14,2) | Amount spent |
| expense_date | Date | Auto set |
| category | String(100) | e.g. IT, Marketing, Travel |
| created_at | TIMESTAMP | Auto set |
| status | String(20) | pending / approved / rejected |
| submitted_by | String(100) | Who created it |
| approved_by | String(100) | Who approved/rejected |
| approved_at | TIMESTAMP | When actioned |
| rejection_reason | Text | Optional |

---

### 4.6 Alerts Table (`alerts`)

AI-generated financial alerts. Created automatically when expenses are logged.

| Column | Type | Details |
|--------|------|---------|
| alert_id | Integer | Primary key |
| department_id | Integer | FK → departments |
| budget_id | Integer | FK → budgets |
| commitment_id | Integer | FK → commitments (nullable) |
| expense_id | Integer | FK → expenses (nullable) |
| alert_code | String(50) | BUDGET_EXCEEDED / PREDICTED_OVERRUN |
| category | String(50) | Financial / Prediction / ai_generated |
| severity | String(20) | low / medium / high / critical |
| title | String(200) | Short summary from AI |
| message | Text | Detailed insight from AI |
| entity_type | String(50) | expense / budget |
| entity_id | Integer | ID of the triggering entity |
| owner_role | String(50) | Who should act on this |
| status | String(20) | open / acknowledged / resolved / dismissed |
| recommended_action | Text | AI recommendation |
| due_date | Date | Optional deadline |
| acknowledged_by | String(100) | Username |
| acknowledged_at | TIMESTAMP | When acknowledged |
| resolved_at | TIMESTAMP | When resolved |
| created_at | TIMESTAMP | Auto set |

---

### Entity Relationship Summary

```
departments
    └── budgets (one department → many budgets)
         └── commitments (one budget → many commitments)
         └── expenses (one budget → many expenses)
              └── alerts (one expense → triggers alerts)
```

---

## 5. Authentication System

**File:** `backend/app/auth.py`

- Uses **JWT (JSON Web Tokens)** with HS256 algorithm
- Secret key: `simax-assure-jwt-secret-change-in-production`
- Token expires after **8 hours**
- Passwords hashed using **bcrypt** via Passlib
- OAuth2 Bearer token scheme — token passed in `Authorization: Bearer <token>` header

**Flow:**
1. User POSTs to `/auth/login` with username + password
2. Backend verifies bcrypt hash
3. Returns JWT token + user object
4. All protected endpoints validate token via `get_current_user()` dependency

---

## 6. API Endpoints — Complete Reference

### 6.1 Authentication (`/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/login` | Login, returns JWT token | No |
| GET | `/auth/me` | Returns current user info | Yes |
| PUT | `/auth/change-password` | Change own password | Yes |

---

### 6.2 Users (`/users`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users/` | List all users | Yes |
| POST | `/users/` | Create user | Yes |
| PUT | `/users/{id}` | Update user | Yes |
| DELETE | `/users/{id}` | Delete user | Yes |

---

### 6.3 Departments (`/departments`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/departments/` | List all departments |
| POST | `/departments/` | Create department |
| PUT | `/departments/{id}` | Update department |
| DELETE | `/departments/{id}` | Delete department |

---

### 6.4 Budgets (`/budgets`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/budgets/` | List budgets (filter by dept/year) |
| POST | `/budgets/` | Create budget |
| DELETE | `/budgets/{id}` | Delete budget |

---

### 6.5 Commitments (`/commitments`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/commitments/` | List commitments |
| POST | `/commitments/` | Create commitment (sets status=pending) |
| DELETE | `/commitments/{id}` | Delete commitment |

---

### 6.6 Expenses (`/expenses`)

| Method | Endpoint | Description | Special Behavior |
|--------|----------|-------------|-----------------|
| GET | `/expenses/` | List expenses | Dept heads see only own dept |
| GET | `/expenses/{id}` | Get single expense | — |
| POST | `/expenses/` | Create expense | Triggers AI reactive + predictive alerts |
| DELETE | `/expenses/{id}` | Delete expense | — |

**This is the most important endpoint.** Every time an expense is created, it automatically:
1. Runs `generate_ai_alert()` — checks if budget is exceeded, generates Gemini alert if yes
2. Runs `generate_predictive_alert()` — projects 30-day spend, generates alert if projection exceeds budget

---

### 6.7 Alerts (`/alerts`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/alerts/` | List all alerts (filter by status/severity) |
| GET | `/alerts/open` | Open alerts only |
| GET | `/alerts/{id}` | Single alert |
| PUT | `/alerts/{id}/acknowledge` | Mark as acknowledged |
| PUT | `/alerts/{id}/resolve` | Mark as resolved |
| PUT | `/alerts/{id}/dismiss` | Dismiss alert |
| PATCH | `/alerts/{id}` | Update status generically |
| DELETE | `/alerts/{id}` | Delete alert |

---

### 6.8 Approvals (`/approvals`)

Role-restricted to admin and finance_manager only.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/approvals/summary` | Count of pending/approved/rejected |
| GET | `/approvals/pending` | All pending commitments + expenses |
| GET | `/approvals/history` | Last 60 approved/rejected items |
| PUT | `/approvals/commitments/{id}/approve` | Approve commitment |
| PUT | `/approvals/commitments/{id}/reject` | Reject commitment |
| PUT | `/approvals/expenses/{id}/approve` | Approve expense |
| PUT | `/approvals/expenses/{id}/reject` | Reject expense |

---

### 6.9 Dashboard (`/dashboard`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard/{budget_id}` | Budget summary (total/spent/remaining) |
| GET | `/dashboard/monthly-trend` | Monthly spend grouped by month |
| GET | `/dashboard/anomalies` | Expenses 2× above average (spike detection) |
| GET | `/dashboard/department-risk` | Risk ranking per department |
| GET | `/dashboard/alerts-summary` | Alert counts by severity |
| GET | `/dashboard/top-alerts` | Most recent 5 alerts |

---

### 6.10 AI Query (`/ai`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ai/ask?query=...` | Smart query — routes to Mistral or Gemini based on complexity |

**Routing logic:**
- Query classifier scores the query
- Score < 4 → Simple → Mistral (free, local, ~20s)
- Score ≥ 4 → Complex → Gemini (paid, cloud, ~2s)
- If Mistral is offline → fallback to Gemini automatically

---

### 6.11 SLM Direct (`/slm`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/slm/query?query=...` | Direct query to Mistral only, no fallback |
| GET | `/slm/status` | Check if Ollama + Mistral is running |
| GET | `/slm/classify?query=...` | Debug — shows how a query would be classified |

---

## 7. AI Layer — Detailed Breakdown

### 7.1 Query Classifier (`query_classifier.py`)

Scores every incoming query to decide which AI handles it.

**Complexity signals (push to Gemini, +3 each):**
- analyze, compare, trend, forecast, predict, why, reason, pattern, anomaly, risk, insight, strategy, correlation, quarter, year over year

**Simplicity signals (push to Mistral, -2 each):**
- what is, how much, total, show, list, remaining, balance, current, summary, overview

**Additional scoring:**
- Query length > 100 chars: +2
- Multiple department references: +2
- Time range keywords (last month, YTD): +2
- Query length < 50 chars: -1

**Threshold:** score ≥ 4 → Gemini. score < 4 → Mistral.

---

### 7.2 Mistral / SLM Service (`slm_service.py`)

- Connects to `http://127.0.0.1:11434/api/generate`
- Model: `mistral` (maps to `mistral:latest` in Ollama)
- Timeout: 120 seconds
- Builds context from live DB: total budget, total spent, remaining, per-department spend, top 3 vendors
- Prompt instructs model to return raw JSON with: summary, insight, risk, recommendation
- Returns `{"model": "slm"}` on success, `None` on any error (triggers Gemini fallback)

---

### 7.3 Gemini Service (`ai_service.py`)

Used for two purposes:

**Reactive Alerts:** Fires when total expense > allocated budget
- Calculates overrun percentage
- Severity: >25% overrun = critical, >10% = high, else medium
- Deduplication: skips if same alert type was created in last 24 hours

**Predictive Alerts:** Fires when 30-day projection exceeds budget
- Formula: `avg_daily_spend × 30`
- Same severity thresholds as reactive
- Same 24-hour dedup guard

Both use Gemini 2.5 Flash via the `google-genai` SDK.

---

### 7.4 AI Flow When an Expense Is Created

```
POST /expenses/
    │
    ├── Create expense in DB
    │
    ├── generate_ai_alert(db, expense)
    │       ├── Check: total_expense > allocated_budget?
    │       ├── Check: already alerted today?
    │       ├── Call Gemini 2.5 Flash
    │       └── Save Alert to DB (BUDGET_EXCEEDED)
    │
    └── generate_predictive_alert(db, expense)
            ├── Calculate 30-day projection
            ├── Check: projected > allocated_budget?
            ├── Check: already alerted today?
            ├── Call Gemini 2.5 Flash
            └── Save Alert to DB (PREDICTED_OVERRUN)
```

---

## 8. Role-Based Access Control

| Feature | admin | finance_manager | department_head | viewer |
|---------|-------|----------------|-----------------|--------|
| View all expenses | Yes | Yes | Own dept only | No |
| Create expense | Yes | Yes | Own dept only | No |
| Approve/reject | Yes | Yes | No | No |
| View alerts | Yes | Yes | Yes | No |
| Manage users | Yes | No | No | No |
| AI queries | Yes | Yes | Yes | No |

---

## 9. Dashboard Analytics

### Anomaly Detection
Flags any expense where `amount > 2 × average_expense_amount`. Simple statistical spike detection — no ML involved.

### Department Risk Ranking
Calculates `usage_percent = (total_expense / allocated_budget) × 100` per department:
- > 90% → High risk
- > 70% → Medium risk
- ≤ 70% → Low risk

### Monthly Trend
Groups expenses by month for a given budget, returns spend per month for charting.

---

## 10. Application Startup

On every startup, `main.py` runs two operations:

1. **`migrate_db()`** — Adds approval workflow columns (status, submitted_by, approved_by, approved_at, rejection_reason) to commitments, expenses, and users tables if they don't exist. Uses `ALTER TABLE ... ADD COLUMN` with silent failure if column already exists.

2. **`seed_users()`** — Creates 5 default users (admin, finance_manager, 3 department heads) if they don't exist. Safe to run repeatedly.

---

## 11. Current Limitations

- **Database:** SQLite — not suitable for concurrent multi-user production load. Should be migrated to PostgreSQL for production.
- **JWT Secret:** Hardcoded in `auth.py`. Must be moved to environment variable before production deployment.
- **No refresh tokens:** Token expires after 8 hours, user must re-login.
- **AI timeout:** Mistral cold-start can take 60-90 seconds on CPU. First query after server restart is always slow.
- **No file uploads:** Expense receipts or documents cannot be attached.
- **SQLite WAL mode not enabled:** Concurrent writes may cause locking issues.
