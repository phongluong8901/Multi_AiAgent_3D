import imaplib
import os
import re
import smtplib
from email import message_from_bytes
from email.header import decode_header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

TOOL_SCHEMA = {
    "name": "skill_gmail_imap_smtp",
    "description": (
        "Read and search recent Gmail messages via IMAP (supports UTF-8 Vietnamese headers and multipart/HTML emails) "
        "and send emails via SMTP using GMAIL_USER and GMAIL_APP_PASSWORD environment variables (dry_run=True by default for sending)."
    ),
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["list_recent_emails", "build_email_message", "send_email"],
                "default": "list_recent_emails",
            },
            "limit": {"type": "integer", "default": 5},
            "folder": {"type": "string", "default": "INBOX"},
            "query": {"type": "string", "default": "ALL"},
            "sender": {"type": "string"},
            "to": {"type": "string"},
            "subject": {"type": "string"},
            "body": {"type": "string"},
            "dry_run": {"type": "boolean", "default": True},
        },
        "required": ["action"],
    },
}


class GmailIMAPSmtpTool:
    """Tool for reading and sending Gmail via IMAP and SMTP."""

    def __init__(self, output_dir: str = "outputs") -> None:
        self.output_dir = output_dir
        Path(self.output_dir).mkdir(parents=True, exist_ok=True)

    def _load_gmail_credentials(self) -> tuple[str, str]:
        user = os.environ.get("GMAIL_USER", "").strip()
        password = os.environ.get("GMAIL_APP_PASSWORD", "").strip()
        password = re.sub(r"\s+", "", password)
        return user, password

    def _decode_mime_header(self, raw_value: str | None) -> str:
        if not raw_value:
            return ""
        parts = []
        for chunk, charset in decode_header(raw_value):
            if isinstance(chunk, bytes):
                enc = charset or "utf-8"
                try:
                    parts.append(chunk.decode(enc, errors="replace"))
                except LookupError:
                    parts.append(chunk.decode("utf-8", errors="replace"))
            else:
                parts.append(str(chunk))
        return "".join(parts).strip()

    def _strip_html(self, html_text: str) -> str:
        try:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(html_text, "html.parser")
            for tag in soup(["script", "style", "noscript"]):
                tag.decompose()
            text = soup.get_text(separator="\n")
            return re.sub(r"\n{3,}", "\n\n", text).strip()
        except Exception:
            cleaned = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html_text, flags=re.I | re.S)
            cleaned = re.sub(r"<[^>]+>", " ", cleaned)
            return re.sub(r"\s+", " ", cleaned).strip()

    def _extract_email_body(self, msg, max_chars: int = 2000) -> str:
        plain_parts: list[str] = []
        html_parts: list[str] = []

        if msg.is_multipart():
            for part in msg.walk():
                ctype = (part.get_content_type() or "").lower()
                disp = str(part.get("Content-Disposition") or "").lower()
                if "attachment" in disp:
                    continue
                payload = part.get_payload(decode=True)
                if not payload:
                    continue
                charset = part.get_content_charset() or "utf-8"
                try:
                    decoded = payload.decode(charset, errors="replace")
                except LookupError:
                    decoded = payload.decode("utf-8", errors="replace")
                if ctype == "text/plain":
                    plain_parts.append(decoded.strip())
                elif ctype == "text/html":
                    html_parts.append(decoded.strip())
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or "utf-8"
                try:
                    decoded = payload.decode(charset, errors="replace")
                except LookupError:
                    decoded = payload.decode("utf-8", errors="replace")
                if (msg.get_content_type() or "").lower() == "text/html":
                    html_parts.append(decoded.strip())
                else:
                    plain_parts.append(decoded.strip())

        if plain_parts:
            body = "\n".join(p for p in plain_parts if p)
        elif html_parts:
            body = self._strip_html("\n".join(html_parts))
        else:
            body = ""
        return body.strip()[:max_chars]

    def _fetch_recent_emails(self, limit: int = 5, folder: str = "INBOX", query: str = "ALL"):
        user, password = self._load_gmail_credentials()
        if not user or not password:
            return {
                "ok": False,
                "error": (
                    "Missing GMAIL_USER or GMAIL_APP_PASSWORD environment variables. "
                    "Fallback: try `browser_cdp_controller__execute(action='read_gmail_inbox')` to read Gmail from Chrome CDP."
                ),
            }

        lim = max(1, min(int(limit or 5), 25))
        try:
            mail = imaplib.IMAP4_SSL("imap.gmail.com", 993, timeout=15)
            mail.login(user, password)
            mail.select(folder, readonly=True)
            status, data = mail.search(None, query or "ALL")
            if status != "OK" or not data or not data[0]:
                mail.logout()
                return []
            email_ids = data[0].split()
            recent_emails = []
            for e_id in email_ids[-lim:][::-1]:
                res_status, msg_data = mail.fetch(e_id, "(RFC822)")
                if res_status != "OK" or not msg_data or not isinstance(msg_data[0], tuple):
                    continue
                msg = message_from_bytes(msg_data[0][1])
                recent_emails.append(
                    {
                        "id": e_id.decode("ascii", errors="ignore"),
                        "subject": self._decode_mime_header(msg.get("Subject")),
                        "from": self._decode_mime_header(msg.get("From")),
                        "date": str(msg.get("Date") or ""),
                        "body": self._extract_email_body(msg, max_chars=2000),
                    }
                )
            mail.logout()
            return recent_emails
        except Exception as exc:
            return {"ok": False, "error": f"IMAP error: {type(exc).__name__}: {exc}"}

    def _send_email_via_smtp(self, to: str, subject: str, body: str, dry_run: bool = True):
        user, password = self._load_gmail_credentials()
        if not user or not password:
            return {
                "ok": False,
                "error": "Missing GMAIL_USER or GMAIL_APP_PASSWORD environment variables.",
            }
        try:
            msg = MIMEMultipart()
            msg["From"] = user
            msg["To"] = to
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain", "utf-8"))
            if not dry_run:
                server = smtplib.SMTP("smtp.gmail.com", 587, timeout=15)
                server.starttls()
                server.login(user, password)
                server.sendmail(user, to, msg.as_string())
                server.quit()
            return {"ok": True, "dry_run": bool(dry_run), "to": to, "subject": subject}
        except Exception as exc:
            return {"ok": False, "error": f"SMTP error: {type(exc).__name__}: {exc}"}

    def list_recent_emails(self, limit: int = 5, folder: str = "INBOX", query: str = "ALL") -> dict:
        """List recent emails from Gmail INBOX via IMAP."""
        emails = self._fetch_recent_emails(limit=limit, folder=folder, query=query)
        if isinstance(emails, dict) and not emails.get("ok"):
            return emails
        return {"ok": True, "count": len(emails), "emails": emails}

    def build_email_message(self, sender: str, to: str, subject: str, body: str) -> dict:
        """Build raw email message payload preview."""
        msg = MIMEMultipart()
        msg["From"] = sender
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain", "utf-8"))
        return {"ok": True, "preview": msg.as_string()[:1000]}

    def send_email(self, to: str, subject: str, body: str, dry_run: bool = True) -> dict:
        """Send email via Gmail SMTP server."""
        return self._send_email_via_smtp(to, subject, body, dry_run)


