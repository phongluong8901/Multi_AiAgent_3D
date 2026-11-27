import pytest
import skill_linux_thermal_power as mod
from pathlib import Path

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_thermal_power"
    assert mod.TOOL_SCHEMA["risk_level"] == "safe"
    assert "action" in mod.TOOL_SCHEMA["parameters"]["properties"]
    assert set(mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]) == {"read_thermal_zones", "evaluate_thermal_status", "check_throttling_info"}

def test_execute_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_read_thermal_zones(monkeypatch, tmp_path):
    thermal_dir = tmp_path / "sys/class/thermal"
    thermal_dir.mkdir(parents=True)
    zone1 = thermal_dir / "thermal_zone0"
    zone1.mkdir()
    (zone1 / "temp").write_text("45000\n")
    zone2 = thermal_dir / "thermal_zone1"
    zone2.mkdir()
    (zone2 / "temp").write_text("80000\n")

    monkeypatch.setattr(mod, "os", type('os', (object,), {'listdir': lambda x: ['thermal_zone0', 'thermal_zone1']}))
    result = mod.read_thermal_zones(str(thermal_dir))
    assert result == {"ok": True, "thermal_zones": [45.0, 80.0]}

def test_evaluate_thermal_status():
    temps = [45.0, 72.0, 86.0]
    result = mod.evaluate_thermal_status(temps)
    assert result == {"ok": False, "status": "critical", "temperatures": [86.0]}

def test_check_throttling_info(monkeypatch):
    def mock_run_cmd(cmd):
        return 0, "current CPU frequency is 400 MHz (asserted by call to hardware)", ""
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.check_throttling_info()
    assert result == {"ok": True, "throttling": True, "frequency": 400}
