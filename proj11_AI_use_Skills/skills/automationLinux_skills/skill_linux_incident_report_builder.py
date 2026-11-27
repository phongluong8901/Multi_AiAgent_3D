import os
import json
import time
import datetime
import subprocess
from pathlib import Path

TOOL_SCHEMA = {   'name': 'skill_linux_incident_report_builder',
    'description': 'Tổng hợp báo cáo sức khỏe và sự cố máy chủ Linux Markdown JSON, chấm điểm '
                   'trạng thái hệ thống, lưu lịch sử báo cáo. Compute a 0-100 Linux health score '
                   'from CPU/RAM/Disk/Temp metrics, render a concise Markdown incident & health '
                   'report including failed services and errors, and save it to disk.',
    'risk_level': 'safe',
    'parameters': {   'type': 'object',
                      'properties': {   'action': {   'enum': [   'score_system_health',
                                                                  'build_markdown_report',
                                                                  'save_report'],
                                                      'type': 'string'},
                                        'metrics': {'type': 'object'},
                                        'hostname': {'type': 'string'},
                                        'failed_units': {   'type': 'array',
                                                            'items': {'type': 'string'}},
                                        'recent_errors': {   'type': 'array',
                                                             'items': {'type': 'string'}},
                                        'report_text': {'type': 'string'},
                                        'output_dir': {'type': 'string'},
                                        'prefix': {'type': 'string'},
                                        'dry_run': {'type': 'boolean'}},
                      'required': ['action']}}

def _run_cmd(cmd: list[str]) -> tuple[int, str, str]:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', check=False)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)

def score_system_health(metrics: dict) -> int:
    cpu_usage = metrics.get('cpu_usage', 0)
    ram_usage = metrics.get('ram_usage', 0)
    disk_usage = metrics.get('disk_usage', 0)
    temp = metrics.get('temp', 0)

    # Simple health scoring logic
    score = 100 - (cpu_usage + ram_usage + disk_usage + temp) / 4
    return max(0, min(100, int(score)))

def build_markdown_report(hostname: str, metrics: dict, failed_units: list[str] = None, recent_errors: list[str] = None) -> str:
    failed_units = failed_units or []
    recent_errors = recent_errors or []

    report = f"# Incident Report for {hostname}\n"
    report += f"Generated on: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    report += f"## System Health Score: {score_system_health(metrics)}\n\n"
    report += "## Metrics:\n"
    for key, value in metrics.items():
        report += f"- {key}: {value}\n"
    report += "\n## Failed Services:\n"
    if failed_units:
        for unit in failed_units:
            report += f"- {unit}\n"
    else:
        report += "- None\n"
    report += "\n## Recent Errors:\n"
    if recent_errors:
        for error in recent_errors:
            report += f"- {error}\n"
    else:
        report += "- None\n"
    return report

def save_report(report_text: str, output_dir: str = 'reports', prefix: str = 'incident', dry_run: bool = True) -> dict:
    try:
        if dry_run:
            return {"ok": True, "message": "Dry run completed, no files were written."}

        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.datetime.now().strftime('%Y%m%d%H%M%S')
        file_name = f"{prefix}_{timestamp}.md"
        file_path = output_path / file_name

        with open(file_path, 'w', encoding='utf-8') as file:
            file.write(report_text)

        return {"ok": True, "file_path": str(file_path)}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def execute(action: str = "score_system_health", **kwargs) -> dict:
    dry_run = kwargs.pop('dry_run', True)
    if action == "score_system_health":
        metrics = kwargs.get('metrics', {})
        return {"ok": True, "score": score_system_health(metrics)}
    elif action == "build_markdown_report":
        hostname = kwargs.get('hostname', 'unknown')
        metrics = kwargs.get('metrics', {})
        failed_units = kwargs.get('failed_units', [])
        recent_errors = kwargs.get('recent_errors', [])
        report = build_markdown_report(hostname, metrics, failed_units, recent_errors)
        return {"ok": True, "report": report}
    elif action == "save_report":
        report_text = kwargs.get('report_text', '')
        output_dir = kwargs.get('output_dir', 'reports')
        prefix = kwargs.get('prefix', 'incident')
        return save_report(report_text, output_dir, prefix, dry_run)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
