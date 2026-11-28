import os
import re
import ast
import json
import difflib
import socket
import subprocess
import urllib.request
import pathlib
import shutil

TOOL_SCHEMA = {
    "name": "skill_dev_realtime_ws_hub_builder",
    "description": "Scaffold a Reverse WebSocket Hub + Worker architecture (FastAPI/websockets Python templates) with API-key authentication, node registration, heartbeat tracking, and `exec_task` protocol helpers (dry_run=True default). Tạo khung WebSocket Hub và Worker Client kết nối giám sát điều khiển máy Windows Linux từ xa, xác thực API key heartbeat exec_task",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["generate_ws_hub_py", "generate_ws_worker_py", "scaffold_hub_worker_pair"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: list[str], cwd: str=None) -> str:
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def _http_get(url: str, timeout: float=3.0) -> str:
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return response.read().decode('utf-8')

def generate_ws_hub_py(port: int=8766, auth_env_key: str='HUB_API_KEY', dry_run: bool=True) -> str:
    template = """
import os
import asyncio
import websockets
import json

HUB_API_KEY = os.getenv('{auth_env_key}', 'default_api_key')

connected_workers = set()

async def register(websocket):
    connected_workers.add(websocket)

async def unregister(websocket):
    connected_workers.remove(websocket)

async def heartbeat(websocket, path):
    await register(websocket)
    try:
        async for message in websocket:
            data = json.loads(message)
            if data.get('action') == 'heartbeat':
                await websocket.send(json.dumps({'status': 'ok'}))
    finally:
        await unregister(websocket)

async def exec_task(websocket, path):
    await register(websocket)
    try:
        async for message in websocket:
            data = json.loads(message)
            if data.get('action') == 'exec_task':
                task = data.get('task')
                # Execute task logic here
                await websocket.send(json.dumps({'status': 'task_received', 'task': task}))
    finally:
        await unregister(websocket)

async def auth(websocket, path):
    received = await websocket.recv()
    data = json.loads(received)
    if data.get('api_key') != HUB_API_KEY:
        await websocket.close()
        return
    await websocket.send(json.dumps({'status': 'authenticated'}))
    await asyncio.gather(
        heartbeat(websocket, path),
        exec_task(websocket, path)
    )

start_server = websockets.serve(auth, '0.0.0.0', {port})

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
"""
    code = template.replace('{auth_env_key}', auth_env_key).replace('{port}', str(port))
    if not dry_run:
        with open('ws_hub.py', 'w') as f:
            f.write(code)
    return code

def generate_ws_worker_py(hub_url: str='ws://127.0.0.1:8766/ws', node_id: str='worker-1', dry_run: bool=True) -> str:
    template = """
import asyncio
import websockets
import json
import os

HUB_URL = '{hub_url}'
NODE_ID = '{node_id}'
API_KEY = os.getenv('WORKER_API_KEY', 'default_worker_api_key')

async def heartbeat(websocket):
    while True:
        await websocket.send(json.dumps({'action': 'heartbeat'}))
        response = await websocket.recv()
        data = json.loads(response)
        if data.get('status') != 'ok':
            break
        await asyncio.sleep(5)

async def exec_task(websocket):
    while True:
        await websocket.send(json.dumps({'action': 'exec_task', 'task': 'example_task'}))
        response = await websocket.recv()
        data = json.loads(response)
        if data.get('status') != 'task_received':
            break
        await asyncio.sleep(10)

async def main():
    async with websockets.connect(HUB_URL) as websocket:
        await websocket.send(json.dumps({'api_key': API_KEY}))
        response = await websocket.recv()
        data = json.loads(response)
        if data.get('status') != 'authenticated':
            print('Authentication failed')
            return
        await asyncio.gather(
            heartbeat(websocket),
            exec_task(websocket)
        )

asyncio.run(main())
"""
    code = template.replace('{hub_url}', hub_url).replace('{node_id}', node_id)
    if not dry_run:
        with open('ws_worker.py', 'w') as f:
            f.write(code)
    return code

def scaffold_hub_worker_pair(project_dir: str, hub_url: str='ws://127.0.0.1:8766/ws', dry_run: bool=True) -> dict:
    if not dry_run:
        pathlib.Path(project_dir).mkdir(parents=True, exist_ok=True)
    hub_code = generate_ws_hub_py(dry_run=dry_run)
    worker_code = generate_ws_worker_py(hub_url=hub_url, dry_run=dry_run)
    if not dry_run:
        with open(os.path.join(project_dir, 'ws_hub.py'), 'w') as f:
            f.write(hub_code)
        with open(os.path.join(project_dir, 'ws_worker.py'), 'w') as f:
            f.write(worker_code)
    return {"hub_code": hub_code, "worker_code": worker_code}

def execute(action: str = "generate_ws_hub_py", **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    if action == "generate_ws_hub_py":
        return {"ok": True, "code": generate_ws_hub_py(**kwargs)}
    elif action == "generate_ws_worker_py":
        return {"ok": True, "code": generate_ws_worker_py(**kwargs)}
    elif action == "scaffold_hub_worker_pair":
        return {"ok": True, "result": scaffold_hub_worker_pair(**kwargs)}
    return {"ok": False, "error": "Unexpected error"}
