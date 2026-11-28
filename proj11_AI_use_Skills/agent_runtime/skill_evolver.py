"""Self-evolving Skill Studio engine: Coder/Rewriter -> AST Security Gate -> Pytest -> Fixer -> Hot-Reload.

Supports:
1. Rewriting / fixing an existing skill (`skills/<pack>/skill_<name>.py`) with automatic backup & rollback.
2. Creating a brand-new skill in `skills/auto_skills/skill_<name>.py`.
3. Manual code edit + Pytest verification + live Hot-Reload into `SkillRegistry`.
"""
from __future__ import annotations

import ast
import importlib
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types

from agent_runtime.config import DATA_DIR, DEFAULT_API_TIMEOUT_SEC, DEFAULT_MODEL, SKILLS_ROOT
from agent_runtime.executor import extract_text, run_interruptible

BACKUP_DIR = DATA_DIR / "skill_backups"
VERSIONS_DIR = DATA_DIR / "skill_versions"
AUTO_PACK_DIR = SKILLS_ROOT / "auto_skills"

# Dangerous calls/imports blocked in generated skill code
_FORBIDDEN_IMPORTS = frozenset({"subprocess", "pty", "ctypes", "winreg"})
_FORBIDDEN_CALLS = frozenset({"eval", "exec", "compile", "__import__"})
_FORBIDDEN_ATTR_CALLS = frozenset(
    {
        ("os", "system"),
        ("os", "popen"),
        ("os", "remove"),
        ("os", "unlink"),
        ("os", "rmdir"),
        ("shutil", "rmtree"),
    }
)

# Safe curated allowlist mapping import root name -> PyPI package name for auto-install
_SAFE_IMPORT_TO_PYPI: dict[str, str] = {
    "psutil": "psutil",
    "pyperclip": "pyperclip",
    "bs4": "beautifulsoup4",
    "PIL": "pillow",
    "yaml": "pyyaml",
    "docx": "python-docx",
    "pptx": "python-pptx",
    "qrcode": "qrcode",
    "youtube_transcript_api": "youtube-transcript-api",
    "pyautogui": "pyautogui",
    "pygetwindow": "pygetwindow",
    "pycaw": "pycaw",
    "uiautomation": "uiautomation",
    "ics": "ics",
    "mss": "mss",
    "feedparser": "feedparser",
    "lxml": "lxml",
    "tabulate": "tabulate",
    "requests": "requests",
    "httpx": "httpx",
    "ddgs": "ddgs",
    "pypdf": "pypdf",
    "openpyxl": "openpyxl",
    "pandas": "pandas",
    "numpy": "numpy",
    "scipy": "scipy",
    "matplotlib": "matplotlib",
    "jsonschema": "jsonschema",
    "pydantic": "pydantic",
    "dns": "dnspython",
    "whois": "python-whois",
    "tzdata": "tzdata",
    "win32com": "pywin32",
    "rich": "rich",
    "curl_cffi": "curl_cffi",
    "markitdown": "markitdown",
    "trafilatura": "trafilatura",
    "playwright": "playwright",
    "websocket": "websocket-client",
}

