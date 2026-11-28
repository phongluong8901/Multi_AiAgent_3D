import json
import time
import urllib.request
import urllib.parse
import os
import re
import ast
import difflib
import sqlite3
import socket
import subprocess
import pathlib
import shutil

TOOL_SCHEMA = {
    "name": "skill_dev_live_api_prober",
    "description": "Probe live HTTP/JSON APIs via mockable `_http_request` to inspect status code, latency, and compact inferred JSON schema + truncated sample payload, plus provide a built-in catalog of keyless public API presets (Open-Meteo weather, ExchangeRate, GitHub, HackerNews).",
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["probe_http_json", "summarize_json_structure", "list_free_api_presets"]},
        },
        "required": ["action"],
    },
}

def _http_request(url, method='GET', headers=None, timeout=8.0):
    if headers is None:
        headers = {}
    request = urllib.request.Request(url, headers=headers, method=method)
    start_time = time.time()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            status_code = response.getcode()
            response_headers = dict(response.getheaders())
            raw_json = response.read().decode('utf-8')
            latency = time.time() - start_time
            return status_code, response_headers, raw_json, latency
    except urllib.error.HTTPError as e:
        return e.code, {}, "", time.time() - start_time
    except Exception as e:
        return 500, {}, str(e), time.time() - start_time

def _run_cmd(cmd, cwd=None):
    process = subprocess.Popen(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    stdout, stderr = process.communicate()
    return process.returncode, stdout, stderr

def probe_http_json(url, method='GET', headers=None, timeout=8.0, dry_run=True):
    if dry_run:
        return {"ok": False, "error": "Dry run mode"}
    status_code, response_headers, raw_json, latency = _http_request(url, method, headers, timeout)
    try:
        sample_payload = json.loads(raw_json)
        schema = summarize_json_structure(raw_json)
        return {
            "ok": True,
            "status_code": status_code,
            "latency": latency,
            "schema": schema,
            "sample_payload": sample_payload
        }
    except json.JSONDecodeError:
        return {"ok": False, "error": "Invalid JSON response"}

def summarize_json_structure(raw_json, max_depth=3):
    def summarize(obj, depth=0):
        if depth > max_depth:
            return "..."
        if isinstance(obj, dict):
            return {k: summarize(v, depth + 1) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [summarize(obj[0], depth + 1)] if obj else []
        else:
            return type(obj).__name__
    try:
        data = json.loads(raw_json)
        return summarize(data)
    except json.JSONDecodeError:
        return {}

def list_free_api_presets(category=''):
    presets = {
        "weather": "https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current_weather=true",
        "exchange_rate": "https://api.frankfurter.app/latest",
        "github": "https://api.github.com",
        "hackernews": "https://hacker-news.firebaseio.com/v0/topstories.json"
    }
    if category:
        return {k: v for k, v in presets.items() if category.lower() in k.lower()}
    return presets

def execute(action, **kwargs):
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    if action == "probe_http_json":
        return probe_http_json(**kwargs, dry_run=False)
    elif action == "summarize_json_structure":
        return summarize_json_structure(kwargs.get("raw_json", ""))
    elif action == "list_free_api_presets":
        return list_free_api_presets(kwargs.get("category", ""))
    return {"ok": False, "error": "Action not implemented"}
