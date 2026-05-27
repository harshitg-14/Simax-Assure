import os
import json
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()
_db_factory = None


def _send_report_email(pdf_bytes: bytes, year: int, recipients: list):
    mail_user      = os.getenv("MAIL_USERNAME")
    mail_pass      = os.getenv("MAIL_PASSWORD")
    mail_from      = os.getenv("MAIL_FROM", mail_user)
    mail_from_name = os.getenv("MAIL_FROM_NAME", "Simax Assure")

    if not mail_user or not mail_pass or not recipients:
        logger.warning("Scheduled report: missing mail config or no recipients")
        return

    msg = MIMEMultipart()
    msg["From"]    = f"{mail_from_name} <{mail_from}>"
    msg["To"]      = ", ".join(recipients)
    msg["Subject"] = f"[Simax Assure] Scheduled Financial Report -- FY {year}"

    body_html = f"""
<html><body style="font-family:Arial,sans-serif;background:#04090f;color:#e2e8f0;padding:24px">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#04090f">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#0a1220;border:1px solid #182540;border-radius:12px;overflow:hidden">
        <tr><td style="height:3px;background:linear-gradient(90deg,#c9970a,#e8b020)"></td></tr>
        <tr><td style="padding:28px 32px 20px">
          <div style="font-size:20px;font-weight:800;color:#e2e8f0">
            Simax<span style="color:#e8b020">Assure</span>
          </div>
          <div style="font-size:9px;color:#3d5070;text-transform:uppercase;letter-spacing:2.5px;margin-top:3px">
            Financial Intelligence Platform
          </div>
        </td></tr>
        <tr><td style="padding:0 32px 24px">
          <div style="background:#c9970a18;border:1px solid #c9970a35;border-radius:8px;
                      padding:14px 18px;border-left:3px solid #c9970a">
            <div style="font-size:15px;font-weight:700;color:#e2e8f0">
              Scheduled Financial Report -- FY {year}
            </div>
          </div>
        </td></tr>
        <tr><td style="padding:0 32px 24px">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#070e1a;border:1px solid #182540;border-radius:8px">
            <tr>
              <td style="padding:10px 14px;color:#7a90b0;font-size:12px">Report Period</td>
              <td style="padding:10px 14px;color:#e2e8f0;font-weight:600">FY {year}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;color:#7a90b0;font-size:12px">Generated</td>
              <td style="padding:10px 14px;color:#e2e8f0;font-weight:600">
                {datetime.now().strftime('%d %b %Y, %I:%M %p')}
              </td>
            </tr>
            <tr>
              <td style="padding:10px 14px;color:#7a90b0;font-size:12px">Type</td>
              <td style="padding:10px 14px;color:#e2e8f0;font-weight:600">Automated Scheduled Delivery</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 32px 24px;font-size:12px;color:#7a90b0">
          The attached PDF contains full budget vs actual variance, top vendors, category breakdown,
          commitment utilization, alert summary, and recent transactions.
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #182540">
          <div style="font-size:11px;color:#3d5070">
            This is an automated notification from Simax Assure.<br>
            Do not reply to this email.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
"""
    msg.attach(MIMEText(body_html, "html"))

    part = MIMEBase("application", "pdf")
    part.set_payload(pdf_bytes)
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", f'attachment; filename="simax-assure-fy{year}.pdf"')
    msg.attach(part)

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(mail_user, mail_pass)
        server.sendmail(mail_from, recipients, msg.as_string())

    logger.info("Scheduled report sent to %s", recipients)


def _run_scheduled_report():
    if _db_factory is None:
        return
    from app.routes.reports import _build_pdf

    db = _db_factory()
    try:
        from app import models
        config = db.query(models.ScheduledReport).filter_by(id=1).first()
        if not config or not config.enabled:
            return

        recipients = json.loads(config.recipients or "[]")
        if not recipients:
            return

        year = datetime.now().year
        pdf_bytes = _build_pdf(year, db)
        _send_report_email(pdf_bytes, year, recipients)

        config.last_sent_at = datetime.now()
        db.commit()
        logger.info("Scheduled report completed for FY %d", year)
    except Exception as e:
        logger.error("Scheduled report failed: %s", e)
    finally:
        db.close()


def _get_cron_trigger(config) -> CronTrigger:
    if config.frequency == "monthly":
        return CronTrigger(day=config.day_of_month or 1, hour=config.hour or 8, minute=0)
    return CronTrigger(day_of_week=config.day_of_week or 0, hour=config.hour or 8, minute=0)


def start_scheduler(db_factory):
    global _db_factory
    _db_factory = db_factory

    db = db_factory()
    try:
        from app import models
        config = db.query(models.ScheduledReport).filter_by(id=1).first()
        if config and config.enabled:
            trigger = _get_cron_trigger(config)
            scheduler.add_job(_run_scheduled_report, trigger, id="scheduled_report", replace_existing=True)
            logger.info("Loaded existing schedule: %s", trigger)
    except Exception as e:
        logger.error("Scheduler init failed: %s", e)
    finally:
        db.close()

    scheduler.start()
    logger.info("APScheduler started")


def reschedule(config):
    try:
        scheduler.remove_job("scheduled_report")
    except Exception:
        pass

    if config.enabled:
        trigger = _get_cron_trigger(config)
        scheduler.add_job(_run_scheduled_report, trigger, id="scheduled_report", replace_existing=True)
        logger.info("Schedule updated: %s every %s at hour %d", config.frequency, trigger, config.hour)
    else:
        logger.info("Scheduled reports disabled")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")
