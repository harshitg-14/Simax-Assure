import os
import logging
from dotenv import load_dotenv
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType

load_dotenv()

logger = logging.getLogger(__name__)

_cfg = None

def _get_config():
    global _cfg
    if _cfg is None:
        _cfg = ConnectionConfig(
            MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
            MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
            MAIL_FROM=os.getenv("MAIL_FROM"),
            MAIL_FROM_NAME=os.getenv("MAIL_FROM_NAME", "Simax Assure"),
            MAIL_PORT=587,
            MAIL_SERVER="smtp.gmail.com",
            MAIL_STARTTLS=True,
            MAIL_SSL_TLS=False,
            USE_CREDENTIALS=True,
        )
    return _cfg


# ── HTML template ─────────────────────────────────────────────────────────────

def _html(title: str, color: str, rows: list[tuple], note: str = "") -> str:
    rows_html = "".join(
        f"""<tr>
              <td style="padding:8px 12px;color:#7a90b0;font-size:12px;white-space:nowrap">{k}</td>
              <td style="padding:8px 12px;color:#e2e8f0;font-size:13px;font-weight:600">{v}</td>
            </tr>"""
        for k, v in rows
    )
    note_html = f'<p style="margin:18px 0 0;font-size:12px;color:#7a90b0">{note}</p>' if note else ""
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#04090f;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#04090f;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#0a1220;border:1px solid #182540;border-radius:12px;overflow:hidden">

        <!-- Top bar -->
        <tr><td style="height:3px;background:linear-gradient(90deg,#c9970a,#e8b020)"></td></tr>

        <!-- Header -->
        <tr>
          <td style="padding:28px 32px 20px">
            <div style="font-size:20px;font-weight:800;color:#e2e8f0;letter-spacing:-0.4px">
              Simax<span style="color:#e8b020">Assure</span>
            </div>
            <div style="font-size:9px;color:#3d5070;text-transform:uppercase;letter-spacing:2.5px;margin-top:3px">
              Financial Intelligence Platform
            </div>
          </td>
        </tr>

        <!-- Title banner -->
        <tr>
          <td style="padding:0 32px 24px">
            <div style="background:{color}18;border:1px solid {color}35;border-radius:8px;
                        padding:14px 18px;border-left:3px solid {color}">
              <div style="font-size:15px;font-weight:700;color:#e2e8f0">{title}</div>
            </div>
          </td>
        </tr>

        <!-- Details table -->
        <tr>
          <td style="padding:0 32px 24px">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#070e1a;border:1px solid #182540;border-radius:8px;overflow:hidden">
              {rows_html}
            </table>
          </td>
        </tr>

        <!-- Note -->
        {f'<tr><td style="padding:0 32px 24px"><p style="margin:0;font-size:12px;color:#7a90b0">{note}</p></td></tr>' if note else ''}

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #182540">
            <div style="font-size:11px;color:#3d5070">
              This is an automated notification from Simax Assure.<br>
              Do not reply to this email.
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""


async def _send(to: list[str], subject: str, html: str):
    if not to:
        return
    try:
        msg = MessageSchema(
            subject=subject,
            recipients=to,
            body=html,
            subtype=MessageType.html,
        )
        fm = FastMail(_get_config())
        await fm.send_message(msg)
        logger.info("Email sent: %s → %s", subject, to)
    except Exception as e:
        logger.error("Email failed: %s", e)


# ── Public helpers ─────────────────────────────────────────────────────────────

def _fmt(amount) -> str:
    return f"₹{float(amount or 0):,.2f}"


async def notify_expense_submitted(finance_emails: list[str], expense, dept_name: str, submitted_by: str):
    html = _html(
        title="New Expense Submitted — Pending Approval",
        color="#c9970a",
        rows=[
            ("Reference",   f"EXP-{str(expense.expense_id).zfill(4)}"),
            ("Department",  dept_name),
            ("Vendor",      expense.vendor or "—"),
            ("Category",    expense.category or "—"),
            ("Amount",      _fmt(expense.amount)),
            ("Date",        str(expense.expense_date)),
            ("Submitted By", submitted_by),
            ("Status",      "Pending Approval"),
        ],
        note="Please log in to Simax Assure to review and action this expense."
    )
    await _send(finance_emails, f"[Simax Assure] Expense {_fmt(expense.amount)} Pending Approval", html)


async def notify_expense_approved(to_email: str, expense, dept_name: str, approved_by: str):
    html = _html(
        title="Your Expense Has Been Approved",
        color="#059669",
        rows=[
            ("Reference",   f"EXP-{str(expense.expense_id).zfill(4)}"),
            ("Department",  dept_name),
            ("Vendor",      expense.vendor or "—"),
            ("Amount",      _fmt(expense.amount)),
            ("Approved By", approved_by),
            ("Status",      "Approved"),
        ],
    )
    await _send([to_email], f"[Simax Assure] Expense Approved — {_fmt(expense.amount)}", html)


async def notify_expense_rejected(to_email: str, expense, dept_name: str, rejected_by: str, reason: str):
    html = _html(
        title="Your Expense Has Been Rejected",
        color="#dc2626",
        rows=[
            ("Reference",      f"EXP-{str(expense.expense_id).zfill(4)}"),
            ("Department",     dept_name),
            ("Vendor",         expense.vendor or "—"),
            ("Amount",         _fmt(expense.amount)),
            ("Rejected By",    rejected_by),
            ("Reason",         reason or "No reason provided"),
            ("Status",         "Rejected"),
        ],
        note="Please contact your finance manager if you have questions."
    )
    await _send([to_email], f"[Simax Assure] Expense Rejected — {_fmt(expense.amount)}", html)


