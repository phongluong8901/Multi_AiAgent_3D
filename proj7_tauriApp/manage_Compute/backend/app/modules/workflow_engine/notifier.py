import json
import urllib.request
import urllib.parse
from typing import Dict, Any, Optional

def send_discord_webhook(webhook_url: str, content: str, title: str = "Auto-Guard Security Alert", color: int = 15158332) -> dict:
    """
    Gửi tin nhắn Webhook tới kênh Discord.
    """
    if not webhook_url:
        return {"status": "error", "reason": "Missing Discord Webhook URL"}

    payload = {
        "content": f"[AUTOGUARD] {content}",
        "embeds": [
            {
                "title": title,
                "description": content,
                "color": color,
                "footer": {"text": "Compute Studio System Supervisor"}
            }
        ]
    }
    headers = {"Content-Type": "application/json", "User-Agent": "ComputeStudio-AutoGuard"}
    req = urllib.request.Request(webhook_url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return {"status": "sent", "channel": "discord", "code": response.status}
    except Exception as e:
        return {"status": "error", "channel": "discord", "reason": str(e)}

def send_telegram_notification(bot_token: str, chat_id: str, text: str) -> dict:
    """
    Gửi tin nhắn cảnh báo qua Telegram Bot API.
    """
    if not bot_token or not chat_id:
        return {"status": "error", "reason": "Missing Telegram Bot Token or Chat ID"}

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": f"[AUTOGUARD ALERT]\n{text}",
        "parse_mode": "Markdown"
    }
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            res_data = json.loads(response.read().decode())
            return {"status": "sent", "channel": "telegram", "response": res_data}
    except Exception as e:
        return {"status": "error", "channel": "telegram", "reason": str(e)}

def send_slack_webhook(webhook_url: str, text: str) -> dict:
    """
    Gửi tin nhắn qua Slack Webhook.
    """
    if not webhook_url:
        return {"status": "error", "reason": "Missing Slack Webhook URL"}

    payload = {"text": f"[AUTOGUARD ALERT] {text}"}
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(webhook_url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return {"status": "sent", "channel": "slack", "code": response.status}
    except Exception as e:
        return {"status": "error", "channel": "slack", "reason": str(e)}

def dispatch_notification(node_data: dict, incident_info: Optional[dict] = None) -> dict:
    platform = node_data.get("platform", "discord").lower()
    proc_name = node_data.get("proc_name", "Target Process")
    metric = node_data.get("metric", "CPU/RAM Breach")
    custom_msg = node_data.get("message_template")

    if not custom_msg:
        custom_msg = f"Alert triggered on {proc_name}: {metric}. Immediate intervention executed."

    if platform == "telegram":
        token = node_data.get("telegram_token", "")
        chat_id = node_data.get("telegram_chat_id", "")
        return send_telegram_notification(token, chat_id, custom_msg)
    elif platform == "slack":
        webhook_url = node_data.get("webhook_url", "")
        return send_slack_webhook(webhook_url, custom_msg)
    else:  # discord default
        webhook_url = node_data.get("webhook_url", "")
        return send_discord_webhook(webhook_url, custom_msg, title=f"Auto-Guard Alert: {proc_name}")

