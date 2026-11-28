import json
import os
import re
import socket
import subprocess
import urllib.request
from pathlib import Path
from typing import Any, Dict, List

TOOL_SCHEMA = {
    "name": "skill_dev_api_client_generator",
    "description": "Infer normalized JSON schema types (bool->boolean, int->integer, float->number, str->string, list->array, dict->object, None->null) from a JSON string, generate HTTP client code in python/js/rust, and generate a stdlib http.server mock stub. Sinh mã nguồn client gọi API Python JS Rust từ JSON mẫu, suy luận cấu trúc trường dữ liệu và tạo mock server kiểm thử cục bộ.",
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["infer_json_schema", "generate_api_client_code", "generate_mock_server_stub"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: List[str], cwd: str = None) -> str:
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def _http_get(url: str, timeout: float = 3.0) -> str:
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return response.read().decode('utf-8')

def infer_json_schema(sample_json: str) -> Dict[str, Any]:
    def infer_type(value: Any) -> str:
        if isinstance(value, bool):
            return "boolean"
        elif isinstance(value, int):
            return "integer"
        elif isinstance(value, float):
            return "number"
        elif isinstance(value, str):
            return "string"
        elif isinstance(value, list):
            if value:
                return {"type": "array", "items": infer_type(value[0])}
            return {"type": "array"}
        elif isinstance(value, dict):
            return {"type": "object", "properties": {k: infer_type(v) for k, v in value.items()}, "required": list(value.keys())}
        elif value is None:
            return "null"
        raise ValueError(f"Unknown type: {type(value)}")

    try:
        data = json.loads(sample_json)
        return infer_type(data)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON: {e}")

def generate_api_client_code(base_url: str, endpoints: List[Dict[str, Any]], lang: str = 'python', dry_run: bool = True) -> str:
    if lang == 'python':
        template = """
import requests

BASE_URL = '__BASE_URL__'

def __METHOD__(path, data=None):
    url = f"{BASE_URL}{path}"
    if data:
        response = requests.__METHOD__(url, json=data)
    else:
        response = requests.__METHOD__(url)
    response.raise_for_status()
    return response.json()

__ENDPOINTS__
"""
        endpoint_template = "def {name}({params}):\n    return {method}('{path}', {data})\n\n"
    elif lang == 'js':
        template = """
const axios = require('axios');

const BASE_URL = '__BASE_URL__';

async function __METHOD__(path, data = null) {{
    const url = `${{BASE_URL}}${{path}}`;
    if (data) {{
        const response = await axios.__METHOD__(url, data);
        return response.data;
    }} else {{
        const response = await axios.__METHOD__(url);
        return response.data;
    }}
}}

__ENDPOINTS__
"""
        endpoint_template = "async function {name}({params}) {{\n    return {method}('{path}', {data});\n}}\n\n"
    elif lang == 'rust':
        template = """
use reqwest::Client;
use serde::{{Deserialize, Serialize}};
use std::error::Error;

const BASE_URL: &str = "__BASE_URL__";

async fn __METHOD__(path: &str, data: Option<&serde_json::Value>) -> Result<serde_json::Value, Box<dyn Error>> {{
    let client = Client::new();
    let url = format!("{{}}{}", path, BASE_URL);
    let response = if let Some(data) = data {{
        client.__METHOD__(&url).json(data).send().await?
    }} else {{
        client.__METHOD__(&url).send().await?
    }};
    Ok(response.json().await?)
}}

__ENDPOINTS__
"""
        endpoint_template = "async fn {name}({params}) -> Result<serde_json::Value, Box<dyn Error>> {{\n    {method}('{path}', {data})\n}}\n\n"
    else:
        raise ValueError(f"Unsupported language: {lang}")

    endpoints_code = ""
    for endpoint in endpoints:
        method = endpoint['method'].lower()
        path = endpoint['path']
        params = ', '.join(endpoint.get('params', []))
        data = 'Some(data)' if endpoint.get('data', False) else 'None'
        endpoints_code += endpoint_template.format(name=endpoint['name'], method=method, path=path, params=params, data=data)

    code = template.replace('__BASE_URL__', base_url).replace('__ENDPOINTS__', endpoints_code)
    if not dry_run:
        with open(f"{lang}_api_client.py", "w") as f:
            f.write(code)
    return code

def generate_mock_server_stub(endpoints: List[Dict[str, Any]], port: int = 8080, dry_run: bool = True) -> str:
    template = """
import http.server
import json

class MockServerHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self._handle_request('GET')

    def do_POST(self):
        self._handle_request('POST')

    def do_PUT(self):
        self._handle_request('PUT')

    def do_DELETE(self):
        self._handle_request('DELETE')

    def _handle_request(self, method):
        if self.path in ENDPOINTS:
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = ENDPOINTS[self.path][method]
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_error(404, 'Not Found')

if __name__ == '__main__':
    with http.server.HTTPServer(('localhost', PORT), MockServerHandler) as httpd:
        print(f"Serving at port {PORT}")
        httpd.serve_forever()
"""
    endpoints_dict = {endpoint['path']: {endpoint['method'].upper(): endpoint.get('response', {})} for endpoint in endpoints}
    code = template.replace('ENDPOINTS', json.dumps(endpoints_dict, indent=4)).replace('PORT', str(port))
    if not dry_run:
        with open("mock_server.py", "w") as f:
            f.write(code)
    return code

def execute(action: str = "infer_json_schema", **kwargs) -> Dict[str, Any]:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}

    try:
        if action == "infer_json_schema":
            sample_json = kwargs.get("sample_json")
            if sample_json is None:
                return {"ok": False, "error": "Missing sample_json"}
            schema = infer_json_schema(sample_json)
            return {"ok": True, "schema": schema}
        elif action == "generate_api_client_code":
            base_url = kwargs.get("base_url")
            endpoints = kwargs.get("endpoints")
            lang = kwargs.get("lang", "python")
            if base_url is None or endpoints is None:
                return {"ok": False, "error": "Missing base_url or endpoints"}
            code = generate_api_client_code(base_url, endpoints, lang)
            return {"ok": True, "code": code}
        elif action == "generate_mock_server_stub":
            endpoints = kwargs.get("endpoints")
            port = kwargs.get("port", 8080)
            if endpoints is None:
                return {"ok": False, "error": "Missing endpoints"}
            code = generate_mock_server_stub(endpoints, port)
            return {"ok": True, "code": code}
    except Exception as e:
        return {"ok": False, "error": str(e)}

    return {"ok": False, "error": "Unexpected error"}
