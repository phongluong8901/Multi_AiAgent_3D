import time
import json
import sys
import types
from typing import Any, Dict, List, Optional

TOOL_SCHEMA = {
    "name": "skill_http_api_tester",
    "risk_level": "safe",
    "description": "Send HTTP GET/POST/HEAD requests (urllib/httpx lazy-imported) to test local or remote endpoints, measuring latency, headers, and JSON response preview. test API REST HTTP GET POST giống Postman curl, đo thời gian phản hồi latency kiểm tra status code",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["request", "health_check"]
            },
            "url": {
                "type": "string"
            },
            "urls": {
                "type": "array",
                "items": {
                    "type": "string"
                }
            },
            "method": {
                "type": "string",
                "enum": ["GET", "POST", "HEAD"],
                "default": "GET"
            },
            "headers": {
                "type": "object",
                "additionalProperties": {
                    "type": "string"
                },
                "default": {}
            },
            "body": {
                "type": "object",
                "additionalProperties": {
                    "type": "any"
                },
                "default": {}
            },
            "timeout": {
                "type": "integer",
                "default": 10
            }
        },
        "required": ["action"],
        "oneOf": [
            {"required": ["url"]},
            {"required": ["urls"]}
        ]
    }
}

def execute(action: str = "request", **kwargs) -> Dict[str, Any]:
    if action == "request":
        return _request(**kwargs)
    elif action == "health_check":
        return _health_check(**kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

def _request(url: str, method: str = "GET", headers: Optional[Dict[str, str]] = None, body: Optional[Dict[str, Any]] = None, timeout: int = 10) -> Dict[str, Any]:
    try:
        import httpx
    except ImportError:
        return {"ok": False, "error": "Missing package httpx"}

    headers = headers or {}
    body = body or {}

    try:
        start_time = time.time()
        if method == "GET":
            response = httpx.request(method, url, headers=headers, timeout=timeout)
        elif method == "POST":
            response = httpx.request(method, url, headers=headers, json=body, timeout=timeout)
        elif method == "HEAD":
            response = httpx.request(method, url, headers=headers, timeout=timeout)
        else:
            return {"ok": False, "error": f"Unsupported method: {method}"}

        latency = time.time() - start_time
        response_data = {
            "ok": True,
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "latency": latency
        }

        try:
            response_data["json"] = response.json()
        except ValueError:
            response_data["text"] = response.text

        return response_data

    except httpx.RequestError as e:
        return {"ok": False, "error": str(e)}

def _health_check(urls: List[str], timeout: int = 10) -> Dict[str, Any]:
    results = {}
    for url in urls:
        result = _request(url, method="HEAD", timeout=timeout)
        results[url] = result
    return {"ok": True, "results": results}
