# Simax Assure

Internal financial management platform for Simax. Tracks budgets, commitments, and expenses across departments, runs assurance rules on every expense submission, and routes spend through an approval workflow. Finance managers get an alert feed and an AI assistant for ad-hoc queries.

---

## Stack

**Backend** — FastAPI, SQLAlchemy, SQLite, python-jose (JWT), passlib/bcrypt, Google Gemini 2.5 Flash  
**Frontend** — React 19, Vite, Recharts, Axios

---

## Running locally

You need Python 3.10+ and Node 18+.

**Backend**

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Create a `.env` file in `backend/` before starting:

```
GEMINI_API_KEY=your_key_here
```

The SQLite database (`simax_assure.db`) is created automatically on first run. Migration columns (approval workflow, department scoping) are applied via `migrate_db()` on startup — safe to re-run.

**Frontend**

```bash
cd frontend-new
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`, API on `http://localhost:8000`.

---

## Default accounts

Seed users are created on first run. You can also create accounts from the User Management page once logged in as admin.

| Username | Password | Role |
|---|---|---|
| admin | admin123 | Admin |
| finance_manager | finance123 | Finance Manager |
| marketing_head | mkt123 | Department Head |

---

## Roles

**Admin** — full access to everything including user and department management.

**Finance Manager** — can view all departments, approve or reject commitments and expenses, see all alerts and reports.

**Department Head** — scoped to their own department only. Can log commitments and expenses, sees only their data.

**Viewer** — read-only access to commitments and expenditure.

Role-based restrictions are enforced server-side. The frontend also adjusts the sidebar and form inputs based on role.

---

## How spend flows

1. A budget is created for a department + fiscal year with an allocated amount.
2. Department heads log commitments (reserved spend) against a budget.
3. Actual expenses are logged against a budget, optionally linked to a commitment.
4. On expense submission, the rules engine runs checks (budget exceeded, high-value threshold, no linked commitment, etc.) and creates alerts where thresholds are breached.
5. Finance managers review pending commitments and expenses in the Approval Workflow page.

---

## AI features

There are two separate AI integrations, both using Gemini 2.5 Flash.

**Alert generation** — fires automatically on every expense submission. One function checks for actual budget overruns (reactive), another projects 30-day spend from current monthly average and alerts before a breach happens (predictive). Alerts go into the Assurance Monitor.

**AI chat** — the floating "Ask AI" button on every page. Sends the user's query along with total budget, total expenses, department-wise spend breakdown, and top 5 vendors to Gemini. Returns a structured JSON response with summary, insight, risk, and recommendation fields.

Current limitation: the chat doesn't filter by fiscal year and doesn't include commitment data. Queries like "what's our total spend" are answered accurately; queries about a specific period or category are less reliable.

---

## Project structure

```
backend/
  app/
    main.py          entry point, CORS, migrations
    models.py        SQLAlchemy models
    auth.py          JWT logic, password hashing
    db.py            SQLite connection
    crud.py          shared query helpers
    schemas.py       Pydantic schemas
    routes/          one file per resource
    services/
      ai_service.py  reactive + predictive alert generation

frontend-new/
  src/
    api/
      client.js      Axios instance with JWT interceptor
      services.js    one object per resource (budgetsApi, etc.)
    components/      Sidebar, Topbar, AIChat, QuickEntryModal, KpiCard
    context/
      AuthContext.js  user, role helpers, fiscal year state
      ThemeContext.jsx dark/light mode with localStorage persistence
    pages/           one file per route
    index.css        design tokens, global component styles
```

---

## Notes

- SQLite is used for simplicity. Switching to Postgres only requires changing `DATABASE_URL` in `app/db.py` — the `psycopg2` driver is already in requirements.
- JWT tokens expire after 8 hours. The frontend clears the session and redirects to login on any 401.
- Dark/light mode preference is saved to `localStorage` under the key `theme`.
- The fiscal year selector in the sidebar filters dashboard and budget views client-side; the API returns all years unless a year param is passed explicitly.
