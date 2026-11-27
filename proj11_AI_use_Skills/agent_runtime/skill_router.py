"""Zero-Config Hybrid Skill Router (Auto-BM25 + SQLite Vector Embeddings + Adaptive Telemetry + Playbooks)."""
from __future__ import annotations

import hashlib
import math
import os
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass
from typing import Any, Sequence

from google.genai import types

DISCOVER_TOOLS_NAME = "discover_tools"
DISCOVER_TOOLS_DECLARATION = types.FunctionDeclaration(
    name=DISCOVER_TOOLS_NAME,
    description=(
        "Mo khoa them tool phu hop tu kho 160+ tools ngay trong luot dang chay khi danh sach tool hien tai chua co tool can thiet."
    ),
    parameters=types.Schema(
        type=types.Type.OBJECT,
        properties={
            "query": types.Schema(
                type=types.Type.STRING,
                description="Mo ta ngan chuc nang tool can tim (vi du: 'gui tin nhan zalo', 've bieu do', 'doc pdf', 'docker').",
            ),
            "top_k": types.Schema(
                type=types.Type.INTEGER,
                description="So luong tool can mo khoa them (mac dinh: 2).",
            ),
        },
        required=["query"],
    ),
)

RUN_PIPELINE_NAME = "run_tool_pipeline"
RUN_PIPELINE_DECLARATION = types.FunctionDeclaration(
    name=RUN_PIPELINE_NAME,
    description=(
        "Chay 1 chuoi nhieu buoc tool (2-5 buoc) tuan tu ngay trong 1 luot de giam so vong goi LLM. "
        "Ket qua buoc truoc luu vao $mem_1, $mem_2... co the truyen thang vao tham so buoc sau."
    ),
    parameters=types.Schema(
        type=types.Type.OBJECT,
        properties={
            "steps": types.Schema(
                type=types.Type.ARRAY,
                items=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "tool": types.Schema(type=types.Type.STRING, description="Ten tool can goi."),
                        "args_json": types.Schema(type=types.Type.STRING, description="Chuoi JSON tham so (co the dung '$mem_1')."),
                        "save_as": types.Schema(type=types.Type.STRING, description="Ten bien Working Memory tuy chon (vd: '$mem_emails')."),
                    },
                    required=["tool"],
                ),
                description="Danh sach 2-5 buoc tool can thuc thi lien tiep.",
            ),
        },
        required=["steps"],
    ),
)

