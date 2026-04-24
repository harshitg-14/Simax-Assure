# # backend/app/routes/ai.py

# import os
# from fastapi import APIRouter
# from app.db import SessionLocal
# from app.models import Expense, Budget, Department

# from google import genai

# router = APIRouter(prefix="/ai", tags=["AI"])

# # ✅ Create Gemini client (NEW SDK)
# client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


# @router.get("/ask")
# def ask_ai(query: str):
#     db = SessionLocal()

#     try:
#         # 🔥 Fetch real data
#         expenses = db.query(Expense).all()
#         budgets = db.query(Budget).all()
#         departments = db.query(Department).all()

#         total_expense = sum([e.amount for e in expenses]) if expenses else 0
#         total_budget = sum([b.amount for b in budgets]) if budgets else 0

#         # 🔥 Context for AI
#         context = f"""
#         You are a finance assistant.

#         Data:
#         - Total Expense: {total_expense}
#         - Total Budget: {total_budget}
#         - Number of Departments: {len(departments)}

#         User Question: {query}

#         Answer clearly.
#         """

#         # ✅ NEW Gemini call (THIS IS THE FIX)
#         response = client.models.generate_content(
#             model="gemini-2.0-flash",
#             contents=context
#         )

#         return {"answer": response.text}

#     except Exception as e:
#         return {"answer": f"Error: {str(e)}"}

#     finally:
#         db.close()

###

# backend/app/routes/ai.py

# backend/app/routes/ai.py

# backend/app/routes/ai.py

# backend/app/routes/ai.py

# backend/app/routes/ai.py

# backend/app/routes/ai.py

import os
import json
from fastapi import APIRouter
from app.db import SessionLocal
from app.models import Expense, Budget, Department

from google import genai

router = APIRouter(prefix="/ai", tags=["AI"])

# ✅ Force correct API version
client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY"),
    http_options={"api_version": "v1"}
)


@router.get("/ask")
def ask_ai(query: str):
    db = SessionLocal()

    try:
        # 🔥 Fetch data
        expenses = db.query(Expense).all()
        budgets = db.query(Budget).all()
        departments = db.query(Department).all()

        # ✅ Totals
        total_expense = sum(float(e.amount) for e in expenses) if expenses else 0
        total_budget = sum(float(b.allocated_budget) for b in budgets) if budgets else 0

        # ✅ Department-wise spend
        dept_map = {}
        for e in expenses:
            dept_map[e.department_id] = dept_map.get(e.department_id, 0) + float(e.amount)

        dept_context = "\n".join([
            f"- {d.department_name}: {dept_map.get(d.department_id, 0)}"
            for d in departments
        ])

        # ✅ Vendor-wise spend
        vendor_map = {}
        for e in expenses:
            if e.vendor:
                vendor_map[e.vendor] = vendor_map.get(e.vendor, 0) + float(e.amount)

        top_vendors = sorted(vendor_map.items(), key=lambda x: x[1], reverse=True)[:5]

        vendor_context = "\n".join([
            f"- {vendor}: {amount}" for vendor, amount in top_vendors
        ])

        # 🔥 IMPROVED PROMPT (VERY IMPORTANT)
        context = f"""
You are a financial AI assistant.

Return ONLY raw JSON.
Do NOT wrap in ```json or markdown.
Do NOT add explanations.

Format:
{{
  "summary": "...",
  "insight": "...",
  "risk": "...",
  "recommendation": "..."
}}

DATA:
Total Budget: {total_budget}
Total Expense: {total_expense}

Department Spend:
{dept_context}

Top Vendors:
{vendor_context}

User Question: {query}
"""

        # ✅ Gemini call
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=context
        )

        raw_text = response.text.strip()

        # 🔥 CLEAN MARKDOWN (CRITICAL FIX)
        if raw_text.startswith("```"):
            raw_text = raw_text.replace("```json", "").replace("```", "").strip()

        # ✅ Parse JSON safely
        try:
            parsed = json.loads(raw_text)
            return parsed
        except Exception:
            return {
                "summary": "AI response parsing failed",
                "insight": raw_text,
                "risk": "Unstructured output",
                "recommendation": "Check AI formatting"
            }

    except Exception as e:
        return {
            "summary": "Error occurred",
            "insight": str(e),
            "risk": "System failure",
            "recommendation": "Check backend logs"
        }

    finally:
        db.close()