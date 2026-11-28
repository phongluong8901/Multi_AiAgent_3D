TOOL_SCHEMA = {
    "name": "skill_chrome_frame_shadow_piercer",
    "description": "xuyên iframe và Shadow DOM trên Chrome CDP, tìm phần tử bên trong iframe lồng nhau, đọc và bấm nút trong shadowRoot web hiện đại",
    "risk_level": "confirm",
    "parameters": {
        "selector_chain": "list[str]",
        "action": "str",
        "value": "str",
        "frames": "list[dict]",
        "url_filter": "str",
        "frame_url_contains": "str",
        "selector": "str",
        "action": "str",
        "text": "str",
        "cdp_url": "str",
        "dry_run": "bool"
    }
}

def build_shadow_pierce_js(selector_chain: list[str], action: str = 'text', value: str = '') -> str:
    js = "let element = document;"
    for selector in selector_chain:
        js += f"element = element.querySelector('{selector}');"
        if 'shadowRoot' in selector:
            js += "element = element.shadowRoot;"
    if action == 'click':
        js += f"element.click();"
    elif action == 'input':
        js += f"element.value = '{value}';"
    elif action == 'text':
        js += "return element.textContent;"
    return js

def parse_frame_tree(frames: list[dict], url_filter: str = '') -> list[dict]:
    filtered_frames = []
    for frame in frames:
        if url_filter in frame.get('url', ''):
            filtered_frames.append(frame)
        if 'childFrames' in frame:
            filtered_frames.extend(parse_frame_tree(frame['childFrames'], url_filter))
    return filtered_frames

def _fetch_raw(url, data=None):
    try:
        import requests
    except ImportError:
        return {"ok": False, "error": "Missing package requests"}
    
    if data:
        response = requests.post(url, json=data)
    else:
        response = requests.get(url)
    return response.json()

def query_in_frame(frame_url_contains: str, selector: str, action: str = 'extract_text', text: str = '', cdp_url: str = 'http://localhost:9222', dry_run: bool = True) -> dict:
    session = _fetch_raw(f"{cdp_url}/json")
    target_frame = None
    for frame in session:
        if frame_url_contains in frame['url']:
            target_frame = frame
            break
    
    if not target_frame:
        return {"ok": False, "error": "Frame not found"}
    
    if dry_run:
        return {"ok": True, "message": "Dry run successful"}
    
    js = build_shadow_pierce_js(selector.split('>>'), action, text)
    result = _fetch_raw(f"{target_frame['webSocketDebuggerUrl']}/json/protocol", {"method": "Runtime.evaluate", "params": {"expression": js}})
    
    if 'result' in result and 'value' in result['result']:
        return {"ok": True, "value": result['result']['value']}
    else:
        return {"ok": False, "error": "Failed to execute JS"}

def execute(action: str = "build_shadow_pierce_js", **kwargs) -> dict:
    if action == "build_shadow_pierce_js":
        return {"ok": True, "js": _safe_call(build_shadow_pierce_js, kwargs)}
    elif action == "parse_frame_tree":
        return {"ok": True, "frames": _safe_call(parse_frame_tree, kwargs)}
    elif action == "query_in_frame":
        return _safe_call(query_in_frame, kwargs)
    else:
        return {"ok": False, "error": "Unknown action"}

def _safe_call(fn, kw):
    import inspect as _insp
    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