# Domain keyword expansion (normalized ASCII Vietnamese + English -> skill prefix)
_DOMAIN_HINTS: dict[str, tuple[str, ...]] = {
    "datetime_client": (
        "gio", "may gio", "ngay", "hom nay", "thu may", "mui gio", "timezone",
        "clock", "time", "date", "utc", "gmt", "lich", "weekday",
    ),
    "calculator": (
        "tinh", "tinh toan", "cong", "tru", "nhan", "chia", "phan tram", "lai suat",
        "tang truong", "bieu thuc", "math", "calc", "calculate", "percent", "sqrt", "doi ra",
    ),
    "binance_crypto_client": (
        "btc", "eth", "sol", "bnb", "usdt", "crypto", "bitcoin", "ethereum",
        "coin", "binance", "tien ao", "tien dien tu",
    ),
    "frankfurter_forex_client": (
        "ty gia", "ti gia", "ngoai te", "usd", "vnd", "eur", "jpy", "gbp",
        "forex", "exchange", "currency", "doi tien", "do la",
    ),
    "open_meteo_weather_client": (
        "thoi tiet", "nhiet do", "mua", "nang", "do am", "weather",
        "temperature", "forecast", "khi hau",
    ),
    "weather_api_client": (
        "thoi tiet", "nhiet do", "weather", "latitude", "longitude", "vi do", "kinh do",
    ),
    "openstreetmap_api_client": (
        "toa do", "ban do", "dia chi", "vi tri", "map", "coordinates", "geocode",
        "latitude", "longitude", "kinh do", "vi do",
    ),
    "ip_geolocation_client": (
        "ip", "dia chi ip", "geolocation", "vi tri ip", "isp", "may chu",
    ),
    "arxiv_api_client": (
        "arxiv", "bai bao", "paper", "nghien cuu", "research", "preprint", "khoa hoc",
    ),
    "github_api_client": (
        "github", "repo", "repository", "ma nguon", "open source", "star", "git",
    ),
    "huggingface_api_client": (
        "huggingface", "hf", "model", "llm", "weights", "checkpoint", "dataset",
    ),
    "pypi_api_client": (
        "pypi", "pip", "package", "thu vien python", "python package", "version",
    ),
    "hacker_news_api_client": (
        "hacker news", "hackernews", "hn", "top stories", "tin cong nghe",
    ),
    "rss_feed_reader": (
        "rss", "feed", "tin moi", "bai viet moi",
    ),
    "wikipedia_api_client": (
        "wikipedia", "wiki", "tieu su", "tra wiki",
    ),
    "document_analyzer": (
        "pdf", "excel", "xlsx", "xls", "csv", "bang du lieu", "tai lieu",
        "trang dau", "doc file", "phan tich bang", "tabular", "dataframe",
    ),
    "report_exporter": (
        "xuat", "export", "luu file", "tao file", "bao cao", "report",
        "xlsx", "excel", "csv", "json", "markdown", ".md",
    ),
    "local_workspace": (
        "thu muc", "workspace", "local", "file trong du an", "outputs",
        "danh sach file", "doc file local", "list files", "project",
    ),
    "user_memory": (
        "ghi nho", "nho giup", "luu thong tin", "so thich", "thong tin ca nhan",
        "mac dinh", "quen di", "xoa ghi nho", "remember", "recall", "forget", "memory", "profile",
    ),
    "provider_model_checker": (
        "groq", "cloudflare", "gemini", "danh sach model", "list models", "check model",
        "kiem tra model", "9router", "provider", "api model",
    ),
    "browser_cdp_controller": (
        "chrome", "edge", "cdp", "tab trinh duyet", "9222", "active tab", "list tabs", "debug port",
        "gmail", "doc gmail", "mo gmail", "hop thu", "inbox", "doc mail", "email", "mail moi nhat",
        "dang nhap", "login", "tai khoan web", "auto login",
    ),
    "gmail_imap_smtp": (
        "gmail", "imap", "smtp", "hop thu", "inbox", "doc mail", "email", "mail moi nhat", "gui email", "gui mail",
    ),
    "clipboard_manager": (
        "clipboard", "bo nho tam", "copy", "paste", "dan", "lich su copy", "pyperclip",
    ),
    "office_com_excel": (
        "excel", "xlsx", "sheet", "bang tinh", "com excel", "read_sheet", "write_rows", "live excel",
    ),
    "pc_safety_guard": (
        "kiem tra lenh", "an toan", "powershell", "system32", "safety", "risk", "evaluate_command",
    ),
    "smart_file_ops": (
        "tim file", "sap xep thu muc", "doi ten hang loat", "batch rename", "organize", "glob", "file ops",
        "mo file", "file doanh thu", "desktop", "o desktop", "tren desktop", "tren may", "o dia",
    ),
    "win_registry_startup": (
        "startup", "khoi dong cung windows", "registry", "hkcu", "bien moi truong", "env vars", "winreg",
    ),
    "zalo_desktop": (
        "zalo", "chat zalo", "nhan tin", "gui tin nhan", "nhan zalo", "mo zalo",
    ),
    "chart_visualizer": (
        "bieu do", "do thi", "chart", "plot", "graph", "ve bieu do", "ve do thi", "ve chart", "truc quan", "matplotlib",
        "dashboard", "ve dashboard", "ve dashboad",
    ),
    "chrome_profile_launcher": (
        "chrome profile", "mo chrome debug", "cdp 9222", "remote debugging", "ho so chrome",
    ),
    "chrome_tab_workspace": (
        "quan ly tab", "dong tab", "chuyen tab", "tab chrome", "nhom tab",
    ),
    "chrome_page_pdf_capture": (
        "in pdf trang web", "chup toan trang", "full page screenshot", "luu trang pdf",
    ),
    "chrome_form_autofiller": (
        "dien form", "autofill", "tu dong dien", "dien bieu mau",
    ),
    "web_table_list_scraper": (
        "cao bang", "scrape table", "lay bang web", "trich xuat bang",
    ),
    "ecommerce_price_tracker": (
        "theo doi gia", "shopee", "lazada", "tiki", "gia san pham", "price tracker",
    ),
    "google_workspace_web": (
        "google docs", "google doc", "google sheets", "google sheet", "gg sheet", "google drive",
        "tao google sheet", "tao file google sheet", "tao google doc", "google calendar", "gmail web",
    ),
    "telegram_web_automator": (
        "telegram web", "nhan telegram web", "mo telegram web",
    ),
    "zalo_web_automator": (
        "zalo web", "chat.zalo.me",
    ),
    "web_page_change_monitor": (
        "theo doi thay doi trang", "monitor web", "kiem tra thay doi",
    ),
    "web_workflow_runner": (
        "quy trinh web", "web workflow", "kịch ban web", "kich ban web",
    ),
    "chrome_cookie_storage_ops": (
        "cookie", "cookies", "localstorage", "sessionstorage", "xoa cookie", "export cookie", "luu phien web",
    ),
    "chrome_frame_shadow_piercer": (
        "iframe", "shadow dom", "shadow root", "xuyen iframe", "nested frame",
    ),
    "chrome_hitl_captcha_guard": (
        "captcha", "cloudflare", "2fa", "otp", "xac minh nguoi dung", "hitl", "verify human",
    ),
    "chrome_network_sniffer": (
        "network sniffer", "bat request", "xhr", "fetch api", "har", "bat api web", "inspect network",
    ),
    "chrome_selector_calibrator": (
        "selector", "css selector", "xpath", "hieu chinh selector", "self healing selector", "dom selector",
    ),
    "chrome_som_a11y_observer": (
        "accessibility tree", "a11y", "set of mark", "som", "quan sat giao dien web", "interactive elements",
    ),
    "web_link_seo_auditor": (
        "seo", "broken link", "kiem tra link hong", "audit seo", "meta tag", "open graph", "canonical",
    ),
    "web_pagination_scroller": (
        "infinite scroll", "cuon trang", "phan trang", "pagination", "load more", "tu dong cuon",
    ),
    "youtube_web_controller": (
        "youtube", "video youtube", "phu de youtube", "transcript youtube", "phat nhac youtube", "dieu khien youtube",
    ),
    "browser_reader": (
        "trinh duyet", "playwright", "dynamic", "javascript", "spa", "css selector", "scrape", "render",
    ),
    "network_inspector": (
        "http", "header", "status code", "redirect", "kiem tra url", "inspect", "ssl", "dns",
    ),
    "web_reader": (
        "doc trang", "doc link", "doc url", "noi dung trang", "read url", "http://", "https://",
    ),
    "mouse_controller": (
        "chuot", "mouse", "con tro", "di chuyen chuot", "chi chuyen chuot",
        "hinh tron", "circle", "zigzag", "zic zac", "click", "toa do chuot",
    ),
    "linux_systemd_manager": (
        "systemd", "systemctl", "unit file", ".service", "failed units", "dich vu linux",
    ),
    "linux_nginx_proxy_helper": (
        "nginx", "reverse proxy", "proxy_pass", "sites-available", "tls expiry", "chung chi ssl",
    ),
    "linux_firewall_ufw_guard": (
        "ufw", "tuong lua linux", "allow port", "deny port", "exposed ports",
    ),
    "linux_cron_timer_scheduler": (
        "crontab", "cronjob", "bieu thuc cron", "cron expression", "systemd timer",
    ),
    "linux_journald_log_analyzer": (
        "journalctl", "journald", "oom killer", "log systemd", "log linux",
    ),
    "linux_package_update_ops": (
        "apt", "apt-get", "autoremove", "upgradable", "cap nhat goi linux",
    ),
    "linux_ssh_auth_audit": (
        "sshd", "sshd_config", "auth.log", "authorized_keys", "brute force ssh",
    ),
    "linux_vpn_tunnel_monitor": (
        "tailscale", "wireguard", "tailscaled", "vpn tunnel",
    ),
    "linux_file_perm_sync": (
        "chmod", "chown", "rsync", "quyen 777", "world writable",
    ),
    "linux_env_secret_vault_ops": (
        ".env", "mask secret", "quyen 600", "upsert env", "audit env",
    ),
    "linux_backup_snapshot_ops": (
        "tar.gz", "retention policy", "backup tar", "verify sha256",
    ),
    "linux_hardware_bus_inspector": (
        "lsusb", "ttyusb", "ttyacm", "i2c", "spi", "gpio",
    ),
    "linux_thermal_power": (
        "thermal zone", "orange pi", "cpufreq", "nhiet do soc",
    ),
    "linux_disk_io_smart": (
        "lsblk", "/var/log", "df output", "log bloat",
    ),
    "linux_network_socket_audit": (
        "ss -tulnp", "listening ports linux",
    ),
    "linux_process_cgroups_guard": (
        "ps aux", "lsof", "sigterm", "kill pid linux",
    ),
    "web_search": (
        "tim kiem", "tim thong tin", "search", "google", "moi nhat", "tin tuc", "web", "link nguon",
    ),
}

