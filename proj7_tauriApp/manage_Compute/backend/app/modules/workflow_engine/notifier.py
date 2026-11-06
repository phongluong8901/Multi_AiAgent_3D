"""
Module Webhook & Notification Dispatcher: Quản lý và phát thông báo cảnh báo tự động
qua các kênh giao tiếp phổ biến như Discord, Telegram, và Slack khi hệ thống xảy ra sự cố.
"""

import json
import urllib.request
import urllib.parse
from typing import Dict, Any, Optional

def send_discord_webhook(
    webhook_url: str,
    content: str,
    title: str = "Auto-Guard Security Alert",
    color: int = 15158332
) -> dict:
    """
    Gửi tin nhắn cảnh báo định dạng Embed đến webhook của kênh Discord.

    Tham số:
        webhook_url (str): Địa chỉ URL webhook của kênh Discord tiếp nhận.
        content (str): Nội dung chi tiết của thông báo / cảnh báo.
        title (str): Tiêu đề hiển thị của khung Embed.
        color (int): Mã màu số nguyên hệ RGB cho thanh bên Embed (mặc định đỏ cam).

    Trả về:
        dict: Trạng thái kết quả gửi (sent hoặc error).
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
    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return {"status": "sent", "channel": "discord", "code": response.status}
    except Exception as e:
        return {"status": "error", "channel": "discord", "reason": str(e)}

def send_telegram_notification(bot_token: str, chat_id: str, text: str) -> dict:
    """
    Gửi tin nhắn văn bản Markdown trực tiếp tới Telegram Chat/Group qua Bot API.

    Tham số:
        bot_token (str): Mã Token bí mật của Telegram Bot được tạo từ BotFather.
        chat_id (str): Định danh người dùng hoặc ID nhóm nhận cảnh báo.
        text (str): Nội dung thông báo cần gửi.

    Trả về:
        dict: Kết quả phản hồi từ Telegram API.
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
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            res_data = json.loads(response.read().decode())
            return {"status": "sent", "channel": "telegram", "response": res_data}
    except Exception as e:
        return {"status": "error", "channel": "telegram", "reason": str(e)}

def send_slack_webhook(webhook_url: str, text: str) -> dict:
    """
    Gửi tin nhắn cảnh báo dạng JSON Payload tới Incoming Webhook của Slack.

    Tham số:
        webhook_url (str): Đường link Incoming Webhook của kênh Slack.
        text (str): Văn bản cảnh báo cần hiển thị.

    Trả về:
        dict: Kết quả phản hồi từ Slack Incoming Webhook.
    """
    if not webhook_url:
        return {"status": "error", "reason": "Missing Slack Webhook URL"}

    payload = {"text": f"[AUTOGUARD ALERT] {text}"}
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return {"status": "sent", "channel": "slack", "code": response.status}
    except Exception as e:
        return {"status": "error", "channel": "slack", "reason": str(e)}

def dispatch_notification(node_data: dict, incident_info: Optional[dict] = None) -> dict:
    """
    Điều phối gửi tin nhắn thông báo tự động dựa trên cấu hình của Workflow Node.

    Tham số:
        node_data (dict): Cấu hình của node thông báo (nền tảng, URL webhook, token, template).
        incident_info (Optional[dict]): Dữ liệu thông tin sự cố bổ sung (nếu có).

    Trả về:
        dict: Kết quả thực hiện từ dịch vụ tương ứng.
    """
    platform = node_data.get("platform", "discord").lower()
    proc_name = node_data.get("proc_name", "Target Process")
    metric = node_data.get("metric", "CPU/RAM Breach")
    custom_msg = node_data.get("message_template")

    # Xây dựng nội dung mặc định nếu người dùng không định nghĩa template tùy chỉnh
    if not custom_msg:
        custom_msg = f"Alert triggered on {proc_name}: {metric}. Immediate intervention executed."

    # Định tuyến tới dịch vụ gửi tương ứng
    if platform == "telegram":
        token = node_data.get("telegram_token", "")
        chat_id = node_data.get("telegram_chat_id", "")
        return send_telegram_notification(token, chat_id, custom_msg)
    elif platform == "slack":
        webhook_url = node_data.get("webhook_url", "")
        return send_slack_webhook(webhook_url, custom_msg)
    else:  # Mặc định sử dụng Discord
        webhook_url = node_data.get("webhook_url", "")
        return send_discord_webhook(webhook_url, custom_msg, title=f"Auto-Guard Alert: {proc_name}")