def list_recent_emails(limit: int = 5, folder: str = "INBOX", query: str = "ALL") -> dict:
    """List recent emails from Gmail INBOX via IMAP."""
    tool = GmailIMAPSmtpTool()
    return tool.list_recent_emails(limit=limit, folder=folder, query=query)


def build_email_message(sender: str, to: str, subject: str, body: str) -> dict:
    """Build raw email message payload preview."""
    tool = GmailIMAPSmtpTool()
    return tool.build_email_message(sender=sender, to=to, subject=subject, body=body)


def send_email(to: str, subject: str, body: str, dry_run: bool = True) -> dict:
    """Send email via Gmail SMTP server."""
    tool = GmailIMAPSmtpTool()
    return tool.send_email(to=to, subject=subject, body=body, dry_run=dry_run)


def execute(action: str = "list_recent_emails", **kwargs) -> dict:
    """Execute Gmail IMAP/SMTP tool actions."""
    if isinstance(kwargs.get("parameters"), dict):
        nested = kwargs.pop("parameters")
        for k, v in nested.items():
            kwargs.setdefault(k, v)
    if action == "get_tool_schema":
        return {"ok": True, **TOOL_SCHEMA}
    elif action == "list_recent_emails":
        return _safe_call(list_recent_emails, kwargs)
    elif action == "build_email_message":
        return _safe_call(build_email_message, kwargs)
    elif action == "send_email":
        return _safe_call(send_email, kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}


def _safe_call(fn, kw):
    import inspect as _insp

    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