# Tier bonus applied ONLY when a skill has positive relevance to the query (Specialized First, Web Search Last)
_TIER_BONUS: dict[str, float] = {
    # Tier 1: Deterministic / Local / PC Automation (~0-50ms)
    "calculator": 2.4,
    "datetime_client": 2.4,
    "user_memory": 2.4,
    "local_workspace": 2.2,
    "report_exporter": 2.2,
    "document_analyzer": 2.2,
    "pc_safety_guard": 2.2,
    "smart_file_ops": 2.2,
    "clipboard_manager": 2.2,
    "office_com_excel": 2.0,
    "win_registry_startup": 2.2,
    "zalo_desktop": 2.4,
    "zalo_web_automator": 1.6,
    "chart_visualizer": 2.4,
    "mouse_controller": 2.4,
    "browser_cdp_controller": 2.6,
    "gmail_imap_smtp": 1.2,
    "chrome_profile_launcher": 2.0,
    "chrome_tab_workspace": 2.0,
    "chrome_page_pdf_capture": 1.9,
    "chrome_form_autofiller": 1.9,
    "web_table_list_scraper": 1.9,
    "ecommerce_price_tracker": 1.9,
    "google_workspace_web": 2.5,
    "telegram_web_automator": 1.8,
    "web_page_change_monitor": 1.8,
    "web_workflow_runner": 1.8,
    "chrome_cookie_storage_ops": 1.9,
    "chrome_frame_shadow_piercer": 1.8,
    "chrome_hitl_captcha_guard": 1.9,
    "chrome_network_sniffer": 1.9,
    "chrome_selector_calibrator": 1.8,
    "chrome_som_a11y_observer": 1.9,
    "web_link_seo_auditor": 1.9,
    "web_pagination_scroller": 1.8,
    "youtube_web_controller": 2.0,
    # Linux / WSL / Server DevOps Automation (boosted when Linux context is active)
    "linux_systemd_manager": 2.1,
    "linux_nginx_proxy_helper": 2.1,
    "linux_firewall_ufw_guard": 2.1,
    "linux_cron_timer_scheduler": 2.1,
    "linux_journald_log_analyzer": 2.1,
    "linux_package_update_ops": 2.0,
    "linux_ssh_auth_audit": 2.1,
    "linux_vpn_tunnel_monitor": 2.0,
    "linux_file_perm_sync": 2.0,
    "linux_env_secret_vault_ops": 2.0,
    "linux_backup_snapshot_ops": 2.0,
    "linux_hardware_bus_inspector": 2.0,
    "linux_thermal_power": 2.0,
    "linux_disk_io_smart": 2.0,
    "linux_network_socket_audit": 2.0,
    "linux_process_cgroups_guard": 2.0,
    "linux_sys_health": 2.0,
    "linux_remote_worker_ctl": 1.9,
    "linux_service_self_healer": 1.9,
    "linux_alert_webhook_dispatch": 1.9,
    "linux_incident_report_builder": 1.9,
    "linux_worker_telemetry_bus": 1.9,
    # Tier 2: Fast Structured Domain APIs (~200-1200ms)
    "binance_crypto_client": 1.8,
    "frankfurter_forex_client": 1.8,
    "open_meteo_weather_client": 1.8,
    "openstreetmap_api_client": 1.6,
    "ip_geolocation_client": 1.6,
    "arxiv_api_client": 1.7,
    "pypi_api_client": 1.7,
    "github_api_client": 1.7,
    "huggingface_api_client": 1.6,
    "wikipedia_api_client": 1.5,
    "hacker_news_api_client": 1.5,
    "rss_feed_reader": 1.3,
    "provider_model_checker": 1.7,
    "network_inspector": 1.4,
    # Secondary structured weather tool ranked slightly below open_meteo, ready as backup!
    "weather_api_client": 0.9,
    # Tier 3: Heavy Web Search / Browser Scraping (Last resort)
    "web_reader": 0.4,
    "web_search": 0.2,
    "browser_reader": 0.0,
}

