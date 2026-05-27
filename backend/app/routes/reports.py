from io import BytesIO
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from fpdf import FPDF
from app.db import get_db
from app import models

router = APIRouter(prefix="/reports", tags=["Reports"])

# ── Palette ────────────────────────────────────────────────────────────────────
GOLD    = (201, 151, 10)
DARK    = (10,  18,  32)
MID     = (18,  37,  64)
LIGHT   = (235, 240, 248)
WHITE   = (255, 255, 255)
DANGER  = (220, 38,  38)
SUCCESS = (5,   150, 105)
WARN    = (217, 119, 6)
MUTED   = (100, 120, 150)

SEV_COLOR = {"critical": DANGER, "high": WARN, "medium": (245, 158, 11), "low": SUCCESS}


def _fmt(n) -> str:
    return f"Rs {float(n or 0):,.2f}"


def _s(text) -> str:
    """Strip characters outside Latin-1 so Helvetica doesn't crash."""
    return str(text or "").encode("latin-1", errors="replace").decode("latin-1")


class SimaxPDF(FPDF):
    def header(self):
        self.set_fill_color(*GOLD)
        self.rect(0, 0, 210, 2.5, "F")
        self.set_xy(10, 7)
        self.set_font("Helvetica", "B", 15)
        self.set_text_color(*DARK)
        self.cell(0, 7, "SimaxAssure", ln=True)
        self.set_font("Helvetica", "", 6.5)
        self.set_text_color(*MUTED)
        self.set_x(10)
        self.cell(0, 4, "FINANCIAL INTELLIGENCE PLATFORM", ln=True)
        self.ln(1)
        self.set_draw_color(*GOLD)
        self.set_line_width(0.25)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(3)

    def footer(self):
        self.set_y(-11)
        self.set_font("Helvetica", "", 7.5)
        self.set_text_color(*MUTED)
        self.cell(0, 5, f"Simax Assure - Confidential  |  Page {self.page_no()}", align="C")

    def section_title(self, title: str):
        self.set_font("Helvetica", "B", 9)
        self.set_fill_color(*MID)
        self.set_text_color(*GOLD)
        self.cell(0, 6.5, f"  {title}", ln=True, fill=True)
        self.ln(2)

    def th(self, cols):
        self.set_font("Helvetica", "B", 7.5)
        self.set_fill_color(*MID)
        self.set_text_color(*WHITE)
        for label, w, align in cols:
            self.cell(w, 5.5, label, fill=True, align=align)
        self.ln()

    def td(self, cols, zebra=False, text_color=None):
        self.set_font("Helvetica", "", 7.5)
        self.set_fill_color(*(LIGHT if zebra else WHITE))
        self.set_text_color(*(text_color or DARK))
        for val, w, align in cols:
            self.cell(w, 5, str(val), fill=zebra, align=align)
        self.ln()
        self.set_text_color(*DARK)

    def tr_total(self, cols):
        self.set_font("Helvetica", "B", 7.5)
        self.set_fill_color(220, 228, 240)
        self.set_text_color(*DARK)
        for val, w, align in cols:
            self.cell(w, 5.5, str(val), fill=True, align=align)
        self.ln()


