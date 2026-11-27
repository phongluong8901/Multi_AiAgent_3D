"""Automated 4-Layer Audit Suite for all 182+ skills across all 5 packs."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] if (Path(__file__).resolve().parent.name == "scripts") else Path(r"d:\A_Self_Proj\learn_mlflow\proj11_AI_use_Skills")
sys.path.insert(0, str(ROOT))
os.environ["PYTHONIOENCODING"] = "utf-8"

from agent_runtime.skill_registry import SkillRegistry
from agent_runtime.skill_router import SkillRouter


def audit_layer1_registry() -> tuple[SkillRegistry, list[str]]:
    r = SkillRegistry()
    issues: list[str] = []
    for e in r.entries:
        decl = e.declaration
        if not decl.name:
            issues.append(f"[SCHEMA] Empty tool name in {e.pack}/{e.module_name}")
        params = getattr(decl, "parameters", None)
        props = getattr(params, "properties", None) if params else None
        if e.name.endswith("__execute") and (not isinstance(props, dict) or "action" not in props):
            issues.append(f"[SCHEMA] Missing 'action' param in {e.pack}/{e.module_name} ({e.name})")
        # Check UTF-8 subprocess safety
        p = ROOT / "skills" / e.pack / f"{e.module_name}.py"
        if p.exists():
            txt = p.read_text(encoding="utf-8", errors="replace")
            if "subprocess.run(" in txt and "text=True" in txt and "encoding=" not in txt:
                issues.append(f"[UTF8] subprocess.run(text=True) missing encoding in {e.pack}/{e.module_name}.py")
    return r, issues


def audit_layer2_pytest() -> dict[str, dict]:
    packs = ["auto_skills", "automationPc_skills", "automationWeb_skills", "new_skills", "search_skills"]
    results = {}
    pytest_exe = str(ROOT / ".venv" / "Scripts" / "pytest.exe")
    for pack in packs:
        pack_dir = ROOT / "skills" / pack
        if not pack_dir.exists():
            continue
        t0 = time.perf_counter()
        proc = subprocess.run(
            [pytest_exe, str(pack_dir), "-q", "--tb=short"],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=90,
        )
        elapsed = round(time.perf_counter() - t0, 2)
        summary_line = ""
        failed_tests = []
        for line in (proc.stdout + "\n" + proc.stderr).splitlines():
            s = line.strip()
            if s.startswith("FAILED "):
                failed_tests.append(s)
            if "passed" in s or "failed" in s or "error" in s:
                if any(tok in s for tok in (" passed", " failed", " error", " skipped")):
                    summary_line = s
        results[pack] = {
            "returncode": proc.returncode,
            "elapsed_sec": elapsed,
            "summary": summary_line,
            "failed_tests": failed_tests,
        }
    return results


def audit_layer3_safe_smoke(r: SkillRegistry) -> list[str]:
    """Invoke safe read-only/dry-run tools to catch TypeError/NameError/AttributeError/ImportError."""
    unsafe_keywords = (
        "delete", "remove", "kill", "stop", "shutdown", "restart", "format", "send", "click",
        "move", "copy", "write", "create", "launch", "open", "play", "type", "press", "draw",
        "install", "uninstall", "clean", "purge", "set_", "modify", "patch", "export", "login",
        "upload", "download", "capture", "screenshot", "snap", "minimize", "maximize", "focus",
        "record", "mute", "volume", "brightness", "notify", "schedule", "run_", "exec", "start",
        "browser", "chrome", "zalo", "gmail", "telegram", "outlook", "youtube", "zingmp3",
    )
    crashes: list[str] = []
    tested = 0
    for e in r.entries:
        lname = e.name.lower()
        if any(k in lname for k in unsafe_keywords):
            continue
        params = getattr(e.declaration, "parameters", None)
        props = getattr(params, "properties", None) if params else {}
        req = list(getattr(params, "required", None) or [])
        # Only auto-invoke tools with 0 required args OR only 'action' required with a safe read-only action
        call_args = {}
        if req == ["action"] and isinstance(props, dict) and "action" in props:
            enums = list(getattr(props["action"], "enum", None) or [])
            safe_act = next((a for a in enums if any(a.startswith(p) for p in ("list_", "get_", "check_", "schema", "status", "info", "detect_", "parse_"))), None)
            if not safe_act:
                continue
            call_args = {"action": safe_act}
        elif req:
            continue

        tested += 1
        try:
            res = e.handler(**call_args)
            if isinstance(res, dict) and not res.get("ok"):
                err = str(res.get("error") or "")
                if any(bt in err for bt in ("TypeError", "NameError", "AttributeError", "SyntaxError", "UnboundLocalError")):
                    crashes.append(f"[CRASH] {e.name}({call_args}) -> {err[:160]}")
        except Exception as exc:
            crashes.append(f"[EXC] {e.name}({call_args}) -> {type(exc).__name__}: {exc}")
    print(f"[SMOKE] Tested {tested} safe zero-arg/read-only tools -> {len(crashes)} code crashes")
    return crashes


def audit_layer4_router_benchmark(r: SkillRegistry) -> list[str]:
    rt = SkillRouter(r.declarations)
    cases = [
        ("giá bitcoin hôm nay", "binance_crypto_client__get_crypto_price"),
        ("đổi 100 usd sang vnd", "frankfurter_forex_client__get_exchange_rate"),
        ("thời tiết hà nội hôm nay", "open_meteo_weather_client__get_current_weather"),
        ("tính 15% của 4500000", "calculator__evaluate"),
        ("bây giờ là mấy giờ ở tokyo", "datetime_client__get_current_time"),
        ("mở gmail và đọc tóm tắt tin mới nhất", "browser_cdp_controller__execute"),
        ("tạo file google sheet tên test_llm", "google_workspace_web__execute"),
        ("check zalo xem có thông báo mới k", "zalo_read_notifications__get_unread_notifications"),
        ("gửi tin nhắn zalo cho nhóm dev", "zalo_desktop__execute"),
        ("stop các container docker đang chạy", "docker_local_manager__execute"),
        ("mở bài nhạc đang hot nhất trên zingchart", "zingmp3_crawler__get_zing_chart"),
        ("vẽ biểu đồ dung lượng ổ C", "chart_visualizer__"),
        ("di chuyển chuột hình tròn 10 lần", "mouse_controller__draw_circle"),
        ("tìm bài báo arxiv mới nhất về llm agent", "arxiv_api_client__search_papers"),
        ("kiểm tra thông tin thư viện fastapi trên pypi", "pypi_api_client__get_package_info"),
        ("xem kết quả xổ số miền bắc hôm nay", "xskt_scraper__"),
        ("kiểm tra seo và broken link trang web", "web_link_seo_auditor__execute"),
        ("bắt request xhr api trên chrome", "chrome_network_sniffer__execute"),
        ("đọc mail gmail qua imap", "gmail_imap_smtp__execute"),
        ("đọc 5 mail gmail, sau đó tạo google sheet bao_cao, rồi gửi zalo", "zalo_desktop__execute"),
    ]
    misses: list[str] = []
    for prompt, expected_prefix in cases:
        routed = [d.name for d in rt.route(prompt, top_k=6)]
        if not any(name.startswith(expected_prefix) for name in routed):
            misses.append(f"[ROUTE MISS] '{prompt}' expected '{expected_prefix}*', got {routed}")
    print(f"[ROUTER] {len(cases) - len(misses)}/{len(cases)} benchmark prompts hit expected tool in Top-6")
    return misses


if __name__ == "__main__":
    print("=== LAYER 1: REGISTRY & STATIC CONTRACT AUDIT ===")
    reg, l1_issues = audit_layer1_registry()
    print(f"Loaded {len(reg.entries)} tools across {reg.loaded_packs} | issues={len(l1_issues)}")
    for i in l1_issues:
        print(" ", i)

    print("\n=== LAYER 2: FULL PYTEST ACROSS ALL 5 PACKS ===")
    l2 = audit_layer2_pytest()
    for pack, info in l2.items():
        status = "PASS" if info["returncode"] == 0 else "FAIL"
        print(f"  [{status}] {pack:22} ({info['elapsed_sec']}s): {info['summary']}")
        for ft in info["failed_tests"][:10]:
            print(f"      -> {ft}")

    print("\n=== LAYER 3: SAFE READ-ONLY SMOKE CALLS ===")
    l3_crashes = audit_layer3_safe_smoke(reg)
    for c in l3_crashes:
        print(" ", c)

    print("\n=== LAYER 4: 20-PROMPT ROUTER BENCHMARK ===")
    l4_misses = audit_layer4_router_benchmark(reg)
    for m in l4_misses:
        print(" ", m)