# Explicit Fail-to-Backup escalation chains: if key fails, unlock value(s) immediately in next step!
_FALLBACK_CHAINS: dict[str, tuple[str, ...]] = {
    "open_meteo_weather_client__get_current_weather": (
        "weather_api_client__get_current_weather",
        "web_search__search",
    ),
    "weather_api_client__get_current_weather": (
        "open_meteo_weather_client__get_current_weather",
        "web_search__search",
    ),
    "web_reader__read_url": (
        "browser_reader__read_dynamic_page",
        "web_search__search",
    ),
    "browser_reader__read_dynamic_page": (
        "web_reader__read_url",
        "web_search__search",
    ),
    "frankfurter_forex_client__get_exchange_rate": ("web_search__search",),
    "binance_crypto_client__get_crypto_price": ("web_search__search",),
    "arxiv_api_client__search_papers": ("web_search__search",),
    "github_api_client__search_repositories": ("web_search__search",),
    "pypi_api_client__get_package_info": ("web_search__search",),
    "wikipedia_api_client__get_summary": ("web_search__search",),
    "hacker_news_api_client__get_top_stories": ("rss_feed_reader__get_latest_articles", "web_search__search"),
    "rss_feed_reader__get_latest_articles": ("web_search__search",),
    "openstreetmap_api_client__get_coordinates": ("weather_api_client__get_latitude", "web_search__search"),
    "office_com_excel__execute": ("document_analyzer__analyze_tabular", "report_exporter__export_xlsx"),
    "local_workspace__list_files": ("smart_file_ops__execute",),
    "gmail_imap_smtp__execute": ("browser_cdp_controller__execute",),
    "browser_cdp_controller__execute": ("gmail_imap_smtp__execute",),
    "web_search__search": ("browser_cdp_controller__execute", "web_reader__read_url"),
    "zalo_desktop__execute": ("screen_capture_annotator__execute", "zalo_read_notifications__get_unread_notifications"),
    "uia_tree_inspector__execute": ("screen_capture_annotator__execute",),
    "app_window_manager__execute": ("screen_capture_annotator__execute",),
    "office_com_excel__execute": ("document_analyzer__analyze_tabular", "report_exporter__export_xlsx", "screen_capture_annotator__execute"),
}

_ALWAYS_INCLUDE_FALLBACKS = (
    "web_search__search",
    "datetime_client__get_current_time",
    "calculator__evaluate",
)

_NO_TOOL_PREFIXES = (
    "xin chao", "chao ban", "chao ", "hello", "hi ", "hey ", "cam on", "thanks", "thank you",
    "dich sang", "dich cau", "translate", "viet email", "viet doan van", "giai thich",
    "so sanh ", "khac nhau giua", "la gi", "tai sao ", "ban la ai", "tom tat doan",
)

_FORCE_TOOL_SIGNALS = (
    "hom nay", "ngay mai", "hien tai", "moi nhat", "bay gio", "may gio", "thu may",
    "http://", "https://", ".pdf", ".xlsx", ".csv", ".py", "outputs",
    "gia ", "ty gia", "ti gia", "thoi tiet", "nhiet do", "toa do", "bitcoin", "btc", "eth", "usd", "vnd",
    "clipboard", "startup", "registry", "chrome", "excel", "thu muc", "tim file", "doi ten", "powershell",
    "xuat file", "luu file", "tao file", "ghi nho", "nho giup", "quen di",
    "arxiv", "github", "pypi", "huggingface", "hacker news", "wikipedia", "ip ",
    "tinh ", "phan tram", "bao nhieu", "kiem tra", "tra cuu", "tim kiem", "search",
    "bieu do", "do thi", "chart", "ve bieu do", "ve do thi", "ve chart", "chup man hinh", "zalo", "docker", "thung rac",
    "chuot", "mouse", "click", "ban phim", "keyboard", "di chuyen", "chi chuyen", "hinh tron", "zigzag", "zic zac",
    "con tro", "keo tha", "mo app", "mo ung dung", "dong app", "tat app", "gui tin nhan",
    "gmail", "email", "hop thu", "inbox", "doc mail", "gui mail",
    "google sheet", "google sheets", "gg sheet", "google doc", "google docs",
    "dashboard", "dashboad", "desktop", "mo file", "doc file", "file doanh thu",
    "linux", "ubuntu", "wsl", "systemd", "systemctl", "journalctl", "ufw", "nginx",
    "crontab", "chmod", "chown", "rsync", "sshd", "auth.log", "tailscale", "wireguard", "lsblk", "lsusb",
)

# Explicit Linux/Server/DevOps signals used by OS-Affinity Guard so `linux_*` skills never crowd out
# native Windows `automationPc_skills` on generic queries when running on a Windows host.
_LINUX_CONTEXT_SIGNALS = (
    "linux", "ubuntu", "debian", "centos", "fedora", "alpine", "wsl",
    "systemd", "systemctl", "journald", "journalctl", "ufw", "iptables",
    "nginx", "reverse proxy", "crontab", "cronjob", "cron ", "cgroup", "apt ", "apt-get",
    "chmod", "chown", "rsync", "lsblk", "lsusb", "ttyusb", "ttyacm",
    "i2c", "spi", "gpio", "sshd", "authorized_keys", "auth.log",
    "tailscale", "wireguard", "orange pi", "raspberry", "tar.gz", ".env",
    "/etc/", "/var/", "/proc/", "/sys/", "/dev/", "ss -", "lsof", "ps aux",
)


