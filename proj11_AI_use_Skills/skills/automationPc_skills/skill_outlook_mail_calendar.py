import os
import datetime
from typing import Dict, Any

TOOL_SCHEMA = {
    "name": "skill_outlook_mail_calendar",
    "description": "Read recent Outlook inbox messages or create draft emails via Outlook COM (win32com lazy-imported), plus generate standard .ics calendar invite files offline.",
    "risk_level": "confirm",
    "parameters": {
        "create_ics_event": {
            "title": "str",
            "start_iso": "str",
            "end_iso": "str",
            "output_path": "str='event.ics'",
            "description": "str=''"
        },
        "draft_outlook_email": {
            "to": "str",
            "subject": "str",
            "body": "str",
            "dry_run": "bool=True"
        },
        "list_outlook_inbox": {
            "limit": "int=10"
        }
    },
    "vi_description": "Đọc email Outlook, tạo thư nháp draft Outlook, tạo file lịch họp ics sự kiện calendar",
    "vi_keywords": "đọc email Outlook, tạo thư nháp draft Outlook, tạo file lịch họp ics sự kiện calendar"
}

def _create_ics_event(title: str, start_iso: str, end_iso: str, output_path: str, description: str) -> Dict[str, Any]:
    try:
        from ics import Event, Calendar
    except ImportError:
        return {"ok": False, "error": "Missing package ics"}
    
    cal = Calendar()
    event = Event()
    event.name = title
    event.begin = start_iso
    event.end = end_iso
    event.description = description
    cal.events.add(event)
    
    with open(output_path, 'w') as f:
        f.writelines(cal)
    
    return {"ok": True, "path": output_path}

def _draft_outlook_email(to: str, subject: str, body: str, dry_run: bool) -> Dict[str, Any]:
    try:
        import win32com.client
    except ImportError:
        return {"ok": False, "error": "Missing package win32com"}
    
    if dry_run:
        return {"ok": True, "dry_run": True, "to": to, "subject": subject, "body": body}
    
    outlook = win32com.client.Dispatch('Outlook.Application')
    mail = outlook.CreateItem(0)
    mail.To = to
    mail.Subject = subject
    mail.Body = body
    mail.Save()
    
    return {"ok": True, "message": "Email draft created"}

def _list_outlook_inbox(limit: int) -> Dict[str, Any]:
    try:
        import win32com.client
    except ImportError:
        return {"ok": False, "error": "Missing package win32com"}
    
    outlook = win32com.client.Dispatch('Outlook.Application').GetNamespace('MAPI')
    inbox = outlook.GetDefaultFolder(6)  # 6 refers to the inbox
    messages = inbox.Items
    messages.Sort('[ReceivedTime]', True)
    
    result = []
    for i, message in enumerate(messages):
        if i >= limit:
            break
        result.append({
            "subject": message.Subject,
            "sender": message.SenderEmailAddress,
            "received_time": message.ReceivedTime.strftime('%Y-%m-%d %H:%M:%S'),
            "body": message.Body
        })
    
    return {"ok": True, "messages": result}

def execute(action: str = "list_outlook_inbox", **kwargs) -> Dict[str, Any]:
    if action == "create_ics_event":
        return _create_ics_event(
            title=kwargs.get("title", ""),
            start_iso=kwargs.get("start_iso", ""),
            end_iso=kwargs.get("end_iso", ""),
            output_path=kwargs.get("output_path", "event.ics"),
            description=kwargs.get("description", "")
        )
    elif action == "draft_outlook_email":
        return _draft_outlook_email(
            to=kwargs.get("to", ""),
            subject=kwargs.get("subject", ""),
            body=kwargs.get("body", ""),
            dry_run=kwargs.get("dry_run", True)
        )
    elif action == "list_outlook_inbox":
        return _list_outlook_inbox(
            limit=kwargs.get("limit", 10)
        )
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