@router.get("/yoy")
def year_over_year(
    year_a: int = Query(2024),
    year_b: int = Query(2025),
    db: Session = Depends(get_db),
):
    depts    = db.query(models.Department).all()
    budgets  = db.query(models.Budget).all()
    expenses = db.query(models.Expense).all()

    dept_map = {d.department_id: d.department_name for d in depts}

    def year_stats(year):
        yb = [b for b in budgets if b.budget_year == year]
        ye = [e for e in expenses
              if e.expense_date and e.expense_date.year == year]
        total_budget = sum(float(b.allocated_budget or 0) for b in yb)
        total_spent  = sum(float(e.amount or 0) for e in ye)
        return {"budget": total_budget, "spent": total_spent,
                "utilization": round((total_spent / total_budget * 100) if total_budget else 0, 1)}

    def monthly_spend(year):
        totals = {}
        for e in expenses:
            if e.expense_date and e.expense_date.year == year:
                m = e.expense_date.month
                totals[m] = totals.get(m, 0) + float(e.amount or 0)
        return [{"month": m, "total": round(totals.get(m, 0), 2)} for m in range(1, 13)]

    def dept_stats(dept_id, year):
        yb = [b for b in budgets if b.budget_year == year and b.department_id == dept_id]
        ye = [e for e in expenses
              if e.department_id == dept_id and e.expense_date and e.expense_date.year == year]
        budget = sum(float(b.allocated_budget or 0) for b in yb)
        spent  = sum(float(e.amount or 0) for e in ye)
        return {"budget": budget, "spent": spent,
                "utilization": round((spent / budget * 100) if budget else 0, 1)}

    def pct_change(old, new):
        if old == 0:
            return None
        return round(((new - old) / old) * 100, 1)

    dept_rows = []
    for d in depts:
        sa = dept_stats(d.department_id, year_a)
        sb = dept_stats(d.department_id, year_b)
        if sa["budget"] == 0 and sb["budget"] == 0:
            continue
        dept_rows.append({
            "department":        d.department_name,
            "year_a":            sa,
            "year_b":            sb,
            "budget_change_pct": pct_change(sa["budget"], sb["budget"]),
            "spend_change_pct":  pct_change(sa["spent"],  sb["spent"]),
        })

    return {
        "year_a":      year_a,
        "year_b":      year_b,
        "summary_a":   year_stats(year_a),
        "summary_b":   year_stats(year_b),
        "departments": dept_rows,
        "monthly_a":   monthly_spend(year_a),
        "monthly_b":   monthly_spend(year_b),
    }


