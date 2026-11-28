import os
import re
import subprocess
from pathlib import Path

TOOL_SCHEMA = {   'name': 'skill_linux_hardware_bus_inspector',
    'description': 'Liệt kê thiết bị phần cứng Linux USB lsusb, cổng serial ttyUSB ttyACM, kiểm '
                   'tra bus I2C SPI GPIO trên Linux nhúng. List attached Linux hardware '
                   'interfaces: discover `/dev/ttyUSB*`, `/dev/ttyACM*`, I2C/SPI/GPIO device nodes '
                   'in a configurable dev directory, and parse `lsusb` output.',
    'risk_level': 'safe',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'enum': [   'list_serial_devices',
                                                                  'parse_lsusb_output',
                                                                  'check_bus_access'],
                                                      'type': 'string'},
                                        'dev_dir': {'type': 'string'},
                                        'dry_run': {'type': 'boolean'},
                                        'raw_text': {'type': 'string'}},
                      'required': ['action']}}

def _run_cmd(cmd: list[str]) -> tuple[int, str, str]:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', check=False)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)

def list_serial_devices(dev_dir: str = '/dev', dry_run: bool = True) -> dict:
    if dry_run:
        return {"ok": True, "devices": []}
    
    try:
        devices = [str(d) for d in Path(dev_dir).glob('ttyUSB*') if d.is_char_device()]
        devices.extend([str(d) for d in Path(dev_dir).glob('ttyACM*') if d.is_char_device()])
        return {"ok": True, "devices": devices}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def parse_lsusb_output(raw_text: str, dry_run: bool = True) -> dict:
    if dry_run:
        return {"ok": True, "devices": []}
    
    try:
        devices = []
        for line in raw_text.splitlines():
            match = re.match(r'Bus (\d+) Device (\d+): ID (\w+):(\w+) (.+)', line)
            if match:
                bus, device, vendor_id, product_id, description = match.groups()
                devices.append({
                    "bus": bus,
                    "device": device,
                    "vendor_id": vendor_id,
                    "product_id": product_id,
                    "description": description
                })
        return {"ok": True, "devices": devices}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def check_bus_access(dev_dir: str = '/dev', dry_run: bool = True) -> dict:
    if dry_run:
        return {"ok": True, "access": {}}
    
    try:
        access = {}
        for bus in ['i2c', 'spi', 'gpio']:
            access[bus] = any(d.is_dir() for d in Path(dev_dir).glob(f'{bus}*'))
        return {"ok": True, "access": access}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def execute(action: str = "list_serial_devices", **kwargs) -> dict:
    dry_run = kwargs.get('dry_run', True)
    dev_dir = kwargs.get('dev_dir', '/dev')
    if action == "list_serial_devices":
        return list_serial_devices(dev_dir=dev_dir, dry_run=dry_run)
    elif action == "parse_lsusb_output":
        raw_text = kwargs.get('raw_text', '')
        return parse_lsusb_output(raw_text, dry_run=dry_run)
    elif action == "check_bus_access":
        return check_bus_access(dev_dir=dev_dir, dry_run=dry_run)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