_CODER_SYSTEM_PROMPT = """Ban la Senior Python Tool Engineer chuyen viet va sua cac module Skill cho Gemini Function Calling.

QUY TAC BAT BUOC CHO FILE SKILL (`skill_<name>.py`):
1. Dinh nghia 1 public class chinh (vi du `GoldPriceClient`), ten class KHONG bat dau bang `_`.
2. Moi public method cua class se duoc tu dong dang ky lam Tool cho Gemini:
   - BAT BUOC co day du Python type annotations cho moi tham so (str, int, float, bool, list[dict], ...) va kieu tra ve (`-> dict` hoac `-> list[dict]`).
   - BAT BUOC co docstring ngan gon mo ta ro chuc nang o dong dau tien.
   - `__init__(self)` KHONG bat buoc tham so nao (tat ca tham so cua `__init__` phai co gia tri mac dinh).
3. Uu tien dung thu vien co san hoac thu vien pho bien (`httpx`, `psutil`, `pyperclip`, `bs4`, `pandas`, `pypdf`, `openpyxl`, `ddgs`, `qrcode`, `feedparser`, `playwright`, `matplotlib`).
   QUAN TRONG:
   - Khong bao gio nuot `ImportError` roi tra ve so 0 gia tao; neu thieu thu vien hay `raise RuntimeError("Missing package ...")`.
   - Neu yeu cau la ve bieu do / hinh anh (chart, plot, graph), BAT BUOC dung `matplotlib` (backend `Agg`) ve anh `.png` luu vao `self.output_dir` (khai bao `__init__(self, output_dir: str = "outputs")`) de Web UI tu dong hien thi anh truc tiep trong khung chat, KHONG chi ve ASCII text!
4. CHIEN LUOC CHONG LAP LOI (SPA / API / WEB CAN DANG NHAP):
   - Neu `error_context` cho thay `httpx + BeautifulSoup` khong trich xuat duoc du lieu tu trang web (do trang SPA render bang JavaScript nhu ZingMP3, React/Next/Vue, hoac HTTP 403/404): CAM LAP LAI BeautifulSoup tren HTML tinh!
   - Hay chuyen chien luoc: (a) dung `playwright.sync_api` (headless Chromium) de render JS / bat response XHR JSON, HOAC (b) dung nguon API/RSS cong khai on dinh (vi du RSS XML, public JSON endpoint).
   - VOI CAC TRANG WEB CAN DANG NHAP CA NHAN (Zalo Web `chat.zalo.me`, Gmail, Google Drive, Facebook, Telegram Web, ERP...): UU TIEN ket noi vao phien Chrome CDP da dang nhap san qua `from agent_runtime.cdp_pool import get_cdp_pool` (cong `http://127.0.0.1:9222`, profile `C:\\ChromeAgentProfile`) thay vi mo trinh duyet trang moi, VA luon tra ve `dict` co cau truc (vd: `{"ok": True, "login_required": False, "unread_count": len(items), "items": items}`) thay vi list rong `[]`.
5. CAM TUYET DOI REWARD HACKING / HARDCODE DU LIEU GIA:
   - KHONG BAO GIO duoc hardcode `fallback_data`, `dummy_data`, `sample_data` hoac tra ve danh sach bai hat/gia ca/ket qua co dinh gia tao de qua mat pytest/Live Smoke Probe.
   - Neu khong lay duoc du lieu that tu mang/API/Playwright, BAT BUOC `raise RuntimeError("...")` kem thong tin chan doan.
6. CAM TUYET DOI: Khong dung `subprocess`, `os.system`, `eval`, `exec`, `shutil.rmtree`, khong doc file `.env`, va khong dung emoji trong code/log.

QUY TAC BAT BUOC CHO FILE TEST (`test_skill_<name>.py`):
1. Dung `pytest` va `unittest.mock.patch` de mock cac loi goi mang (`httpx.get` / `httpx.Client` / `sync_playwright`) de test chay nhanh (<2s), on dinh, khong phu thuoc mang ngoai.
2. Import truc tiep tu module `from skill_<name> import <ClassName>`.
3. Test ca truong hop thanh cong lan truong hop dau vao khong hop le / HTTP loi.

DINH DANG TRA VE BAT BUOC:
Tra ve DUY NHAT 2 khoi code theo dung tag sau (khong giai thich dai dong ngoai tag):
<SKILL_CODE>
# noi dung day du cua skill_<name>.py
</SKILL_CODE>
<TEST_CODE>
# noi dung day du cua test_skill_<name>.py
</TEST_CODE>
"""

_FIXER_SYSTEM_PROMPT = """Ban la Senior Python QA & Debugging Engineer.
Ban nhan duoc `skill_code`, `test_code` va traceback loi tu AST Check, `pytest`, hoac **LIVE SMOKE PROBE (goi that ra he thong/mang)**.
Hay phan tich chinh xac nguyen nhan loi va tra ve ban code DA SUA HOAN CHINH cho ca 2 file.
QUAN TRONG:
- Neu loi den tu **LIVE SMOKE PROBE** (vi du HTTP 404, trang SPA/React rong khong co du lieu trong HTML tinh, hoac tra ve danh sach rong):
  TUYET DOI KHONG chi doi CSS selector BeautifulSoup kieu doan mo va TUYET DOI KHONG hardcode `fallback_data` gia tao de qua mat probe! Hay doi han chien luoc sang `playwright.sync_api` (render JS / bat JSON response) hoac dung nguon RSS/API cong khai that su hoat dong.
- Giu nguyen tat ca quy tac an toan (khong subprocess/eval/exec, day du type hint + docstring, khong emoji).

Tra ve DUY NHAT theo dung 2 tag:
<SKILL_CODE>
# noi dung day du cua skill_<name>.py
</SKILL_CODE>
<TEST_CODE>
# noi dung day du cua test_skill_<name>.py
</TEST_CODE>
"""


@dataclass
class EvolutionResult:
    ok: bool
    pack: str
    module_name: str
    skill_path: str
    test_path: str
    skill_code: str
    test_code: str
    pytest_output: str
    rounds_used: int = 0
    logs: list[str] = field(default_factory=list)
    backup_available: bool = False
    version: str = ""
    versions: list[dict[str, Any]] = field(default_factory=list)


def detect_missing_imports(code: str) -> list[str]:
    """Scan Python AST (including lazy imports inside functions) for missing third-party packages."""
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return []

    stdlib = sys.stdlib_module_names
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imported.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            imported.add(node.module.split(".")[0])

    missing: list[str] = []
    for mod in sorted(imported):
        if mod in stdlib or mod.startswith(("skill_", "agent_runtime", "skills", "_")):
            continue
        if importlib.util.find_spec(mod) is None:
            missing.append(mod)
    return missing