def normalize_text(text: str) -> str:
    """Lowercase and strip Vietnamese diacritics for robust ASCII keyword matching."""
    text = (text or "").replace("đ", "d").replace("Đ", "D")
    nfkd = unicodedata.normalize("NFKD", text)
    ascii_str = "".join(ch for ch in nfkd if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", ascii_str.lower()).strip()


def _tokenize(normalized: str) -> set[str]:
    return set(re.findall(r"[a-z0-9_]+", normalized))


def compute_adaptive_telemetry_bonus(metric: dict[str, Any] | None) -> float:
    """Compute Bayesian-smoothed telemetry score so reliable fast tools lead, while failing tools step aside."""
    if not metric:
        # Optimistic neutral prior (~0.75 * 1.2 = +0.9) so unexplored tools are never starved
        return 0.9

    calls = int(metric.get("calls") or 0)
    succ = int(metric.get("successes") or 0)
    avg_ms = float(metric.get("avg_ms") or 500.0)
    consec_fail = int(metric.get("consecutive_failures") or 0)

    # Laplace/Bayesian smoothed reliability in [0.0, 1.0]
    reliability = (succ + 3.0) / (calls + 4.0)
    bonus = reliability * 1.2

    # Speed bonus
    if avg_ms <= 400:
        bonus += 0.5
    elif avg_ms <= 1500:
        bonus += 0.25

    # Consecutive failure penalty lets lower-rated backup tools automatically overtake a broken primary tool!
    if consec_fail > 0:
        bonus -= 1.4 * min(consec_fail, 3)

    return round(bonus, 3)


_STOP_WORDS = frozenset(
    {
        "the", "and", "for", "with", "from", "that", "this", "into", "using", "return", "dict",
        "str", "int", "float", "bool", "list", "true", "false", "default", "execute", "action",
        "skill", "client", "api", "get", "set", "run", "data", "info", "none", "optional",
        "cua", "cho", "voi", "cac", "nhung", "mot", "trong", "khi", "nao", "nhu", "the", "la",
        "ban", "toi", "minh", "giup", "hay", "xem", "nay", "kia", "day", "roi", "nhe", "nha",
    }
)


def _cosine_similarity(v1: Sequence[float], v2: Sequence[float]) -> float:
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    n1 = math.sqrt(sum(a * a for a in v1))
    n2 = math.sqrt(sum(b * b for b in v2))
    if n1 == 0.0 or n2 == 0.0:
        return 0.0
    return dot / (n1 * n2)


def _collect_schema_terms(schema: types.Schema | None) -> list[str]:
    """Recursively extract parameter names, descriptions, and enum actions for zero-config indexing."""
    if schema is None:
        return []
    terms: list[str] = []
    if schema.description:
        terms.append(schema.description)
    if schema.enum:
        terms.extend(str(e).replace("_", " ") for e in schema.enum)
    for k, v in (schema.properties or {}).items():
        terms.append(str(k).replace("_", " "))
        terms.extend(_collect_schema_terms(v))
    if schema.items:
        terms.extend(_collect_schema_terms(schema.items))
    return terms


@dataclass(frozen=True)
class _IndexedTool:
    declaration: types.FunctionDeclaration
    name: str
    skill_prefix: str
    doc_text: str
    doc_hash: str
    tf: Counter[str]
    doc_len: int
    meta_tokens: frozenset[str]
    hints: tuple[str, ...]
    tier_bonus: float


class SkillRouter:
    """Zero-Config Hybrid Router: Auto-BM25 + SQLite Embeddings + Specialized Tiers + Adaptive Telemetry."""

    def __init__(self, declarations: Sequence[types.FunctionDeclaration]):
        self._all: list[types.FunctionDeclaration] = list(declarations)
        self._by_name: dict[str, types.FunctionDeclaration] = {
            d.name: d for d in self._all if d.name
        }
        self._indexed: list[_IndexedTool] = []
        self._idf: dict[str, float] = {}
        self._avg_doc_len: float = 1.0
        self._embeddings: dict[str, list[float]] = {}
        self._embed_client: Any = None
        self._embed_model: str = "gemini-embedding-001"

        df: Counter[str] = Counter()
        total_len = 0

        for decl in self._all:
            name = decl.name or ""
            skill_prefix = name.split("__", 1)[0]
            schema_terms = " ".join(_collect_schema_terms(decl.parameters))
            # Repeat name tokens twice so exact tool/method names carry strong BM25 weight
            name_clean = name.replace("__", " ").replace("_", " ")
            raw_doc = f"{name_clean} {name_clean} {decl.description or ''} {schema_terms}"
            norm_doc = normalize_text(raw_doc)
            raw_tokens = [t for t in re.findall(r"[a-z0-9]+", norm_doc) if len(t) >= 2 and t not in _STOP_WORDS]
            tf = Counter(raw_tokens)
            for tok in tf:
                df[tok] += 1
            total_len += len(raw_tokens)

            doc_hash = hashlib.sha256(norm_doc.encode("utf-8")).hexdigest()[:16]
            hints = _DOMAIN_HINTS.get(skill_prefix, ())
            t_bonus = _TIER_BONUS.get(skill_prefix, 1.4)
            self._indexed.append(
                _IndexedTool(
                    declaration=decl,
                    name=name,
                    skill_prefix=skill_prefix,
                    doc_text=norm_doc[:600],
                    doc_hash=doc_hash,
                    tf=tf,
                    doc_len=max(1, len(raw_tokens)),
                    meta_tokens=frozenset(tf.keys()),
                    hints=hints,
                    tier_bonus=t_bonus,
                )
            )

        n_docs = max(1, len(self._indexed))
        self._avg_doc_len = max(1.0, total_len / n_docs)
        for tok, freq in df.items():
            self._idf[tok] = math.log(1.0 + (n_docs - freq + 0.5) / (freq + 0.5))

    def sync_embeddings(self, client: Any, memory_store: Any, model: str = "gemini-embedding-001") -> int:
        """Lazily embed only new/changed tools and persist vectors in SQLite (0 API calls when cached)."""
        if client is None or memory_store is None:
            return 0
        self._embed_client = client
        self._embed_model = model
        cached = memory_store.get_tool_embeddings_map()
        missing: list[_IndexedTool] = []

        for item in self._indexed:
            entry = cached.get(item.name)
            if entry and entry[0] == item.doc_hash and entry[1]:
                self._embeddings[item.name] = entry[1]
            else:
                missing.append(item)

        if not missing:
            return len(self._embeddings)

        # Embed missing tools in a single batch call (or small chunks)
        try:
            for i in range(0, len(missing), 32):
                batch = missing[i : i + 32]
                resp = client.models.embed_content(
                    model=model,
                    contents=[it.doc_text for it in batch],
                )
                vecs = getattr(resp, "embeddings", None) or []
                for it, emb in zip(batch, vecs):
                    vals = list(getattr(emb, "values", None) or [])
                    if vals:
                        self._embeddings[it.name] = vals
                        memory_store.upsert_tool_embedding(it.name, it.doc_hash, vals, model)
        except Exception:
            # Fail silently to pure BM25 + Hints if offline or rate-limited
            pass
        return len(self._embeddings)

    def _bm25_score(self, q_tokens: list[str], item: _IndexedTool, k1: float = 1.5, b: float = 0.75) -> float:
        score = 0.0
        for tok in q_tokens:
            tf = item.tf.get(tok, 0)
            if tf <= 0:
                continue
            idf = self._idf.get(tok, 0.5)
            denom = tf + k1 * (1.0 - b + b * (item.doc_len / self._avg_doc_len))
            score += idf * ((tf * (k1 + 1.0)) / denom)
        return score

    def _query_embedding(self, norm_q: str) -> list[float] | None:
        if not self._embeddings or self._embed_client is None:
            return None
        try:
            resp = self._embed_client.models.embed_content(
                model=self._embed_model,
                contents=norm_q,
            )
            vecs = getattr(resp, "embeddings", None) or []
            if vecs:
                return list(getattr(vecs[0], "values", None) or [])
        except Exception:
            pass
        return None

    @property
    def total_tools(self) -> int:
        return len(self._all)

    def extract_significant_keywords(self, query: str) -> list[str]:
        norm_q = normalize_text(query)
        q_tokens = _tokenize(norm_q)
        matched: list[str] = []
        for hints in _DOMAIN_HINTS.values():
            for h in hints:
                if (" " in h and h in norm_q) or (" " not in h and h in q_tokens):
                    if h not in matched:
                        matched.append(h)
        return matched[:8]

    def match_playbook(
        self,
        query: str,
        playbooks: Sequence[dict[str, Any]],
    ) -> tuple[list[str], str]:
        """Find the best matching experiential playbook (if >= 2 trigger keywords match)."""
        norm_q = normalize_text(query)
        q_tokens = _tokenize(norm_q)
        best_score = 0
        best_tools: list[str] = []
        best_hint = ""

        for pb in playbooks or []:
            kws = [k.strip().lower() for k in str(pb.get("trigger_keywords", "")).split(",") if k.strip()]
            hits = 0
            for kw in kws:
                if " " in kw and kw in norm_q:
                    hits += 2
                elif kw in q_tokens or (len(kw) >= 4 and kw in norm_q):
                    hits += 1
            if hits >= 2:
                weighted = hits * 10 + min(int(pb.get("success_count") or 1), 10)
                if weighted > best_score:
                    best_score = weighted
                    best_tools = [
                        t.strip()
                        for t in str(pb.get("tools_csv", "")).split(",")
                        if t.strip() in self._by_name
                    ]
                    best_hint = str(pb.get("strategy_hint") or "")

        return best_tools, best_hint

    def get_backup_declarations(
        self,
        failed_tool_names: Sequence[str],
        current_decls: Sequence[types.FunctionDeclaration],
    ) -> list[types.FunctionDeclaration]:
        """Return backup/lower-rated tools to unlock immediately when a primary tool fails."""
        existing = {d.name for d in current_decls if d.name}
        failed_set = set(failed_tool_names)
        unlocked: list[types.FunctionDeclaration] = []

        for fname in failed_tool_names:
            # 1. Explicit fallback chain
            for cand_name in _FALLBACK_CHAINS.get(fname, ()):
                decl = self._by_name.get(cand_name)
                if decl and cand_name not in existing and cand_name not in failed_set:
                    unlocked.append(decl)
                    existing.add(cand_name)

            # 2. Same-domain alternative tools (e.g. another weather / file / search skill)
            failed_prefix = fname.split("__", 1)[0]
            failed_hints = set(_DOMAIN_HINTS.get(failed_prefix, ()))
            if failed_hints:
                for item in self._indexed:
                    if item.name in existing or item.name in failed_set:
                        continue
                    if len(failed_hints & set(item.hints)) >= 2:
                        unlocked.append(item.declaration)
                        existing.add(item.name)

        # 3. Universal Last-Resort Defense fallback:
        #    - Desktop/PC tool failed -> unlock screen_capture_annotator__execute (Gemini Vision)
        #    - Web/Search tool failed -> unlock browser_cdp_controller__execute (Live Chrome CDP)
        if not unlocked:
            desktop_prefixes = ("zalo", "app_window", "uia_", "office_com", "process_", "mouse_", "gui_", "smart_file", "media_", "audio_")
            is_desktop_fail = any(fn.lower().startswith(desktop_prefixes) for fn in failed_tool_names)
            fallback_order = (
                ("screen_capture_annotator__execute",)
                if is_desktop_fail
                else ("browser_cdp_controller__execute", "web_search__search", "web_reader__read_url")
            )
            for cand_name in fallback_order:
                decl = self._by_name.get(cand_name)
                if decl and cand_name not in existing and cand_name not in failed_set:
                    unlocked.append(decl)
                    existing.add(cand_name)
                    break

        return unlocked[:3]

    def needs_tools(self, query: str) -> bool:
        """Fast-path intent gate: return False for pure chat/writing/concept prompts to save ~90% tokens."""
        norm_q = normalize_text(query)
        if not norm_q:
            return False
        for sig in _FORCE_TOOL_SIGNALS:
            if sig in norm_q:
                return True
        if re.search(r"\d+\s*[\+\-\*\/\^%]\s*\d+", norm_q):
            return True
        if len(norm_q) <= 20 and norm_q in {
            "hi", "hello", "chao", "xin chao", "ok", "oke", "cam on", "thanks", "tot", "hay",
        }:
            return False
        q_tokens = _tokenize(norm_q)
        for item in self._indexed:
            for hint in item.hints:
                if " " in hint and hint in norm_q:
                    return True
                if " " not in hint and (hint in q_tokens or (len(hint) >= 5 and hint in norm_q)):
                    return True
        if any(norm_q.startswith(p) or p in norm_q for p in _NO_TOOL_PREFIXES):
            return False
        # Zero-config check: if query strongly matches ANY auto-indexed BM25 tool (>= 2.8), allow tools!
        q_list = [t for t in re.findall(r"[a-z0-9]+", norm_q) if len(t) >= 3 and t not in _STOP_WORDS]
        if q_list:
            for item in self._indexed:
                if self._bm25_score(q_list, item) >= 2.8:
                    return True
        return False

    @staticmethod
    def _split_sub_intents(query: str) -> list[str]:
        """Decompose multi-clause Vietnamese/English prompts into independent sub-goals for balanced routing."""
        norm = normalize_text(query)
        parts = re.split(r"\b(?:sau do|roi|tiep theo|dong thoi|va sau do|then|and then)\b|[,;\n]+", norm)
        cleaned = [p.strip() for p in parts if len(p.strip()) >= 4]
        return cleaned if len(cleaned) >= 2 else []

    @staticmethod
    def _slice_mega_tool_declaration(
        decl: types.FunctionDeclaration,
        norm_q: str,
        q_tokens: set[str],
    ) -> types.FunctionDeclaration:
        """Intra-Tool Dynamic Schema Slicing: prune irrelevant actions on mega-skills (>=5 actions) to save tokens."""
        params = getattr(decl, "parameters", None)
        props = getattr(params, "properties", None) if params else None
        if not isinstance(props, dict) or "action" not in props:
            return decl
        act_schema = props.get("action")
        enum_vals = list(getattr(act_schema, "enum", None) or [])
        if len(enum_vals) < 5:
            return decl

        # Score each action in enum against query tokens
        scored_acts: list[tuple[float, str]] = []
        for act in enum_vals:
            act_norm = normalize_text(act.replace("_", " "))
            act_toks = _tokenize(act_norm)
            hits = sum(1 for t in act_toks if t in q_tokens or (len(t) >= 4 and t in norm_q))
            # Boost direct Vietnamese action intent keywords
            if ("gmail" in norm_q or "mail" in norm_q) and "gmail" in act_norm:
                hits += 3
            if ("dang nhap" in norm_q or "login" in norm_q) and "login" in act_norm:
                hits += 3
            if ("google sheet" in norm_q or "gg sheet" in norm_q) and "sheet" in act_norm:
                hits += 3
            if ("google doc" in norm_q) and "doc" in act_norm:
                hits += 3
            if ("di chuyen" in norm_q or "move" in norm_q) and "move" in act_norm:
                hits += 3
            if ("copy" in norm_q or "nhan ban" in norm_q) and "copy" in act_norm:
                hits += 3
            if ("stop" in norm_q or "dung" in norm_q or "tat" in norm_q) and ("stop" in act_norm or "kill" in act_norm):
                hits += 3
            scored_acts.append((float(hits), act))

        max_hit = max((s for s, _ in scored_acts), default=0.0)
        if max_hit <= 0.0:
            return decl  # Keep full enum if query doesn't clearly narrow down actions

        scored_acts.sort(key=lambda x: x[0], reverse=True)
        keep_actions = [a for _, a in scored_acts[:4]]
        # Always preserve essential read/search actions if present in enum so slicing never blinds file/mail lookup
        for essential in ("search_pc", "search_files", "read_gmail_inbox", "list_containers"):
            if essential in enum_vals and essential not in keep_actions:
                keep_actions.append(essential)
        new_act_schema = types.Schema(
            type=act_schema.type,
            description=act_schema.description,
            enum=keep_actions,
        )
        new_props = dict(props)
        new_props["action"] = new_act_schema
        return types.FunctionDeclaration(
            name=decl.name,
            description=decl.description,
            parameters=types.Schema(
                type=params.type,
                properties=new_props,
                required=list(getattr(params, "required", None) or []),
            ),
        )

    def plan_speculative_call(self, query: str) -> tuple[str, dict[str, Any]] | None:
        """Speculative Step-0 Execution: return (tool_name, args) for deterministic, high-confidence read-only intents."""
        norm = normalize_text(query)
        if not norm or len(norm) > 95:
            return None
        # Skip multi-step prompts (let LLM orchestrate)
        if self._split_sub_intents(query):
            return None

        # 1. Crypto price (e.g. "gia bitcoin hom nay", "gia eth")
        if ("gia " in norm or "price" in norm) and any(k in norm for k in ("bitcoin", "btc", "ethereum", "eth", "sol", "bnb")):
            if "binance_crypto_client__get_crypto_price" in self._by_name:
                sym = "BTCUSDT"
                if "eth" in norm or "ethereum" in norm:
                    sym = "ETHUSDT"
                elif "sol" in norm:
                    sym = "SOLUSDT"
                elif "bnb" in norm:
                    sym = "BNBUSDT"
                return "binance_crypto_client__get_crypto_price", {"symbol": sym}

        # 2. Docker running containers list
        if "docker" in norm and any(k in norm for k in ("dang chay", "danh sach", "list", "kiem tra")) and not any(
            k in norm for k in ("stop", "dung", "tat", "xoa", "kill", "restart")
        ):
            if "docker_local_manager__execute" in self._by_name:
                return "docker_local_manager__execute", {"action": "list_containers"}

        # 3. Current system time
        if any(k in norm for k in ("may gio", "bay gio la may gio", "hom nay thu may", "ngay may")):
            if "datetime_client__get_current_time" in self._by_name:
                return "datetime_client__get_current_time", {}

        return None

    def route(
        self,
        query: str,
        top_k: int = 6,
        pinned_names: Sequence[str] = (),
        metrics_map: dict[str, dict[str, Any]] | None = None,
        playbook_tools: Sequence[str] = (),
        allow_no_tool_fast_path: bool = True,
        use_embeddings: bool | None = None,
    ) -> list[types.FunctionDeclaration]:
        """Select top_k tools via Sub-Goal Multi-Cluster BM25 + Hybrid Embeddings + Tier + Adaptive Telemetry + Schema Slicing."""
        if allow_no_tool_fast_path and top_k > 0 and not playbook_tools and not self.needs_tools(query):
            return []
        if top_k <= 0 or top_k >= len(self._all):
            return list(self._all)

        norm_q = normalize_text(query)
        q_tokens = _tokenize(norm_q)
        q_list = [t for t in re.findall(r"[a-z0-9]+", norm_q) if len(t) >= 2 and t not in _STOP_WORDS]
        m_map = metrics_map or {}
        eff_use_emb = bool(self._embeddings) if use_embeddings is None else bool(use_embeddings)
        q_vec = self._query_embedding(norm_q) if eff_use_emb else None
        sub_clauses = self._split_sub_intents(query)
        has_linux_intent = (os.name != "nt") or any(sig in norm_q for sig in _LINUX_CONTEXT_SIGNALS)

        scored: list[tuple[float, _IndexedTool]] = []
        for item in self._indexed:
            relevance = 0.0
            is_linux_tool = item.skill_prefix.startswith("linux_")

            # 1. Zero-config BM25 score (works automatically for ALL 209+ tools with zero manual hints!)
            bm25 = self._bm25_score(q_list, item)
            relevance += bm25 * 1.8

            # 2. Optional SQLite-cached Semantic Embedding similarity
            if q_vec is not None and item.name in self._embeddings:
                sim = _cosine_similarity(q_vec, self._embeddings[item.name])
                if sim > 0.45:
                    relevance += (sim - 0.45) * 14.0

            # 3. Domain phrase hints (high-precision Vietnamese colloquial phrases)
            for hint in item.hints:
                if " " in hint:
                    if hint in norm_q:
                        relevance += 8.5
                else:
                    if hint in q_tokens or (len(hint) >= 4 and hint in norm_q):
                        relevance += 4.0

            if "http://" in norm_q or "https://" in norm_q:
                if ".pdf" in norm_q and item.skill_prefix == "document_analyzer":
                    relevance += 8.0
                elif item.skill_prefix in ("web_reader", "network_inspector", "browser_reader"):
                    relevance += 3.0

            # OS-Affinity Guard: on Windows hosts, keep `linux_*` tools suppressed unless prompt mentions Linux/WSL/DevOps signals
            if is_linux_tool and not has_linux_intent:
                relevance *= 0.15

            adaptive = compute_adaptive_telemetry_bonus(m_map.get(item.name))
            eff_tier = 0.0 if (is_linux_tool and not has_linux_intent) else item.tier_bonus
            if relevance > 0.5:
                total_score = relevance + eff_tier + adaptive
            else:
                total_score = adaptive * 0.1

            scored.append((total_score, item))

        scored.sort(key=lambda pair: (pair[0], pair[1].name), reverse=True)

        selected: list[types.FunctionDeclaration] = []
        seen: set[str] = set()

        # 1. Playbook tools (proven multi-tool combo for this query pattern)
        for pb_tool in playbook_tools:
            decl = self._by_name.get(pb_tool)
            if decl and pb_tool not in seen and len(selected) < top_k:
                selected.append(decl)
                seen.add(pb_tool)

        # 2. Pinned tools from earlier turns ONLY if at least lightly relevant to current prompt (never drag Zalo into Excel!)
        score_lookup = {it.name: sc for sc, it in scored}
        for pname in list(pinned_names)[-2:]:
            decl = self._by_name.get(pname)
            if decl and pname not in seen and len(selected) < top_k and score_lookup.get(pname, 0.0) >= 5.0:
                selected.append(decl)
                seen.add(pname)

        # 2.5 Sub-Goal Multi-Cluster Routing: guarantee at least 1 top tool per sub-clause in multi-step prompts
        if sub_clauses:
            for clause in sub_clauses[:4]:
                if len(selected) >= top_k:
                    break
                c_toks = _tokenize(clause)
                c_list = [t for t in re.findall(r"[a-z0-9]+", clause) if len(t) >= 2 and t not in _STOP_WORDS]
                best_item = None
                best_sc = 1.2
                for item in self._indexed:
                    if item.name in seen:
                        continue
                    if item.skill_prefix.startswith("linux_") and not has_linux_intent:
                        continue
                    sc = self._bm25_score(c_list, item) * 1.8
                    for hint in item.hints:
                        if " " in hint and hint in clause:
                            sc += 4.5
                        elif " " not in hint and (hint in c_toks or (len(hint) >= 4 and hint in clause)):
                            sc += 2.8
                    if sc > 0.5:
                        sc += item.tier_bonus
                    if sc > best_sc:
                        best_sc = sc
                        best_item = item
                if best_item is not None and best_item.name not in seen:
                    selected.append(best_item.declaration)
                    seen.add(best_item.name)

        # 3. Highest-scoring relevant tools (Specialized Tier + Adaptive Telemetry)
        # Cap tools per skill prefix (default 2) so multi-method skills like report_exporter (4 tools)
        # never crowd out other relevant skills in Top-K.
        prefix_counts: Counter[str] = Counter(name.split("__", 1)[0] for name in seen)
        explicit_export = any(k in norm_q for k in ("xuat", "export", "luu file", "bao cao", "excel", "xlsx", "csv", "markdown"))
        for score, item in scored:
            if len(selected) >= top_k:
                break
            if score >= 1.0 and item.name not in seen:
                cap = 4 if (item.skill_prefix == "report_exporter" and explicit_export) else 2
                if prefix_counts[item.skill_prefix] >= cap:
                    continue
                selected.append(item.declaration)
                seen.add(item.name)
                prefix_counts[item.skill_prefix] += 1

        # 4. Essential safety-net fallbacks
        for fb_name in _ALWAYS_INCLUDE_FALLBACKS:
            if len(selected) >= top_k:
                break
            decl = self._by_name.get(fb_name)
            if decl and fb_name not in seen:
                selected.append(decl)
                seen.add(fb_name)

        # 5. Deterministic fill if still below top_k
        for _, item in scored:
            if len(selected) >= top_k:
                break
            if item.name not in seen:
                selected.append(item.declaration)
                seen.add(item.name)

        # 6. Apply Intra-Tool Dynamic Schema Slicing to mega-skills to reduce schema tokens
        sliced: list[types.FunctionDeclaration] = [
            self._slice_mega_tool_declaration(d, norm_q, q_tokens) for d in selected
        ]

        # 7. Append lightweight `discover_tools` Meta-Tool when routing a subset of the registry
        if self.total_tools > len(sliced) and DISCOVER_TOOLS_NAME not in seen:
            sliced.append(DISCOVER_TOOLS_DECLARATION)

        return sliced

    def discover(
        self,
        query: str,
        exclude_names: Sequence[str] = (),
        limit: int = 4,
        metrics_map: dict[str, dict[str, Any]] | None = None,
    ) -> list[types.FunctionDeclaration]:
        """Mid-turn dynamic tool discovery across ALL 160+ tools (bypasses no-tool fast path)."""
        excluded = set(exclude_names or ())
        excluded.add(DISCOVER_TOOLS_NAME)
        cap = max(1, min(int(limit or 4), 8))
        candidates = self.route(
            query=query,
            top_k=min(self.total_tools, cap + len(excluded) + 4),
            metrics_map=metrics_map,
            allow_no_tool_fast_path=False,
            use_embeddings=bool(self._embeddings),
        )
        unlocked: list[types.FunctionDeclaration] = []
        for decl in candidates:
            if decl.name and decl.name not in excluded:
                unlocked.append(decl)
                excluded.add(decl.name)
                if len(unlocked) >= cap:
                    break
        return unlocked