async def notify_commitment_submitted(finance_emails: list[str], commitment, dept_name: str, submitted_by: str):
    html = _html(
        title="New Commitment Submitted — Pending Approval",
        color="#c9970a",
        rows=[
            ("Reference",   f"CMT-{str(commitment.commitment_id).zfill(3)}"),
            ("Department",  dept_name),
            ("Description", commitment.description),
            ("Amount",      _fmt(commitment.amount)),
            ("Date",        str(commitment.commitment_date)),
            ("Submitted By", submitted_by),
            ("Status",      "Pending Approval"),
        ],
        note="Please log in to Simax Assure to review and action this commitment."
    )
    await _send(finance_emails, f"[Simax Assure] Commitment {_fmt(commitment.amount)} Pending Approval", html)


async def notify_commitment_approved(to_email: str, commitment, dept_name: str, approved_by: str):
    html = _html(
        title="Your Commitment Has Been Approved",
        color="#059669",
        rows=[
            ("Reference",   f"CMT-{str(commitment.commitment_id).zfill(3)}"),
            ("Department",  dept_name),
            ("Description", commitment.description),
            ("Amount",      _fmt(commitment.amount)),
            ("Approved By", approved_by),
            ("Status",      "Approved"),
        ],
    )
    await _send([to_email], f"[Simax Assure] Commitment Approved — {_fmt(commitment.amount)}", html)


async def notify_commitment_rejected(to_email: str, commitment, dept_name: str, rejected_by: str, reason: str):
    html = _html(
        title="Your Commitment Has Been Rejected",
        color="#dc2626",
        rows=[
            ("Reference",      f"CMT-{str(commitment.commitment_id).zfill(3)}"),
            ("Department",     dept_name),
            ("Description",    commitment.description),
            ("Amount",         _fmt(commitment.amount)),
            ("Rejected By",    rejected_by),
            ("Reason",         reason or "No reason provided"),
            ("Status",         "Rejected"),
        ],
        note="Please contact your finance manager if you have questions."
    )
    await _send([to_email], f"[Simax Assure] Commitment Rejected — {_fmt(commitment.amount)}", html)


async def notify_revision_submitted(finance_emails: list[str], revision, dept_name: str, submitted_by: str):
    diff = float(revision.requested_amount) - float(revision.current_amount)
    html = _html(
        title="Budget Revision Request — Pending Review",
        color="#c9970a",
        rows=[
            ("Reference",        f"REV-{str(revision.revision_id).zfill(3)}"),
            ("Department",       dept_name),
            ("Current Budget",   _fmt(revision.current_amount)),
            ("Requested Budget", _fmt(revision.requested_amount)),
            ("Increase",         f"+{_fmt(diff)}" if diff >= 0 else _fmt(diff)),
            ("Reason",           revision.reason or "—"),
            ("Requested By",     submitted_by),
            ("Status",           "Pending Review"),
        ],
        note="Please log in to Simax Assure to review and action this budget revision request."
    )
    await _send(finance_emails, f"[Simax Assure] Budget Revision Request — {dept_name}", html)


async def notify_revision_approved(to_email: str, revision, dept_name: str, approved_by: str):
    html = _html(
        title="Your Budget Revision Has Been Approved",
        color="#059669",
        rows=[
            ("Reference",        f"REV-{str(revision.revision_id).zfill(3)}"),
            ("Department",       dept_name),
            ("New Budget",       _fmt(revision.requested_amount)),
            ("Approved By",      approved_by),
            ("Status",           "Approved"),
        ],
        note="Your department budget has been updated to the new amount."
    )
    await _send([to_email], f"[Simax Assure] Budget Revision Approved — {dept_name}", html)


async def notify_revision_rejected(to_email: str, revision, dept_name: str, rejected_by: str, reason: str):
    html = _html(
        title="Your Budget Revision Has Been Rejected",
        color="#dc2626",
        rows=[
            ("Reference",        f"REV-{str(revision.revision_id).zfill(3)}"),
            ("Department",       dept_name),
            ("Requested Budget", _fmt(revision.requested_amount)),
            ("Rejected By",      rejected_by),
            ("Reason",           reason or "No reason provided"),
            ("Status",           "Rejected"),
        ],
        note="Please contact your finance manager if you have questions."
    )
    await _send([to_email], f"[Simax Assure] Budget Revision Rejected — {dept_name}", html)


async def notify_budget_alert(finance_emails: list[str], dept_name: str, total_spent: float,
                               allocated: float, overrun_pct: float, severity: str):
    color = "#dc2626" if severity == "critical" else "#d97706" if severity == "high" else "#c9970a"
    html = _html(
        title=f"Budget Alert — {severity.upper()} — {dept_name}",
        color=color,
        rows=[
            ("Department",    dept_name),
            ("Allocated",     _fmt(allocated)),
            ("Total Spent",   _fmt(total_spent)),
            ("Overrun",       f"{overrun_pct:.1f}%"),
            ("Severity",      severity.upper()),
        ],
        note="Log in to Simax Assure → Assurance Monitor for full details and recommended actions."
    )
    await _send(finance_emails, f"[Simax Assure] Budget Alert — {severity.upper()} — {dept_name}", html)
