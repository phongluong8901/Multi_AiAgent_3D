import sys
import types
import json
from typing import Dict, Any

TOOL_SCHEMA = {
    "name": "skill_audio_volume_control",
    "risk_level": "safe",
    "description": "Control Windows master audio volume (up/down/mute/set percent) via PowerShell/pycaw lazy-import and list audio endpoints. Tăng giảm âm lượng loa, tắt tiếng mute, bật tiếng unmute, liệt kê thiết bị âm thanh micro tai nghe.",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["set_volume", "toggle_mute", "volume_step", "list_audio_devices"]
            },
            "percent": {
                "type": "integer",
                "minimum": 0,
                "maximum": 100,
                "default": 50
            },
            "delta": {
                "type": "integer",
                "default": 10
            }
        },
        "required": ["action"]
    }
}

def execute(action: str = "set_volume", **kwargs) -> Dict[str, Any]:
    if action == "set_volume":
        return set_volume(kwargs.get("percent", 50))
    elif action == "toggle_mute":
        return toggle_mute()
    elif action == "volume_step":
        return volume_step(kwargs.get("delta", 10))
    elif action == "list_audio_devices":
        return list_audio_devices()
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

def set_volume(percent: int = 50) -> Dict[str, Any]:
    try:
        from pycaw.pycaw import AudioUtilities, ISimpleAudioVolume
        sessions = AudioUtilities.GetAllSessions()
        for session in sessions:
            interface = session._ctl.QueryInterface(ISimpleAudioVolume)
            interface.SetMasterVolume(percent / 100.0, None)
        return {"ok": True, "message": f"Volume set to {percent}%"}
    except ImportError:
        return {"ok": False, "error": "Missing package pycaw"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def toggle_mute() -> Dict[str, Any]:
    try:
        from pycaw.pycaw import AudioUtilities, ISimpleAudioVolume
        sessions = AudioUtilities.GetAllSessions()
        for session in sessions:
            interface = session._ctl.QueryInterface(ISimpleAudioVolume)
            interface.SetMute(not interface.GetMute(), None)
        return {"ok": True, "message": "Mute toggled"}
    except ImportError:
        return {"ok": False, "error": "Missing package pycaw"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def volume_step(delta: int = 10) -> Dict[str, Any]:
    try:
        from pycaw.pycaw import AudioUtilities, ISimpleAudioVolume
        sessions = AudioUtilities.GetAllSessions()
        for session in sessions:
            interface = session._ctl.QueryInterface(ISimpleAudioVolume)
            current_volume = interface.GetMasterVolume()
            new_volume = min(max(current_volume + delta / 100.0, 0.0), 1.0)
            interface.SetMasterVolume(new_volume, None)
        return {"ok": True, "message": f"Volume adjusted by {delta}%"}
    except ImportError:
        return {"ok": False, "error": "Missing package pycaw"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def list_audio_devices() -> Dict[str, Any]:
    try:
        from pycaw.pycaw import AudioUtilities
        all_devs = AudioUtilities.GetAllDevices() or []
        device_list = []
        for dev in all_devs:
            name = getattr(dev, "FriendlyName", None)
            if name:
                device_list.append(str(name))
        if not device_list:
            sp = AudioUtilities.GetSpeakers()
            sp_name = getattr(sp, "FriendlyName", None) or str(sp)
            if sp_name:
                device_list.append(sp_name)
        return {"ok": True, "count": len(device_list), "devices": device_list[:30]}
    except ImportError:
        return {"ok": False, "error": "Missing package pycaw"}
    except Exception as e:
        return {"ok": False, "error": str(e)}