def ensure_skill_dependencies(code: str, auto_install: bool = True) -> list[str]:
    """Detect missing third-party imports and safely auto-install allowlisted PyPI packages into .venv."""
    logs: list[str] = []
    missing = detect_missing_imports(code)
    if not missing:
        return logs

    for mod in missing:
        pypi_pkg = _SAFE_IMPORT_TO_PYPI.get(mod)
        if not pypi_pkg:
            logs.append(f"[DEPS WARN] Missing non-allowlisted package '{mod}'. Install manually: pip install {mod}")
            continue
        if not auto_install:
            logs.append(f"[DEPS INFO] Missing allowlisted package '{pypi_pkg}' (auto_install=False).")
            continue

        logs.append(f"[DEPS] Missing '{mod}' -> auto-installing '{pypi_pkg}' into .venv...")
        try:
            proc = subprocess.run(
                [sys.executable, "-m", "pip", "install", "-q", pypi_pkg],
                capture_output=True,
                text=True,
                timeout=90,
            )
            if proc.returncode == 0:
                importlib.invalidate_caches()
                logs.append(f"[DEPS OK] Installed '{pypi_pkg}' successfully.")
            else:
                err = (proc.stderr or proc.stdout or "").strip()[:160]
                logs.append(f"[DEPS ERR] Failed to install '{pypi_pkg}': {err}")
        except Exception as exc:
            logs.append(f"[DEPS ERR] Failed to install '{pypi_pkg}': {type(exc).__name__}: {exc}")

    return logs


def validate_skill_ast(code: str, is_test: bool = False) -> list[str]:
    """Parse Python AST and verify syntax, safety constraints, and public skill structure."""
    errors: list[str] = []
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return [f"SyntaxError at line {exc.lineno}: {exc.msg}"]

    public_classes = 0
    public_methods = 0

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root_mod = alias.name.split(".")[0]
                if root_mod in _FORBIDDEN_IMPORTS:
                    errors.append(f"Forbidden import: '{alias.name}'")
        elif isinstance(node, ast.ImportFrom) and node.module:
            root_mod = node.module.split(".")[0]
            if root_mod in _FORBIDDEN_IMPORTS:
                errors.append(f"Forbidden import from: '{node.module}'")
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id in _FORBIDDEN_CALLS:
                errors.append(f"Forbidden call: '{node.func.id}()'")
            elif isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name):
                pair = (node.func.value.id, node.func.attr)
                if pair in _FORBIDDEN_ATTR_CALLS:
                    errors.append(f"Forbidden call: '{pair[0]}.{pair[1]}()'")
        elif isinstance(node, ast.Constant) and isinstance(node.value, str):
            if ".env" in node.value.lower() and not is_test:
                errors.append("Forbidden reference to '.env' in skill code")
        elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store) and not is_test:
            low_id = node.id.lower()
            if low_id in {"fallback_data", "mock_data", "dummy_data", "fake_data", "sample_data", "hardcoded_data"}:
                errors.append(
                    f"Reward hacking detected: forbidden hardcoded variable '{node.id}' in skill code. "
                    "Fetch real data or raise RuntimeError."
                )

    if not is_test:
        for node in tree.body:
            if isinstance(node, ast.ClassDef) and not node.name.startswith("_"):
                public_classes += 1
                for item in node.body:
                    if isinstance(item, ast.FunctionDef) and not item.name.startswith("_"):
                        public_methods += 1
        if public_classes == 0:
            errors.append("Skill file must define at least 1 public class (not starting with '_').")
        elif public_methods == 0:
            errors.append("Public skill class must define at least 1 public method.")

    return errors


