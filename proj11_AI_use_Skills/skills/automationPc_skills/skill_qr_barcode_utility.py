import os
import json

TOOL_SCHEMA = {
    "name": "skill_qr_barcode_utility",
    "description": "Generate Wi-Fi / URL / vCard QR payloads and render ASCII QR/link helpers (optional qrcode package lazy-imported with pure-Python payload builder).",
    "risk_level": "safe",
    "parameters": {
        "actions": [
            {
                "name": "build_wifi_qr_payload",
                "description": "Build a QR payload for Wi-Fi",
                "parameters": {
                    "ssid": "str",
                    "password": "str",
                    "security": "str"
                }
            },
            {
                "name": "build_vcard_payload",
                "description": "Build a QR payload for vCard",
                "parameters": {
                    "name": "str",
                    "phone": "str",
                    "email": "str"
                }
            },
            {
                "name": "generate_qr_image",
                "description": "Generate a QR image",
                "parameters": {
                    "data": "str",
                    "output_path": "str"
                }
            }
        ]
    }
}

def build_wifi_qr_payload(ssid: str, password: str='', security: str='WPA') -> str:
    return f"WIFI:T:{security};S:{ssid};P:{password};;"

def build_vcard_payload(name: str, phone: str='', email: str='') -> str:
    vcard = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        f"FN:{name}",
        f"TEL;TYPE=CELL:{phone}",
        f"EMAIL;TYPE=INTERNET:{email}",
        "END:VCARD"
    ]
    return "\n".join(vcard)

def generate_qr_image(data: str, output_path: str='qr.png') -> dict:
    try:
        import qrcode
    except ImportError:
        return {"ok": False, "error": "Missing package qrcode"}
    
    try:
        qr = qrcode.QRCode()
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(output_path)
        return {"ok": True, "output_path": output_path}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def execute(action: str = "", **kwargs) -> dict:
    if action == "build_wifi_qr_payload":
        return {"ok": True, "payload": build_wifi_qr_payload(**kwargs)}
    elif action == "build_vcard_payload":
        return {"ok": True, "payload": build_vcard_payload(**kwargs)}
    elif action == "generate_qr_image":
        return _safe_call(generate_qr_image, kwargs)
    else:
        return {"ok": False, "error": "Unknown action"}

def _safe_call(fn, kw):
    import inspect as _insp
    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