def _build_pdf(year: int, db: Session) -> bytes:
    budgets     = db.query(models.Budget).filter(models.Budget.budget_year == year).all()
    depts       = db.query(models.Department).all()
    expenses    = db.query(models.Expense).all()
    commitments = db.query(models.Commitment).all()
    alerts      = db.query(models.Alert).all()

    dept_map = {d.department_id: d.department_name for d in depts}

    # ── Variance ──────────────────────────────────────────────────────────────
    variance_rows = []
    total_alloc = total_spent_fy = 0.0
    for b in budgets:
        spent = sum(float(e.amount) for e in expenses if e.budget_id == b.budget_id)
        alloc = float(b.allocated_budget or 0)
        variance_rows.append((
            dept_map.get(b.department_id, "-"),
            alloc, spent, spent - alloc,
            round((spent / alloc * 100) if alloc else 0, 1),
        ))
        total_alloc += alloc
        total_spent_fy += spent
    util_pct = round((total_spent_fy / total_alloc * 100) if total_alloc else 0, 1)

    # ── Vendors ───────────────────────────────────────────────────────────────
    v_map: dict[str, float] = {}
    for e in expenses:
        if e.vendor:
            v_map[e.vendor] = v_map.get(e.vendor, 0) + float(e.amount or 0)
    top_vendors = sorted(v_map.items(), key=lambda x: x[1], reverse=True)[:10]
    all_exp_total = sum(float(e.amount or 0) for e in expenses)

    # ── Categories ────────────────────────────────────────────────────────────
    c_map: dict[str, float] = {}
    for e in expenses:
        cat = e.category or "Other"
        c_map[cat] = c_map.get(cat, 0) + float(e.amount or 0)
    cat_total = sum(c_map.values())
    categories = sorted(c_map.items(), key=lambda x: x[1], reverse=True)

    # ── Alerts ────────────────────────────────────────────────────────────────
    open_alerts = [a for a in alerts if a.status == "open"]
    sev_counts: dict[str, int] = {}
    for a in alerts:
        s = (a.severity or "unknown").lower()
        sev_counts[s] = sev_counts.get(s, 0) + 1

    # ── Recent expenses ────────────────────────────────────────────────────────
    recent = sorted(expenses, key=lambda e: str(e.created_at or ""), reverse=True)[:15]

    # ── Build PDF ─────────────────────────────────────────────────────────────
    pdf = SimaxPDF()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    # Report title
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(*DARK)
    pdf.cell(0, 7, _s(f"Financial Report -- FY {year}"), ln=True)
    pdf.set_font("Helvetica", "", 7.5)
    pdf.set_text_color(*MUTED)
    pdf.cell(0, 5, _s(f"Generated {datetime.now().strftime('%d %b %Y, %I:%M %p')}  |  All amounts in INR"), ln=True)
    pdf.ln(3)

    # KPI strip
    remaining = total_alloc - total_spent_fy
    kpis = [
        ("Total Budget",   _fmt(total_alloc),    None),
        ("Total Spent",    _fmt(total_spent_fy),  WARN),
        ("Remaining",      _fmt(remaining),        DANGER if remaining < 0 else SUCCESS),
        ("Utilization",    f"{util_pct}%",         DANGER if util_pct > 90 else (WARN if util_pct > 70 else SUCCESS)),
        ("Open Alerts",    str(len(open_alerts)),  DANGER if open_alerts else SUCCESS),
    ]
    kpi_w = 38
    y0 = pdf.get_y()
    for idx, (label, val, color) in enumerate(kpis):
        x = 10 + idx * kpi_w
        pdf.set_fill_color(*LIGHT)
        pdf.rect(x, y0, kpi_w - 1, 13, "F")
        pdf.set_xy(x + 2, y0 + 1)
        pdf.set_font("Helvetica", "", 6.5)
        pdf.set_text_color(*MUTED)
        pdf.cell(kpi_w - 4, 4, label)
        pdf.set_xy(x + 2, y0 + 5.5)
        pdf.set_font("Helvetica", "B", 8.5)
        pdf.set_text_color(*(color or DARK))
        pdf.cell(kpi_w - 4, 5, val)
    pdf.set_y(y0 + 17)

    # ── 1. Variance ───────────────────────────────────────────────────────────
    pdf.section_title("1.  BUDGET VS ACTUAL VARIANCE")
    cols = [("Department", 54, "L"), ("Allocated", 36, "R"), ("Spent", 36, "R"), ("Variance", 36, "R"), ("Util %", 22, "C")]
    pdf.th(cols)
    for i, (dept, alloc, spent, var, pct) in enumerate(variance_rows):
        color = DANGER if var > 0 else (WARN if pct >= 80 else None)
        pdf.td([(_s(dept), 54, "L"), (_fmt(alloc), 36, "R"), (_fmt(spent), 36, "R"),
                (_fmt(var), 36, "R"), (f"{pct}%", 22, "C")], zebra=(i % 2 == 1), text_color=color)
    pdf.tr_total([("TOTAL", 54, "L"), (_fmt(total_alloc), 36, "R"),
                  (_fmt(total_spent_fy), 36, "R"), (_fmt(total_spent_fy - total_alloc), 36, "R"),
                  (_s(f"{util_pct}%"), 22, "C")])
    pdf.ln(4)

    # ── 2. Top Vendors ────────────────────────────────────────────────────────
    pdf.section_title("2.  TOP VENDORS BY SPEND")
    cols = [("#", 9, "C"), ("Vendor", 85, "L"), ("Total Spend", 48, "R"), ("Share %", 24, "C"), ("Txns", 18, "C")]
    pdf.th(cols)
    for i, (vendor, total) in enumerate(top_vendors):
        txns = sum(1 for e in expenses if e.vendor == vendor)
        share = f"{(total / all_exp_total * 100):.1f}%" if all_exp_total else "0%"
        pdf.td([(str(i + 1), 9, "C"), (_s(vendor)[:35], 85, "L"), (_fmt(total), 48, "R"),
                (share, 24, "C"), (str(txns), 18, "C")], zebra=(i % 2 == 1))
    pdf.ln(4)

    # ── 3. Category Breakdown ─────────────────────────────────────────────────
    pdf.section_title("3.  EXPENSE CATEGORY BREAKDOWN")
    cols = [("Category", 82, "L"), ("Amount", 48, "R"), ("Share %", 24, "C"), ("Transactions", 30, "C")]
    pdf.th(cols)
    for i, (cat, amt) in enumerate(categories):
        txns = sum(1 for e in expenses if (e.category or "Other") == cat)
        share = f"{(amt / cat_total * 100):.1f}%" if cat_total else "0%"
        pdf.td([(_s(cat), 82, "L"), (_fmt(amt), 48, "R"), (share, 24, "C"),
                (str(txns), 30, "C")], zebra=(i % 2 == 1))
    pdf.ln(4)

    # ── 4. Commitment Utilization ─────────────────────────────────────────────
    pdf.section_title("4.  COMMITMENT UTILIZATION")
    cols = [("Ref", 20, "C"), ("Description", 78, "L"), ("Reserved", 34, "R"), ("Spent", 34, "R"), ("Util %", 18, "C")]
    pdf.th(cols)
    for i, c in enumerate(commitments[:20]):
        spent_c = sum(float(e.amount) for e in expenses if e.commitment_id == c.commitment_id)
        reserved = float(c.amount or 0)
        pct_c = (spent_c / reserved * 100) if reserved else 0
        color = DANGER if pct_c >= 100 else (WARN if pct_c >= 70 else None)
        pdf.td([(f"CMT-{str(c.commitment_id).zfill(3)}", 20, "C"),
                (_s(c.description or "")[:32], 78, "L"),
                (_fmt(reserved), 34, "R"), (_fmt(spent_c), 34, "R"),
                (f"{pct_c:.0f}%", 18, "C")], zebra=(i % 2 == 1), text_color=color)
    pdf.ln(4)

    # ── 5. Alert Summary ──────────────────────────────────────────────────────
    pdf.section_title("5.  ASSURANCE ALERT SUMMARY")
    pdf.set_font("Helvetica", "", 8)
    for sev in ("critical", "high", "medium", "low"):
        count = sev_counts.get(sev, 0)
        pdf.set_text_color(*SEV_COLOR.get(sev, DARK))
        pdf.cell(28, 5, sev.upper() + ":", align="L")
        pdf.set_text_color(*DARK)
        pdf.cell(18, 5, str(count))
    pdf.ln(7)
    if open_alerts:
        cols = [("Title", 96, "L"), ("Severity", 24, "C"), ("Department", 40, "L"), ("Date", 24, "C")]
        pdf.th(cols)
        for i, a in enumerate(open_alerts[:10]):
            sev = (a.severity or "").lower()
            row = [(_s(a.title or "")[:45], 96, "L"), (sev.upper(), 24, "C"),
                   (_s(dept_map.get(a.department_id, "-"))[:18], 40, "L"),
                   (str(a.created_at or "")[:10], 24, "C")]
            zebra = (i % 2 == 1)
            pdf.set_font("Helvetica", "", 7.5)
            pdf.set_fill_color(*(LIGHT if zebra else WHITE))
            for j, (val, w, align) in enumerate(row):
                color = SEV_COLOR.get(sev, DARK) if j == 1 else DARK
                pdf.set_text_color(*color)
                pdf.cell(w, 5, val, fill=zebra, align=align)
            pdf.ln()
        pdf.set_text_color(*DARK)
    pdf.ln(4)

    # ── 6. Recent Transactions ────────────────────────────────────────────────
    pdf.section_title("6.  RECENT TRANSACTIONS")
    cols = [("Ref", 22, "C"), ("Vendor", 42, "L"), ("Category", 32, "L"), ("Department", 40, "L"), ("Amount", 30, "R"), ("Status", 18, "C")]
    pdf.th(cols)
    for i, e in enumerate(recent):
        status = (e.status or "pending").upper()
        sc = SUCCESS if e.status == "approved" else DANGER if e.status == "rejected" else WARN
        row = [(f"EXP-{str(e.expense_id).zfill(4)}", 22, "C"),
               (_s(e.vendor or "-")[:16], 42, "L"),
               (_s(e.category or "-")[:14], 32, "L"),
               (_s(dept_map.get(e.department_id, "-"))[:16], 40, "L"),
               (_fmt(e.amount), 30, "R"),
               (status, 18, "C")]
        zebra = (i % 2 == 1)
        pdf.set_font("Helvetica", "", 7.5)
        pdf.set_fill_color(*(LIGHT if zebra else WHITE))
        for j, (val, w, align) in enumerate(row):
            color = sc if j == 5 else DARK
            pdf.set_text_color(*color)
            pdf.cell(w, 5, val, fill=zebra, align=align)
        pdf.ln()
    pdf.set_text_color(*DARK)

    # ── Return bytes ───────────────────────────────────────────────────────────
    return bytes(pdf.output())


@router.get("/pdf")
def generate_pdf_report(year: int = Query(2025), db: Session = Depends(get_db)):
    buf = BytesIO(_build_pdf(year, db))
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="simax-assure-fy{year}.pdf"'},
    )