def _extract_tagged_block(text: str, tag: str) -> str:
    pattern = rf"<{tag}>\s*(.*?)\s*</{tag}>"
    match = re.search(pattern, text, flags=re.DOTALL | re.IGNORECASE)
    raw = match.group(1).strip() if match else ""
    # Strip accidental markdown code fences inside tags
    raw = re.sub(r"^```(?:python|py)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


def sanitize_module_name(raw_name: str) -> str:
    clean = re.sub(r"[^a-z0-9_]+", "_", (raw_name or "").strip().lower()).strip("_")
    if not clean:
        raise ValueError("Ten skill khong hop le.")
    if not clean.startswith("skill_"):
        clean = f"skill_{clean}"
    return clean


def run_pytest_isolated(module_name: str, skill_code: str, test_code: str, timeout_sec: int = 25) -> tuple[bool, str]:
    """Write skill & test into an isolated temporary folder and run pytest with `.venv` Python."""
    with tempfile.TemporaryDirectory(prefix="skill_verify_") as tmp_dir:
        tmp_path = Path(tmp_dir)
        skill_file = tmp_path / f"{module_name}.py"
        test_file = tmp_path / f"test_{module_name}.py"
        skill_file.write_text(skill_code, encoding="utf-8")
        test_file.write_text(test_code, encoding="utf-8")

        env = dict(os.environ)
        existing_py = env.get("PYTHONPATH", "")
        extra_paths = os.pathsep.join([str(tmp_path), str(SKILLS_ROOT), str(SKILLS_ROOT.parent)])
        env["PYTHONPATH"] = f"{extra_paths}{os.pathsep}{existing_py}" if existing_py else extra_paths
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUTF8"] = "1"

        try:
            proc = subprocess.run(
                [sys.executable, "-m", "pytest", str(test_file), "-q", "--tb=short", "--no-header"],
                cwd=str(tmp_path),
                env=env,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout_sec,
            )
            combined = ((proc.stdout or "") + "\n" + (proc.stderr or "")).strip()
            return proc.returncode == 0, combined
        except subprocess.TimeoutExpired:
            return False, f"Pytest timed out after {timeout_sec}s"
        except Exception as exc:
            return False, f"{type(exc).__name__}: {exc}"


def _parse_probe_hint(error_context: str) -> tuple[str, dict[str, Any] | None]:
    """Extract target method name and JSON kwargs from Tab 1 error_context if present."""
    method_name = ""
    kwargs: dict[str, Any] | None = None
    m_tool = re.search(r"Tool\s+v[ừu]a\s+g[ọo]i:\s*([a-zA-Z0-9_]+)", error_context or "")
    if m_tool:
        full_tool = m_tool.group(1)
        if "__" in full_tool:
            method_name = full_tool.split("__", 1)[1]
    m_args = re.search(r"Tham\s+s[ốo]:\s*(\{[^\n]*\})", error_context or "")
    if m_args:
        try:
            parsed = json.loads(m_args.group(1))
            if isinstance(parsed, dict):
                kwargs = parsed
        except Exception:
            kwargs = None
    return method_name, kwargs


def run_live_smoke_probe(
    module_name: str,
    skill_code: str,
    error_context: str = "",
    timeout_sec: int = 20,
) -> tuple[bool, str]:
    """Execute one real isolated live call after mocked pytest passes to catch SPA/404/empty-DOM bugs."""
    target_method, hint_kwargs = _parse_probe_hint(error_context)
    runner_script = f"""
import importlib.util, inspect, json, sys, traceback
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

spec = importlib.util.spec_from_file_location({module_name!r}, "{module_name}.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

target_cls = None
for _, obj in inspect.getmembers(mod, inspect.isclass):
    if obj.__module__ == {module_name!r} and not obj.__name__.startswith("_"):
        target_cls = obj
        break

if target_cls is None:
    print("SKIP: No public class found")
    sys.exit(0)

preferred = {target_method!r}
hint_kwargs = {hint_kwargs!r}
methods = [
    (name, fn)
    for name, fn in inspect.getmembers(target_cls, predicate=inspect.isfunction)
    if not name.startswith("_") and name in target_cls.__dict__
]
chosen = None
for name, fn in methods:
    if preferred and name == preferred:
        chosen = (name, fn)
        break
if chosen is None and methods:
    chosen = methods[0]
if chosen is None:
    print("SKIP: No public method found")
    sys.exit(0)

m_name, m_fn = chosen
sig = inspect.signature(m_fn)
req_params = [
    p.name for p in sig.parameters.values()
    if p.name != "self"
    and p.default is inspect._empty
    and p.kind not in (inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD)
]

call_kwargs = {{}}
if isinstance(hint_kwargs, dict):
    valid_names = set(sig.parameters.keys()) - {{"self"}}
    call_kwargs = {{k: v for k, v in hint_kwargs.items() if k in valid_names}}

missing_req = [p for p in req_params if p not in call_kwargs]
if missing_req:
    print(f"SKIP: Method {{m_name}} requires args {{missing_req}}")
    sys.exit(0)

try:
    inst = target_cls()
    res = getattr(inst, m_name)(**call_kwargs)
except Exception as exc:
    tb = traceback.format_exc()[-900:]
    print(f"FAIL: {{type(exc).__name__}}: {{exc}}\\n{{tb}}")
    sys.exit(2)

is_empty = (
    res is None
    or res == []
    or res == {{}}
    or res == ""
    or (isinstance(res, dict) and not any(res.values()))
)
if is_empty:
    print(f"FAIL: Method {{m_name}}({{call_kwargs}}) returned empty result: {{res!r}}")
    sys.exit(2)

preview = json.dumps(res, ensure_ascii=False, default=str)[:260]
print(f"PASS: {{m_name}}({{call_kwargs}}) -> {{preview}}")
"""
    with tempfile.TemporaryDirectory(prefix="skill_smoke_") as tmp_dir:
        tmp_path = Path(tmp_dir)
        (tmp_path / f"{module_name}.py").write_text(skill_code, encoding="utf-8")
        probe_file = tmp_path / "_smoke_probe.py"
        probe_file.write_text(runner_script, encoding="utf-8")

        env = dict(os.environ)
        existing_py = env.get("PYTHONPATH", "")
        extra_paths = os.pathsep.join([str(tmp_path), str(SKILLS_ROOT), str(SKILLS_ROOT.parent)])
        env["PYTHONPATH"] = f"{extra_paths}{os.pathsep}{existing_py}" if existing_py else extra_paths
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUTF8"] = "1"

        try:
            proc = subprocess.run(
                [sys.executable, str(probe_file)],
                cwd=str(tmp_path),
                env=env,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout_sec,
            )
            combined = ((proc.stdout or "") + "\n" + (proc.stderr or "")).strip()
            return proc.returncode == 0, combined
        except subprocess.TimeoutExpired:
            return False, f"FAIL: Live smoke probe timed out after {timeout_sec}s"
        except Exception as exc:
            return False, f"FAIL: {type(exc).__name__}: {exc}"


class SkillEvolver:
    """Two-role AI engine (Coder + Reviewer/Fixer) with AST validation, pytest, backups, and hot-reload."""

    def __init__(self, client: genai.Client):
        self.client = client
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        VERSIONS_DIR.mkdir(parents=True, exist_ok=True)
        AUTO_PACK_DIR.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _backup_key(pack: str, module_name: str) -> Path:
        return BACKUP_DIR / f"{pack}__{module_name}.json"

    @staticmethod
    def _version_root(pack: str, module_name: str) -> Path:
        return VERSIONS_DIR / pack / module_name

    def _load_manifest(self, pack: str, module_name: str) -> dict[str, Any]:
        mpath = self._version_root(pack, module_name) / "manifest.json"
        if mpath.exists():
            try:
                return json.loads(mpath.read_text(encoding="utf-8"))
            except Exception:
                pass
        return {"pack": pack, "module_name": module_name, "active_version": "", "versions": []}

    def _save_manifest(self, pack: str, module_name: str, manifest: dict[str, Any]) -> None:
        vroot = self._version_root(pack, module_name)
        vroot.mkdir(parents=True, exist_ok=True)
        (vroot / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _write_version_snapshot(
        self,
        pack: str,
        module_name: str,
        version: str,
        skill_code: str,
        test_code: str,
    ) -> None:
        vdir = self._version_root(pack, module_name) / version
        vdir.mkdir(parents=True, exist_ok=True)
        (vdir / f"{module_name}.py").write_text(skill_code.rstrip() + "\n", encoding="utf-8")
        if test_code.strip():
            (vdir / f"test_{module_name}.py").write_text(test_code.rstrip() + "\n", encoding="utf-8")

    def list_versions(self, pack: str, module_name: str) -> list[dict[str, Any]]:
        mod = sanitize_module_name(module_name)
        manifest = self._load_manifest(pack, mod)
        active = manifest.get("active_version", "")
        result: list[dict[str, Any]] = []
        for item in manifest.get("versions", []):
            result.append({**item, "is_active": item.get("version") == active})
        return result

    def get_version_source(self, pack: str, module_name: str, version: str) -> dict[str, Any]:
        mod = sanitize_module_name(module_name)
        vdir = self._version_root(pack, mod) / version
        sfile = vdir / f"{mod}.py"
        tfile = vdir / f"test_{mod}.py"
        if not sfile.exists():
            raise FileNotFoundError(f"Khong tim thay version {version} cua {pack}/{mod}")
        return {
            "pack": pack,
            "module_name": mod,
            "version": version,
            "skill_code": sfile.read_text(encoding="utf-8", errors="replace"),
            "test_code": tfile.read_text(encoding="utf-8", errors="replace") if tfile.exists() else "",
        }

    def commit_new_version(
        self,
        *,
        pack: str,
        module_name: str,
        skill_code: str,
        test_code: str,
        source: str = "ai_evolve",
        model: str = "",
        note: str = "",
    ) -> str:
        """Archive original as v1 if needed, append new sequential vN snapshot, and activate it."""
        mod = sanitize_module_name(module_name)
        pack_dir = SKILLS_ROOT / pack
        pack_dir.mkdir(parents=True, exist_ok=True)
        skill_path = pack_dir / f"{mod}.py"
        test_path = pack_dir / f"test_{mod}.py"

        manifest = self._load_manifest(pack, mod)
        versions: list[dict[str, Any]] = manifest.get("versions", [])
        now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds")

        # Preserve original untouched code as v1 before creating v2
        if not versions and skill_path.exists():
            orig_skill = skill_path.read_text(encoding="utf-8", errors="replace")
            orig_test = test_path.read_text(encoding="utf-8", errors="replace") if test_path.exists() else ""
            self._write_version_snapshot(pack, mod, "v1", orig_skill, orig_test)
            versions.append(
                {
                    "version": "v1",
                    "created_at": now_iso,
                    "source": "original",
                    "model": "",
                    "note": "Original version before first update",
                }
            )

        next_num = len(versions) + 1
        new_ver = f"v{next_num}"
        self._write_version_snapshot(pack, mod, new_ver, skill_code, test_code)
        versions.append(
            {
                "version": new_ver,
                "created_at": now_iso,
                "source": source,
                "model": model,
                "note": (note or "")[:140],
            }
        )

        manifest["versions"] = versions
        manifest["active_version"] = new_ver
        self._save_manifest(pack, mod, manifest)

        # Write active version to live skill path so SkillRegistry loads it
        skill_path.write_text(skill_code.rstrip() + "\n", encoding="utf-8")
        if test_code.strip():
            test_path.write_text(test_code.rstrip() + "\n", encoding="utf-8")
        return new_ver

    def activate_version(self, pack: str, module_name: str, version: str) -> dict[str, Any]:
        """Switch live skill file to any historical version (v1, v2, v3...) without deleting any version."""
        mod = sanitize_module_name(module_name)
        src = self.get_version_source(pack, mod, version)
        pack_dir = SKILLS_ROOT / pack
        pack_dir.mkdir(parents=True, exist_ok=True)
        (pack_dir / f"{mod}.py").write_text(src["skill_code"].rstrip() + "\n", encoding="utf-8")
        if src["test_code"].strip():
            (pack_dir / f"test_{mod}.py").write_text(src["test_code"].rstrip() + "\n", encoding="utf-8")

        manifest = self._load_manifest(pack, mod)
        manifest["active_version"] = version
        self._save_manifest(pack, mod, manifest)
        return {**src, "versions": self.list_versions(pack, mod)}

    def has_backup(self, pack: str, module_name: str) -> bool:
        return self._backup_key(pack, module_name).exists()

    def save_backup(self, pack: str, module_name: str, skill_path: Path, test_path: Path) -> None:
        if not skill_path.exists():
            return
        payload = {
            "pack": pack,
            "module_name": module_name,
            "skill_path": str(skill_path),
            "test_path": str(test_path),
            "skill_code": skill_path.read_text(encoding="utf-8", errors="replace"),
            "test_code": test_path.read_text(encoding="utf-8", errors="replace") if test_path.exists() else "",
            "saved_at": time.time(),
        }
        self._backup_key(pack, module_name).write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def restore_backup(self, pack: str, module_name: str) -> dict[str, Any]:
        bfile = self._backup_key(pack, module_name)
        if not bfile.exists():
            raise FileNotFoundError(f"Khong co ban backup nao cho {pack}/{module_name}")
        data = json.loads(bfile.read_text(encoding="utf-8"))
        Path(data["skill_path"]).write_text(data["skill_code"], encoding="utf-8")
        if data.get("test_code"):
            Path(data["test_path"]).write_text(data["test_code"], encoding="utf-8")
        return data

    def delete_skill(self, pack: str, module_name: str) -> dict[str, Any]:
        """Archive backup then delete skill_<name>.py and test_skill_<name>.py safely inside SKILLS_ROOT."""
        mod = sanitize_module_name(module_name)
        pack_dir = (SKILLS_ROOT / pack).resolve()
        if SKILLS_ROOT.resolve() not in pack_dir.parents:
            raise ValueError("Duong dan pack khong hop le.")
        skill_path = pack_dir / f"{mod}.py"
        test_path = pack_dir / f"test_{mod}.py"
        if not skill_path.exists():
            raise FileNotFoundError(f"Khong tim thay skill: {pack}/{mod}.py")

        self.save_backup(pack, mod, skill_path, test_path)
        deleted_files: list[str] = []
        skill_path.unlink(missing_ok=True)
        deleted_files.append(str(skill_path.name))
        if test_path.exists():
            test_path.unlink(missing_ok=True)
            deleted_files.append(str(test_path.name))
        return {"pack": pack, "module_name": mod, "deleted_files": deleted_files}

    def _call_llm(self, model: str, system_prompt: str, user_prompt: str) -> str:
        resp = run_interruptible(
            lambda: self.client.models.generate_content(
                model=model,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.2,
                ),
            ),
            timeout_sec=float(DEFAULT_API_TIMEOUT_SEC + 15),
        )
        return extract_text(resp, strip=True)

    def evolve_skill(
        self,
        *,
        requirement: str,
        mode: str = "rewrite",  # "rewrite" | "create"
        target_pack: str = "auto_skills",
        module_name: str = "",
        error_context: str = "",
        model: str = DEFAULT_MODEL,
        max_fix_rounds: int = 3,
        auto_save: bool = True,
        live_smoke_test: bool = True,
    ) -> EvolutionResult:
        """Generate or rewrite a skill, verify via AST + pytest (with Fixer retries), and save to disk."""
        logs: list[str] = []
        mod_name = sanitize_module_name(module_name)
        pack = (target_pack or "auto_skills").strip()
        pack_dir = SKILLS_ROOT / pack
        pack_dir.mkdir(parents=True, exist_ok=True)

        skill_path = pack_dir / f"{mod_name}.py"
        test_path = pack_dir / f"test_{mod_name}.py"

        existing_skill = skill_path.read_text(encoding="utf-8", errors="replace") if skill_path.exists() else ""
        existing_test = test_path.read_text(encoding="utf-8", errors="replace") if test_path.exists() else ""

        if mode == "rewrite" and existing_skill:
            logs.append(f"[CONFIG] Mode=REWRITE | target={pack}/{mod_name}.py | model={model}")
            coder_prompt = (
                f"Module can sua / nang cap: `{mod_name}.py`\n\n"
                f"YEU CAU CUA NGUOI DUNG:\n{requirement.strip()}\n\n"
                f"THONG TIN LOI GAP PHAI (neu co):\n{error_context.strip() or '(khong co)'}\n\n"
                f"CODE HIEN TAI CUA `{mod_name}.py`:\n```python\n{existing_skill}\n```\n\n"
                f"TEST HIEN TAI CUA `test_{mod_name}.py`:\n```python\n{existing_test or '# chua co test'}\n```\n\n"
                "Hay viet lai ban day du tot hon, khac phuc triet de van de va kem bo unit test pytest day du."
            )
        else:
            logs.append(f"[CONFIG] Mode=CREATE | target={pack}/{mod_name}.py | model={model}")
            coder_prompt = (
                f"Tao module skill moi ten `{mod_name}.py`.\n\n"
                f"YEU CAU CHUC NANG:\n{requirement.strip()}\n\n"
                "Hay viet day du file skill va file unit test pytest mock HTTP an toan."
            )

        logs.append("[CODER] Generating skill_code and test_code via Gemini...")
        raw_out = self._call_llm(model=model, system_prompt=_CODER_SYSTEM_PROMPT, user_prompt=coder_prompt)
        skill_code = _extract_tagged_block(raw_out, "SKILL_CODE")
        test_code = _extract_tagged_block(raw_out, "TEST_CODE")

        if not skill_code or not test_code:
            logs.append("[ERROR] Coder response missing <SKILL_CODE> or <TEST_CODE> tags.")
            return EvolutionResult(
                ok=False,
                pack=pack,
                module_name=mod_name,
                skill_path=str(skill_path),
                test_path=str(test_path),
                skill_code=skill_code or existing_skill,
                test_code=test_code or existing_test,
                pytest_output="Missing <SKILL_CODE> or <TEST_CODE> in model output.",
                rounds_used=1,
                logs=logs,
                backup_available=self.has_backup(pack, mod_name),
            )

        pytest_out = ""
        max_rounds = max(1, min(int(max_fix_rounds), 4))

        for attempt in range(1, max_rounds + 1):
            ast_errs = validate_skill_ast(skill_code, is_test=False) + validate_skill_ast(test_code, is_test=True)
            if ast_errs:
                failure_report = "AST Validation Errors:\n" + "\n".join(f"- {e}" for e in ast_errs)
                pytest_out = failure_report
                logs.append(f"[ROUND {attempt}] [AST FAIL] {'; '.join(ast_errs)}")
            else:
                dep_logs = ensure_skill_dependencies(skill_code, auto_install=True)
                logs.extend(dep_logs)
                logs.append(f"[ROUND {attempt}] [AST OK] Running isolated pytest...")
                passed, pytest_out = run_pytest_isolated(mod_name, skill_code, test_code)
                if passed:
                    logs.append(f"[ROUND {attempt}] [PYTEST PASS] Unit tests passed.")
                    smoke_ok = True
                    smoke_out = ""
                    if live_smoke_test:
                        logs.append(f"[ROUND {attempt}] [LIVE SMOKE] Running real isolated probe...")
                        smoke_ok, smoke_out = run_live_smoke_probe(
                            mod_name, skill_code, error_context=error_context
                        )
                        if smoke_ok:
                            logs.append(f"[ROUND {attempt}] [LIVE SMOKE OK] {smoke_out.splitlines()[0][:180]}")
                        else:
                            logs.append(f"[ROUND {attempt}] [LIVE SMOKE FAIL] Real call failed -> invoking Fixer...")
                            pytest_out = f"Pytest (mocked): PASSED\n\nLIVE SMOKE PROBE FAILED (goi that bi loi):\n{smoke_out}"
                            failure_report = (
                                "Mocked pytest passed, NHUNG GOI THAT (LIVE SMOKE PROBE) BI LOI:\n"
                                f"{smoke_out}\n"
                                "Hay phan tich nguyen nhan that (URL 404, SPA render bang JS khong co DOM tinh, "
                                "hoac sai cau truc response) va DOI CHIEN LUOC (dung playwright headless hoac API/RSS that)."
                            )

                    if smoke_ok:
                        created_ver = ""
                        if auto_save:
                            if skill_path.exists():
                                self.save_backup(pack, mod_name, skill_path, test_path)
                            created_ver = self.commit_new_version(
                                pack=pack,
                                module_name=mod_name,
                                skill_code=skill_code,
                                test_code=test_code,
                                source="ai_evolve",
                                model=model,
                                note=requirement.strip(),
                            )
                            logs.append(
                                f"[VERSION] Created & activated {pack}/{mod_name} -> {created_ver} "
                                f"(previous versions preserved in data/skill_versions/)"
                            )
                        full_out = pytest_out + (f"\n\n--- LIVE SMOKE PROBE ---\n{smoke_out}" if smoke_out else "")
                        return EvolutionResult(
                            ok=True,
                            pack=pack,
                            module_name=mod_name,
                            skill_path=str(skill_path),
                            test_path=str(test_path),
                            skill_code=skill_code,
                            test_code=test_code,
                            pytest_output=full_out,
                            rounds_used=attempt,
                            logs=logs,
                            backup_available=self.has_backup(pack, mod_name),
                            version=created_ver,
                            versions=self.list_versions(pack, mod_name),
                        )
                else:
                    logs.append(f"[ROUND {attempt}] [PYTEST FAIL] Invoking Fixer role...")
                    failure_report = f"Pytest Failure Output:\n{pytest_out}"

            if attempt < max_rounds:
                fixer_prompt = (
                    f"Module: `{mod_name}.py`\n"
                    f"Yeu cau goc: {requirement.strip()}\n\n"
                    f"LOI CAN SUA:\n{failure_report}\n\n"
                    f"SKILL CODE HIEN TAI:\n```python\n{skill_code}\n```\n\n"
                    f"TEST CODE HIEN TAI:\n```python\n{test_code}\n```\n"
                )
                fix_raw = self._call_llm(model=model, system_prompt=_FIXER_SYSTEM_PROMPT, user_prompt=fixer_prompt)
                next_skill = _extract_tagged_block(fix_raw, "SKILL_CODE")
                next_test = _extract_tagged_block(fix_raw, "TEST_CODE")
                if next_skill:
                    skill_code = next_skill
                if next_test:
                    test_code = next_test

        logs.append("[ERROR] Reached max fix rounds without passing pytest. Original file kept untouched.")
        return EvolutionResult(
            ok=False,
            pack=pack,
            module_name=mod_name,
            skill_path=str(skill_path),
            test_path=str(test_path),
            skill_code=skill_code,
            test_code=test_code,
            pytest_output=pytest_out,
            rounds_used=max_rounds,
            logs=logs,
            backup_available=self.has_backup(pack, mod_name),
        )

    def test_and_save_manual(
        self,
        *,
        pack: str,
        module_name: str,
        skill_code: str,
        test_code: str,
    ) -> EvolutionResult:
        """Validate AST, run pytest on manually edited code, and save if passing."""
        logs: list[str] = []
        mod_name = sanitize_module_name(module_name)
        pack_dir = SKILLS_ROOT / pack
        pack_dir.mkdir(parents=True, exist_ok=True)
        skill_path = pack_dir / f"{mod_name}.py"
        test_path = pack_dir / f"test_{mod_name}.py"

        ast_errs = validate_skill_ast(skill_code, is_test=False)
        if test_code.strip():
            ast_errs += validate_skill_ast(test_code, is_test=True)
        if ast_errs:
            msg = "AST Validation Errors:\n" + "\n".join(f"- {e}" for e in ast_errs)
            logs.append(f"[AST FAIL] {'; '.join(ast_errs)}")
            return EvolutionResult(
                ok=False,
                pack=pack,
                module_name=mod_name,
                skill_path=str(skill_path),
                test_path=str(test_path),
                skill_code=skill_code,
                test_code=test_code,
                pytest_output=msg,
                rounds_used=1,
                logs=logs,
                backup_available=self.has_backup(pack, mod_name),
            )

        dep_logs = ensure_skill_dependencies(skill_code, auto_install=True)
        logs.extend(dep_logs)

        if test_code.strip():
            logs.append("[AST OK] Running isolated pytest...")
            passed, pytest_out = run_pytest_isolated(mod_name, skill_code, test_code)
            if not passed:
                logs.append("[PYTEST FAIL] Did not overwrite skill file.")
                return EvolutionResult(
                    ok=False,
                    pack=pack,
                    module_name=mod_name,
                    skill_path=str(skill_path),
                    test_path=str(test_path),
                    skill_code=skill_code,
                    test_code=test_code,
                    pytest_output=pytest_out,
                    rounds_used=1,
                    logs=logs,
                    backup_available=self.has_backup(pack, mod_name),
                )
            logs.append("[PYTEST PASS] All tests passed.")
        else:
            pytest_out = "No test code provided (AST validation passed)."
            logs.append("[AST OK] No test_code provided; saving skill.")

        if skill_path.exists():
            self.save_backup(pack, mod_name, skill_path, test_path)
        created_ver = self.commit_new_version(
            pack=pack,
            module_name=mod_name,
            skill_code=skill_code,
            test_code=test_code,
            source="manual_edit",
            model="",
            note="Manual save & pytest pass",
        )
        logs.append(f"[VERSION] Created & activated {pack}/{mod_name} -> {created_ver}")

        return EvolutionResult(
            ok=True,
            pack=pack,
            module_name=mod_name,
            skill_path=str(skill_path),
            test_path=str(test_path),
            skill_code=skill_code,
            test_code=test_code,
            pytest_output=pytest_out,
            rounds_used=1,
            logs=logs,
            backup_available=self.has_backup(pack, mod_name),
            version=created_ver,
            versions=self.list_versions(pack, mod_name),
        )
