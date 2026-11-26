import os
import imaplib
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email import message_from_bytes

TOOL_SCHEMA = {
    "name": "skill_gmail_imap_smtp",
    "description": "Read and search recent Gmail messages via imaplib and send plain/HTML emails via smtplib using GMAIL_USER and GMAIL_APP_PASSWORD env vars (dry_run=True by default for sending).",
    "risk_level": "confirm",
    "parameters": {
        "actions": {
            "list_recent_emails": {
                "description": "List recent emails from a specified Gmail folder.",
                "parameters": {
                    "limit": {"type": "int", "default": 10},
                    "folder": {"type": "str", "default": "INBOX"},
                    "query": {"type": "str", "default": "ALL"}
                }
            },
            "build_email_message": {
                "description": "Build an email message.",
                "parameters": {
                    "sender": {"type": "str"},
                    "to": {"type": "str"},
                    "subject": {"type": "str"},
                    "body": {"type": "str"}
                }
            },
            "send_email": {
                "description": "Send an email.",
                "parameters": {
                    "to": {"type": "str"},
                    "subject": {"type": "str"},
                    "body": {"type": "str"},
                    "dry_run": {"type": "bool", "default": True}
                }
            }
        }
    }
}

def _fetch_recent_emails(limit=10, folder='INBOX', query='ALL'):
    try:
        user = os.environ['GMAIL_USER']
        password = os.environ['GMAIL_APP_PASSWORD']
        mail = imaplib.IMAP4_SSL('imap.gmail.com')
        mail.login(user, password)
        mail.select(folder)
        result, data = mail.search(None, query)
        email_ids = data[0].split()
        recent_emails = []
        for e_id in email_ids[-limit:][::-1]:
            result, msg_data = mail.fetch(e_id, '(RFC822)')
            msg = message_from_bytes(msg_data[0][1])
            recent_emails.append({
                'subject': msg['subject'],
                'from': msg['from'],
                'date': msg['date'],
                'body': msg.get_payload(decode=True).decode('utf-8')
            })
        mail.logout()
        return recent_emails
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _send_email_via_smtp(to, subject, body, dry_run=True):
    try:
        user = os.environ['GMAIL_USER']
        password = os.environ['GMAIL_APP_PASSWORD']
        msg = MIMEMultipart()
        msg['From'] = user
        msg['To'] = to
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))
        if not dry_run:
            server = smtplib.SMTP('smtp.gmail.com', 587)
            server.starttls()
            server.login(user, password)
            server.sendmail(user, to, msg.as_string())
            server.quit()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def list_recent_emails(limit=10, folder='INBOX', query='ALL'):
    emails = _fetch_recent_emails(limit, folder, query)
    if isinstance(emails, dict) and not emails.get("ok"):
        return emails
    return {"ok": True, "emails": emails}

def build_email_message(sender, to, subject, body):
    msg = MIMEMultipart()
    msg['From'] = sender
    msg['To'] = to
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))
    return {"ok": True, "message": msg}

def send_email(to, subject, body, dry_run=True):
    return _send_email_via_smtp(to, subject, body, dry_run)

def execute(action: str = "list_recent_emails", **kwargs) -> dict:
    if action == "get_tool_schema":
        return TOOL_SCHEMA
    elif action == "list_recent_emails":
        return list_recent_emails(**kwargs)
    elif action == "build_email_message":
        return build_email_message(**kwargs)
    elif action == "send_email":
        return send_email(**kwargs)
    else:
        return {"ok": False, "error": "Unknown action"}
