use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{Instant, UNIX_EPOCH};
use tauri::State;

use crate::backend::cognitive_memory::{
    cog_record_tool_outcome, normalize_vi_ascii, read_antipatterns_for_tools, tokenize_vi_set,
};
use crate::backend::llm::read_env_value;
use crate::backend::memory::MemoryState;
use crate::backend::telemetry::apply_no_window;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PackParamSpec {
    pub name: String,
    pub param_type: String,
    pub required: bool,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub enum_values: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PackSkillEntry {
    pub tool_name: String,
    pub pack: String,
    pub module_name: String,
    pub description: String,
    pub risk_level: String,
    pub kind: String, // "schema_execute" | "class_method"
    #[serde(default)]
    pub class_name: String,
    #[serde(default)]
    pub method_name: String,
    #[serde(default)]
    pub params: Vec<PackParamSpec>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct CachedPackManifest {
    skills_root: String,
    file_count: usize,
    max_mtime_sec: u64,
    entries: Vec<PackSkillEntry>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RoutedPackSkill {
    pub tool_name: String,
    pub pack: String,
    pub module_name: String,
    pub description: String,
    pub risk_level: String,
    pub score: f64,
    pub params: Vec<PackParamSpec>,
    #[serde(default)]
    pub antipattern_hint: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PackRouteResult {
    pub total_indexed: usize,
    pub sub_goals: Vec<String>,
    pub routed: Vec<RoutedPackSkill>,
    pub prompt_block: String,
    pub python_available: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PackExecResult {
    pub ok: bool,
    pub tool_name: String,
    pub pack: String,
    pub mem_ref: String,
    pub duration_ms: u64,
    pub summary_text: String,
    pub data_json: String,
    pub created_files: Vec<String>,
    pub error: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PipelineStepInput {
    pub tool: String,
    #[serde(default)]
    pub args_json: String,
    #[serde(default)]
    pub save_as: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PackCatalogSummary {
    pub skills_root: String,
    pub python_exe: String,
    pub total_tools: usize,
    pub packs: HashMap<String, usize>,
    pub working_memory_keys: Vec<String>,
    pub entries: Vec<PackSkillEntry>,
}

struct PackAdapterInner {
    skills_root: Option<PathBuf>,
    outputs_dir: PathBuf,
    manifest_cache_path: PathBuf,
    python_exe: Option<PathBuf>,
    entries: Vec<PackSkillEntry>,
    working_memory: HashMap<String, serde_json::Value>,
    mem_seq: usize,
}

pub struct SkillPackState {
    inner: Mutex<PackAdapterInner>,
}

fn is_valid_skills_root(p: &Path) -> bool {
    if !p.is_dir() {
        return false;
    }
    p.join("skill_contract.py").exists()
        || p.join("search_skills").is_dir()
        || p.join("automationPc_skills").is_dir()
        || p.join("code_skills").is_dir()
        || p.join("new_skills").is_dir()
        || p.join("auto_skills").is_dir()
}

fn find_skills_root() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    // Trong `tauri dev` (debug), ưu tiên thư mục gốc proj12/skills thay vì bản copy tạm trong target/debug/skills
    if cfg!(debug_assertions) {
        if let Some(app_root) = PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent() {
            candidates.push(app_root.join("skills"));
            if let Some(proj12_root) = app_root.parent() {
                candidates.push(proj12_root.join("skills"));
                if let Some(ws_root) = proj12_root.parent() {
                    candidates.push(ws_root.join("proj11_AI_use_Skills").join("skills"));
                }
            }
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("skills"));
            candidates.push(dir.join("_up_").join("skills"));
            candidates.push(dir.join("resources").join("skills"));
            if let Some(p) = dir.parent() {
                candidates.push(p.join("skills"));
            }
        }
    }
    if !cfg!(debug_assertions) {
        if let Some(app_root) = PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent() {
            candidates.push(app_root.join("skills"));
            if let Some(proj12_root) = app_root.parent() {
                candidates.push(proj12_root.join("skills"));
                if let Some(ws_root) = proj12_root.parent() {
                    candidates.push(ws_root.join("proj11_AI_use_Skills").join("skills"));
                }
            }
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("skills"));
        if let Some(p) = cwd.parent() {
            candidates.push(p.join("skills"));
            if let Some(gp) = p.parent() {
                candidates.push(gp.join("skills"));
            }
        }
    }
    candidates.into_iter().find(|p| is_valid_skills_root(p))
}

fn find_python_exe(skills_root: Option<&Path>) -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(sr) = skills_root {
        if let Some(proj_root) = sr.parent() {
            candidates.push(proj_root.join(".venv").join("Scripts").join("python.exe"));
            if let Some(ws_root) = proj_root.parent() {
                candidates.push(
                    ws_root
                        .join("proj11_AI_use_Skills")
                        .join(".venv")
                        .join("Scripts")
                        .join("python.exe"),
                );
                candidates.push(ws_root.join(".venv").join("Scripts").join("python.exe"));
            }
        }
    }
    if let Some(app_root) = PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent() {
        if let Some(dev_proj12) = app_root.parent() {
            candidates.push(dev_proj12.join(".venv").join("Scripts").join("python.exe"));
            if let Some(dev_ws) = dev_proj12.parent() {
                candidates.push(
                    dev_ws
                        .join("proj11_AI_use_Skills")
                        .join(".venv")
                        .join("Scripts")
                        .join("python.exe"),
                );
                candidates.push(dev_ws.join(".venv").join("Scripts").join("python.exe"));
            }
        }
    }
    for cand in candidates {
        if cand.is_file() {
            return Some(cand);
        }
    }

    let mut cmd = Command::new("where.exe");
    cmd.arg("python");
    apply_no_window(&mut cmd);
    if let Ok(out) = cmd.output() {
        if out.status.success() {
            for line in String::from_utf8_lossy(&out.stdout).lines() {
                let p = PathBuf::from(line.trim());
                if p.is_file() && !line.contains("WindowsApps") {
                    return Some(p);
                }
            }
        }
    }
    None
}

fn scan_skills_fingerprint(skills_root: &Path) -> (usize, u64) {
    let mut count = 0usize;
    let mut max_mtime = 0u64;
    let Ok(packs) = std::fs::read_dir(skills_root) else {
        return (0, 0);
    };
    for pack_ent in packs.flatten() {
        let p = pack_ent.path();
        if !p.is_dir() {
            continue;
        }
        let name = pack_ent.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name.starts_with('_') {
            continue;
        }
        if let Ok(files) = std::fs::read_dir(&p) {
            for f in files.flatten() {
                let fname = f.file_name().to_string_lossy().to_string();
                if fname.starts_with("skill_") && fname.ends_with(".py") {
                    count += 1;
                    if let Ok(meta) = f.metadata() {
                        if let Ok(mod_t) = meta.modified() {
                            if let Ok(dur) = mod_t.duration_since(UNIX_EPOCH) {
                                max_mtime = max_mtime.max(dur.as_secs());
                            }
                        }
                    }
                }
            }
        }
    }
    (count, max_mtime)
}

const PYTHON_INTROSPECT_SCRIPT: &str = r#"
import importlib.util, inspect, json, os, sys
from pathlib import Path

skills_root = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(skills_root))
entries = []

def map_ann(ann):
    s = str(ann).lower()
    if "bool" in s: return "boolean"
    if "int" in s: return "integer"
    if "float" in s: return "number"
    if "list" in s or "sequence" in s: return "array"
    if "dict" in s: return "object"
    return "string"

for pack_dir in sorted(d for d in skills_root.iterdir() if d.is_dir() and not d.name.startswith((".", "_"))):
    pack_name = pack_dir.name
    if str(pack_dir) not in sys.path:
        sys.path.insert(0, str(pack_dir))
    for fp in sorted(pack_dir.glob("skill_*.py")):
        mod_name = fp.stem
        mkey = f"duck_scan_{pack_name}_{mod_name}"
        try:
            spec = importlib.util.spec_from_file_location(mkey, fp)
            mod = importlib.util.module_from_spec(spec)
            sys.modules[mkey] = mod
            spec.loader.exec_module(mod)
        except Exception:
            continue

        tschema = getattr(mod, "TOOL_SCHEMA", None)
        exec_fn = getattr(mod, "execute", None)
        if isinstance(tschema, dict) and callable(exec_fn):
            raw_name = str(tschema.get("name") or mod_name).replace("skill_", "")
            tname = f"{raw_name}__execute"
            desc = (str(tschema.get("description") or f"Execute {mod_name}").strip().splitlines() or [""])[0][:110]
            risk = str(tschema.get("risk_level") or "safe").strip().lower()
            p_obj = tschema.get("parameters") or {}
            props = p_obj.get("properties") if isinstance(p_obj, dict) else None
            if props is None and isinstance(p_obj, dict):
                props = {k: v for k, v in p_obj.items() if k not in ("type", "required", "properties")}
            req_set = set(p_obj.get("required") or []) if isinstance(p_obj, dict) else set()
            params = []
            for pk, pv in (props or {}).items():
                if isinstance(pv, dict):
                    ptype = str(pv.get("type") or "string")
                    pdesc = str(pv.get("description") or "")[:80]
                    enums = [str(x) for x in (pv.get("enum") or [])][:30]
                    is_req = bool(pk in req_set or pv.get("required") is True)
                else:
                    ptype, pdesc, enums, is_req = "string", "", [], (pk in req_set)
                params.append({"name": pk, "param_type": ptype, "required": is_req, "description": pdesc, "enum_values": enums})
            entries.append({
                "tool_name": tname, "pack": pack_name, "module_name": mod_name,
                "description": desc, "risk_level": risk, "kind": "schema_execute",
                "class_name": "", "method_name": "execute", "params": params
            })
            continue

        for cls_name, cls_obj in inspect.getmembers(mod, inspect.isclass):
            if cls_obj.__module__ != mkey or cls_name.startswith("_"):
                continue
            for m_name, method in inspect.getmembers(cls_obj, predicate=inspect.isfunction):
                if m_name.startswith("_") or m_name not in cls_obj.__dict__:
                    continue
                tname = f"{mod_name.replace('skill_', '')}__{m_name}"
                sig = inspect.signature(method)
                params = []
                for pname, p in sig.parameters.items():
                    if pname == "self" or p.kind in (inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD):
                        continue
                    has_def = p.default is not inspect._empty
                    params.append({
                        "name": pname,
                        "param_type": map_ann(p.annotation),
                        "required": not has_def,
                        "description": f"default={p.default}" if has_def else "",
                        "enum_values": [],
                    })
                doc = inspect.getdoc(method) or inspect.getdoc(cls_obj) or f"Call {cls_name}.{m_name}"
                desc = (doc.strip().splitlines() or [""])[0][:110]
                entries.append({
                    "tool_name": tname, "pack": pack_name, "module_name": mod_name,
                    "description": desc, "risk_level": "safe", "kind": "class_method",
                    "class_name": cls_name, "method_name": m_name, "params": params
                })

print(json.dumps(entries, ensure_ascii=False))
"#;

fn introspect_via_python(python_exe: &Path, skills_root: &Path) -> Result<Vec<PackSkillEntry>, String> {
    let mut cmd = Command::new(python_exe);
    cmd.args(["-c", PYTHON_INTROSPECT_SCRIPT, &skills_root.to_string_lossy()])
        .env("PYTHONIOENCODING", "utf-8")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    apply_no_window(&mut cmd);
    let out = cmd
        .output()
        .map_err(|e| format!("Không thể chạy Python quét kho skills: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout);
    let last_line = stdout
        .lines()
        .rev()
        .find(|l| l.trim_start().starts_with('['))
        .ok_or_else(|| {
            format!(
                "Python introspector không trả về danh sách JSON ({})",
                String::from_utf8_lossy(&out.stderr).chars().take(180).collect::<String>()
            )
        })?;
    serde_json::from_str::<Vec<PackSkillEntry>>(last_line.trim())
        .map_err(|e| format!("Lỗi đọc JSON kho skills: {e}"))
}

fn fallback_static_scan(skills_root: &Path) -> Vec<PackSkillEntry> {
    let mut entries = Vec::new();
    let Ok(packs) = std::fs::read_dir(skills_root) else {
        return entries;
    };
    for pack_ent in packs.flatten() {
        let p = pack_ent.path();
        if !p.is_dir() {
            continue;
        }
        let pack_name = pack_ent.file_name().to_string_lossy().to_string();
        if pack_name.starts_with('.') || pack_name.starts_with('_') {
            continue;
        }
        let Ok(files) = std::fs::read_dir(&p) else {
            continue;
        };
        for f in files.flatten() {
            let fname = f.file_name().to_string_lossy().to_string();
            if !fname.starts_with("skill_") || !fname.ends_with(".py") {
                continue;
            }
            let mod_name = fname.trim_end_matches(".py").to_string();
            let base = mod_name.trim_start_matches("skill_");
            let code = std::fs::read_to_string(f.path()).unwrap_or_default();
            let first_doc = code
                .lines()
                .find(|l| l.trim().starts_with("\"\"\""))
                .map(|l| l.trim().trim_matches('"').trim().to_string())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| format!("Skill module {mod_name}"));
            entries.push(PackSkillEntry {
                tool_name: format!("{base}__execute"),
                pack: pack_name.clone(),
                module_name: mod_name,
                description: first_doc.chars().take(100).collect(),
                risk_level: "safe".to_string(),
                kind: "schema_execute".to_string(),
                class_name: String::new(),
                method_name: "execute".to_string(),
                params: Vec::new(),
            });
        }
    }
    entries
}

fn load_or_build_manifest(
    skills_root: Option<&Path>,
    python_exe: Option<&Path>,
    cache_path: &Path,
) -> Vec<PackSkillEntry> {
    let Some(sr) = skills_root else {
        return Vec::new();
    };
    let (file_count, max_mtime_sec) = scan_skills_fingerprint(sr);
    let sr_str = sr.to_string_lossy().to_string();

    if let Ok(raw) = std::fs::read_to_string(cache_path) {
        if let Ok(cached) = serde_json::from_str::<CachedPackManifest>(&raw) {
            if cached.skills_root == sr_str
                && cached.file_count == file_count
                && cached.max_mtime_sec == max_mtime_sec
                && !cached.entries.is_empty()
            {
                return cached.entries;
            }
        }
    }

    let entries = if let Some(py) = python_exe {
        introspect_via_python(py, sr).unwrap_or_else(|_| fallback_static_scan(sr))
    } else {
        fallback_static_scan(sr)
    };

    if !entries.is_empty() {
        if let Some(parent) = cache_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let manifest = CachedPackManifest {
            skills_root: sr_str,
            file_count,
            max_mtime_sec,
            entries: entries.clone(),
        };
        if let Ok(js) = serde_json::to_string(&manifest) {
            let _ = std::fs::write(cache_path, js.as_bytes());
        }
    }
    entries
}

impl SkillPackState {
    pub fn new(app_data_dir: Option<PathBuf>) -> Self {
        let skills_root = find_skills_root();
        let python_exe = find_python_exe(skills_root.as_deref());
        let base_data_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .map(|r| r.join("data"))
            .or(app_data_dir)
            .unwrap_or_else(|| PathBuf::from("data"));
        let _ = std::fs::create_dir_all(&base_data_dir);

        let outputs_dir = skills_root
            .as_ref()
            .and_then(|sr| sr.parent().map(|p| p.join("outputs")))
            .unwrap_or_else(|| base_data_dir.join("outputs"));
        let _ = std::fs::create_dir_all(&outputs_dir);

        let manifest_cache_path = base_data_dir.join("proj11_skills_manifest.json");
        let entries = load_or_build_manifest(
            skills_root.as_deref(),
            python_exe.as_deref(),
            &manifest_cache_path,
        );

        Self {
            inner: Mutex::new(PackAdapterInner {
                skills_root,
                outputs_dir,
                manifest_cache_path,
                python_exe,
                entries,
                working_memory: HashMap::new(),
                mem_seq: 0,
            }),
        }
    }
}

// ============================================================================
// Sub-Goal Multi-Cluster BM25 + Domain Hints + OS-Affinity Router (Pure Rust)
// ============================================================================

fn split_sub_goals(query: &str) -> Vec<String> {
    let norm = normalize_vi_ascii(query);
    let mut chunks = vec![norm];
    for sep in [" sau do ", " roi ", " tiep theo ", "; "] {
        let mut next = Vec::new();
        for ch in chunks {
            for part in ch.split(sep) {
                let t = part.trim();
                if t.len() >= 3 {
                    next.push(t.to_string());
                }
            }
        }
        chunks = next;
    }
    chunks.truncate(4);
    if chunks.is_empty() {
        vec![normalize_vi_ascii(query)]
    } else {
        chunks
    }
}

fn has_linux_context(norm_query: &str) -> bool {
    [
        "linux", "ubuntu", "debian", "wsl", "systemd", "systemctl", "nginx", "ufw",
        "crontab", "journalctl", "journald", "sshd", "tailscale", "wireguard", "chmod",
        "chown", "rsync", "lsblk", "ttyusb", "i2c",
    ]
    .iter()
    .any(|kw| norm_query.contains(kw))
}

fn domain_hint_bonus(tool_prefix: &str, norm_goal: &str) -> f64 {
    let hints: &[(&str, &[&str], f64)] = &[
        ("datetime_client", &["may gio", "thoi gian", "thuoi gian", "hom nay", "thu may", "ngay thang", "timezone"], 5.5),
        ("calculator", &["tinh toan", "phan tram", "bao nhieu", "cong tru", "calculate"], 4.8),
        ("gmail_imap_smtp", &["gmail", "hop thu", "inbox", "doc mail", "gui mail", "email"], 5.2),
        ("browser_cdp_controller", &["chrome", "cdp", "9222", "gmail", "auto login", "dang nhap web"], 5.0),
        ("google_workspace_web", &["google sheet", "gg sheet", "google doc", "google drive", "sheets.new"], 5.8),
        ("zalo_desktop", &["zalo", "nhan zalo", "gui tin zalo"], 5.5),
        ("chart_visualizer", &["bieu do", "do thi", "ve chart", "plot", "matplotlib"], 5.0),
        ("smart_file_ops", &["tim file", "doi ten hang loat", "recycle bin", "sap xep thu muc", "file o desktop", "desktop"], 4.4),
        ("document_analyzer", &["pdf", "xlsx", "excel", "csv", "bang du lieu", "phan tich file", "file doanh thu", "doanh thu", "doc file"], 5.0),
        ("report_exporter", &["xuat file", "bao cao", "export", "tao file excel"], 4.5),
        ("binance_crypto_client", &["btc", "eth", "sol", "crypto", "binance", "coin"], 4.8),
        ("frankfurter_forex_client", &["ty gia", "usd", "vnd", "eur", "jpy", "ngoai te", "forex"], 5.0),
        ("open_meteo_weather_client", &["thoi tiet", "nhiet do", "do am", "du bao mua"], 4.2),
        ("arxiv_api_client", &["arxiv", "bai bao khoa hoc", "paper", "preprint"], 5.0),
        ("github_api_client", &["github", "repository", "repo", "open source"], 4.6),
        ("docker_local_manager", &["docker", "container", "compose"], 5.2),
        ("office_com_excel", &["excel", "com excel", "sheet"], 4.2),
        ("youtube_web_controller", &["youtube", "phu de youtube", "transcript"], 4.5),
        ("xskt_scraper", &["xo so", "xskt", "ket qua xo so"], 5.5),
        ("zingmp3_crawler", &["zingmp3", "zing mp3", "bxh nhac"], 5.5),
        ("dev_code_search_grep", &["grep", "tim code", "tim ham", "search code", "find symbol"], 4.8),
        ("dev_code_security_auditor", &["security audit", "bao mat code", "lo hong", "hardcode secret"], 4.8),
        ("dev_syntax_lint_checker", &["lint", "syntax", "kiem tra cu phap", "ast check"], 4.8),
        ("dev_test_runner_diag", &["pytest", "unittest", "chay test", "unit test"], 4.8),
        ("dev_git_version_ops", &["git status", "git diff", "git log", "commit", "branch"], 4.8),
        ("dev_repo_map_indexer", &["repo map", "cau truc repo", "so do code", "index repo"], 4.6),
        ("dev_safe_patch_applier", &["patch", "sua code", "diff apply"], 4.6),
        ("dev_react_vite_scaffolder", &["react", "vite", "tao app react", "scaffold react"], 4.6),
        ("dev_python_tool_scaffolder", &["tao tool python", "scaffold python", "python cli"], 4.6),
        ("dev_api_client_generator", &["api client", "json schema", "mock server"], 4.6),
        ("dev_dashboard_ui_builder", &["dashboard html", "skills explorer", "monitor card"], 4.6),
        ("dev_sqlite_state_scaffolder", &["sqlite", "schema sql", "migration"], 4.6),
        ("dev_docker_deploy_scaffolder", &["dockerfile", "docker compose", "deploy"], 4.6),
        ("web_search", &["tim kiem", "search", "tin moi", "tra cuu"], 2.2),
    ];
    for (prefix, kws, boost) in hints {
        if tool_prefix.contains(prefix) && kws.iter().any(|k| norm_goal.contains(k)) {
            return *boost;
        }
    }
    0.0
}

/// Intra-Tool Dynamic Schema Slicing: trim mega-skill action enums (>= 5) to query-relevant actions
fn slice_params_for_query(params: &[PackParamSpec], q_tokens: &HashSet<String>) -> Vec<PackParamSpec> {
    params
        .iter()
        .map(|p| {
            if p.name == "action" && p.enum_values.len() >= 6 && !q_tokens.is_empty() {
                let mut matched: Vec<String> = p
                    .enum_values
                    .iter()
                    .filter(|act| {
                        let act_toks = tokenize_vi_set(act);
                        !q_tokens.is_disjoint(&act_toks)
                    })
                    .cloned()
                    .collect();
                if matched.len() >= 2 {
                    for fallback in &p.enum_values {
                        if matched.len() >= 6 {
                            break;
                        }
                        if !matched.contains(fallback) {
                            matched.push(fallback.clone());
                        }
                    }
                    let mut cloned = p.clone();
                    cloned.enum_values = matched;
                    return cloned;
                }
            }
            p.clone()
        })
        .collect()
}

pub fn route_entries_bm25(
    entries: &[PackSkillEntry],
    query: &str,
    top_k: usize,
) -> (Vec<String>, Vec<(f64, PackSkillEntry)>) {
    if entries.is_empty() || query.trim().is_empty() {
        return (Vec::new(), Vec::new());
    }
    let full_norm = normalize_vi_ascii(query);
    let linux_ok = has_linux_context(&full_norm);
    let sub_goals = split_sub_goals(query);

    // Pre-tokenize documents and compute IDF
    let n_docs = entries.len() as f64;
    let mut df: HashMap<String, usize> = HashMap::new();
    let mut doc_tokens: Vec<HashSet<String>> = Vec::with_capacity(entries.len());

    for e in entries {
        let param_names: Vec<&str> = e.params.iter().map(|p| p.name.as_str()).collect();
        let enum_txt: Vec<String> = e
            .params
            .iter()
            .flat_map(|p| p.enum_values.iter().cloned())
            .collect();
        let corpus = format!(
            "{} {} {} {} {} {}",
            e.tool_name.replace("__", " ").replace('_', " "),
            e.pack,
            e.module_name,
            e.description,
            param_names.join(" "),
            enum_txt.join(" ")
        );
        let toks = tokenize_vi_set(&corpus);
        for t in &toks {
            *df.entry(t.clone()).or_insert(0) += 1;
        }
        doc_tokens.push(toks);
    }

    let per_goal_quota = (top_k.max(4) / sub_goals.len().max(1)).max(2);
    let mut best_scores: HashMap<String, f64> = HashMap::new();

    for goal in &sub_goals {
        let g_toks = tokenize_vi_set(goal);
        let mut goal_ranked: Vec<(usize, f64)> = Vec::new();

        for (idx, e) in entries.iter().enumerate() {
            // OS-Affinity Guard: suppress linux_* skills on Windows unless query explicitly mentions Linux/DevOps
            if (e.pack == "automationLinux_skills" || e.module_name.starts_with("skill_linux_")) && !linux_ok {
                continue;
            }
            let prefix = e.tool_name.split("__").next().unwrap_or(&e.tool_name);
            let mut score = domain_hint_bonus(prefix, goal);

            for qt in &g_toks {
                if doc_tokens[idx].contains(qt) {
                    let doc_freq = (*df.get(qt).unwrap_or(&1)) as f64;
                    let idf = ((n_docs - doc_freq + 0.5) / (doc_freq + 0.5) + 1.0).ln();
                    score += idf * 1.65;
                }
            }
            if score > 0.4 && e.pack == "auto_skills" {
                score += 1.8;
            }
            if score > 0.4 {
                goal_ranked.push((idx, score));
            }
        }

        goal_ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        for (rank_pos, (idx, sc)) in goal_ranked.into_iter().take(per_goal_quota + 2).enumerate() {
            let bonus = if rank_pos < per_goal_quota { 0.8 } else { 0.0 };
            let entry_sc = best_scores.entry(entries[idx].tool_name.clone()).or_insert(0.0);
            if sc + bonus > *entry_sc {
                *entry_sc = sc + bonus;
            }
        }
    }

    let mut combined: Vec<(f64, PackSkillEntry)> = entries
        .iter()
        .filter_map(|e| best_scores.get(&e.tool_name).map(|sc| (*sc, e.clone())))
        .collect();
    combined.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    combined.truncate(top_k.clamp(2, 14));
    (sub_goals, combined)
}

#[tauri::command]
pub fn pack_get_catalog(pack_state: State<'_, SkillPackState>) -> Result<PackCatalogSummary, String> {
    let guard = pack_state.inner.lock().map_err(|e| e.to_string())?;
    let mut packs: HashMap<String, usize> = HashMap::new();
    for e in &guard.entries {
        *packs.entry(e.pack.clone()).or_insert(0) += 1;
    }
    let mut wm_keys: Vec<String> = guard.working_memory.keys().cloned().collect();
    wm_keys.sort();
    Ok(PackCatalogSummary {
        skills_root: guard
            .skills_root
            .as_ref()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default(),
        python_exe: guard
            .python_exe
            .as_ref()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default(),
        total_tools: guard.entries.len(),
        packs,
        working_memory_keys: wm_keys,
        entries: guard.entries.clone(),
    })
}

#[tauri::command]
pub fn pack_reload_catalog(pack_state: State<'_, SkillPackState>) -> Result<PackCatalogSummary, String> {
    let mut guard = pack_state.inner.lock().map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&guard.manifest_cache_path);
    guard.skills_root = find_skills_root();
    guard.python_exe = find_python_exe(guard.skills_root.as_deref());
    guard.entries = load_or_build_manifest(
        guard.skills_root.as_deref(),
        guard.python_exe.as_deref(),
        &guard.manifest_cache_path,
    );
    drop(guard);
    pack_get_catalog(pack_state)
}

#[tauri::command]
pub fn pack_route_skills(
    pack_state: State<'_, SkillPackState>,
    mem_state: State<'_, MemoryState>,
    query: String,
    top_k: Option<usize>,
) -> Result<PackRouteResult, String> {
    let guard = pack_state.inner.lock().map_err(|e| e.to_string())?;
    let total_indexed = guard.entries.len();
    let python_available = guard.python_exe.is_some();
    let k = top_k.unwrap_or(6).clamp(2, 12);

    let (sub_goals, ranked) = route_entries_bm25(&guard.entries, &query, k);
    let q_tokens = tokenize_vi_set(&query);
    let tool_names: Vec<String> = ranked.iter().map(|(_, e)| e.tool_name.clone()).collect();

    let mut antipattern_map: HashMap<String, String> = HashMap::new();
    if let Ok(mguard) = mem_state.inner.lock() {
        if let Some(db) = mguard.as_ref() {
            for ap in read_antipatterns_for_tools(db, &tool_names) {
                antipattern_map
                    .entry(ap.tool_name.clone())
                    .or_insert(ap.lesson);
            }
        }
    }

    let mut routed = Vec::new();
    let mut prompt_lines = Vec::new();
    if !ranked.is_empty() && python_available {
        prompt_lines.push(format!(
            "KHO SKILL PROJ11 ({} tools san sang - da dinh tuyen BM25 Top-{} sat nhat voi yeu cau):",
            total_indexed,
            ranked.len()
        ));
    }

    for (score, entry) in ranked {
        let sliced_params = slice_params_for_query(&entry.params, &q_tokens);
        let ap_hint = antipattern_map.get(&entry.tool_name).cloned().unwrap_or_default();

        if python_available {
            let p_desc: Vec<String> = sliced_params
                .iter()
                .take(8)
                .map(|p| {
                    let req = if p.required { "*" } else { "" };
                    if !p.enum_values.is_empty() {
                        format!("{}{}:[{}]", p.name, req, p.enum_values.join("|"))
                    } else {
                        format!("{}{}:{}", p.name, req, p.param_type)
                    }
                })
                .collect();
            let mut line = format!(
                "- `{}` ({}): {} | Params: {{{}}}",
                entry.tool_name,
                entry.pack,
                entry.description,
                p_desc.join(", ")
            );
            if !ap_hint.is_empty() {
                line.push_str(&format!(" | [LUU Y: {}]", ap_hint));
            }
            prompt_lines.push(line);
        }

        routed.push(RoutedPackSkill {
            tool_name: entry.tool_name,
            pack: entry.pack,
            module_name: entry.module_name,
            description: entry.description,
            risk_level: entry.risk_level,
            score: (score * 100.0).round() / 100.0,
            params: sliced_params,
            antipattern_hint: ap_hint,
        });
    }

    if !routed.is_empty() && python_available {
        if !guard.working_memory.is_empty() {
            let mut keys: Vec<&String> = guard.working_memory.keys().collect();
            keys.sort();
            prompt_lines.push(format!(
                "Working Memory dang luu: {} (co the truyen thang \"$mem_1\" vao tham so buoc sau).",
                keys.iter().map(|s| s.as_str()).collect::<Vec<_>>().join(", ")
            ));
        }
        prompt_lines.push(
            "Cach goi Skill Pack: [TOOL:pack_skill:{\"tool\":\"<tool_name>\",\"args\":{...}}] hoac chay chuoi nhieu buoc: [TOOL:pack_pipeline:{\"steps\":[{\"tool\":\"...\",\"args\":{...}}]}] hoac tim them tu 209 tools: [TOOL:discover_tools:{\"query\":\"...\"}]".to_string(),
        );
    }

    Ok(PackRouteResult {
        total_indexed,
        sub_goals,
        routed,
        prompt_block: if prompt_lines.is_empty() {
            String::new()
        } else {
            format!("\n{}", prompt_lines.join("\n"))
        },
        python_available,
    })
}

/// 0ms Working Memory `$mem_N` Substitution + Fuzzy Synonym Parameter Repair
fn resolve_and_repair_args(
    raw_args: serde_json::Value,
    spec_params: &[PackParamSpec],
    working_mem: &HashMap<String, serde_json::Value>,
) -> serde_json::Value {
    fn subst_mem(val: serde_json::Value, wm: &HashMap<String, serde_json::Value>) -> serde_json::Value {
        match val {
            serde_json::Value::String(s) => {
                let trimmed = s.trim();
                if trimmed.starts_with("$mem_") {
                    if let Some(found) = wm.get(trimmed) {
                        return found.clone();
                    }
                }
                serde_json::Value::String(s)
            }
            serde_json::Value::Array(arr) => {
                serde_json::Value::Array(arr.into_iter().map(|x| subst_mem(x, wm)).collect())
            }
            serde_json::Value::Object(map) => {
                let mut next = serde_json::Map::new();
                for (k, v) in map {
                    next.insert(k, subst_mem(v, wm));
                }
                serde_json::Value::Object(next)
            }
            other => other,
        }
    }

    let substituted = subst_mem(raw_args, working_mem);
    let serde_json::Value::Object(mut obj) = substituted else {
        return serde_json::json!({});
    };

    if spec_params.is_empty() {
        return serde_json::Value::Object(obj);
    }

    let known_names: HashSet<String> = spec_params.iter().map(|p| p.name.clone()).collect();
    let synonyms: &[(&[&str], &[&str])] = &[
        (&["sheet_name", "doc_name", "name", "heading"], &["title"]),
        (&["file_path", "filepath", "filename", "file", "target_path"], &["path", "input_path", "output_path"]),
        (&["q", "keyword", "keywords", "search_query", "term"], &["query"]),
        (&["link", "target_url", "page_url", "uri"], &["url"]),
        (&["max_items", "top_k", "count", "num_results"], &["limit", "max_results"]),
        (&["msg", "body", "content", "text_body"], &["message", "text"]),
        (&["recipient", "email", "receiver"], &["to", "to_email", "contact"]),
    ];

    let keys_snapshot: Vec<String> = obj.keys().cloned().collect();
    for given_key in keys_snapshot {
        if known_names.contains(&given_key) {
            continue;
        }
        let low = given_key.to_ascii_lowercase();
        let mut mapped_target: Option<String> = None;
        for (src_aliases, dst_candidates) in synonyms {
            if src_aliases.contains(&low.as_str()) {
                for cand in *dst_candidates {
                    if known_names.contains(*cand) && !obj.contains_key(*cand) {
                        mapped_target = Some((*cand).to_string());
                        break;
                    }
                }
            }
        }
        if let Some(target_key) = mapped_target {
            if let Some(v) = obj.remove(&given_key) {
                obj.insert(target_key, v);
            }
        }
    }

    serde_json::Value::Object(obj)
}

const PYTHON_EXEC_WRAPPER: &str = r#"
import importlib.util, inspect, json, os, sys, traceback
from pathlib import Path

skills_root = Path(sys.argv[1]).resolve()
pack_name = sys.argv[2]
mod_name = sys.argv[3]
kind = sys.argv[4]
cls_name = sys.argv[5]
method_name = sys.argv[6]
outputs_dir = Path(sys.argv[7]).resolve()
args = json.loads(os.environ.get("DUCK_PACK_ARGS_JSON", "{}") or "{}")

outputs_dir.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(skills_root))
pack_dir = skills_root / pack_name
sys.path.insert(0, str(pack_dir))

before_files = {p.name: p.stat().st_mtime for p in outputs_dir.glob("*") if p.is_file()}

try:
    fp = pack_dir / f"{mod_name}.py"
    mkey = f"duck_exec_{pack_name}_{mod_name}"
    spec = importlib.util.spec_from_file_location(mkey, fp)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[mkey] = mod
    spec.loader.exec_module(mod)

    if kind == "schema_execute":
        fn = getattr(mod, "execute")
        sig = inspect.signature(fn)
        has_varkw = any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values())
        call_args = args if has_varkw else {k: v for k, v in args.items() if k in sig.parameters}
        res = fn(**call_args)
    else:
        cls_ref = getattr(mod, cls_name)
        init_sig = inspect.signature(cls_ref.__init__)
        inst = cls_ref(output_dir=str(outputs_dir)) if "output_dir" in init_sig.parameters else cls_ref()
        fn = getattr(inst, method_name)
        sig = inspect.signature(fn)
        has_varkw = any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values())
        call_args = args if has_varkw else {k: v for k, v in args.items() if k in sig.parameters}
        res = fn(**call_args)

    created = []
    for p in outputs_dir.glob("*"):
        if p.is_file() and (p.name not in before_files or p.stat().st_mtime > before_files[p.name]):
            created.append(str(p))

    if isinstance(res, dict) and "ok" in res:
        ok_flag = bool(res.get("ok"))
        payload = res.get("data", res)
        err_txt = str(res.get("error") or "")
    else:
        ok_flag = True
        payload = res
        err_txt = ""

    print("__DUCK_PACK_JSON__" + json.dumps({
        "ok": ok_flag,
        "data": payload,
        "created_files": created,
        "error": err_txt
    }, ensure_ascii=False, default=str))
except Exception as exc:
    print("__DUCK_PACK_JSON__" + json.dumps({
        "ok": False,
        "data": None,
        "created_files": [],
        "error": f"{type(exc).__name__}: {exc}",
        "traceback": traceback.format_exc()[-600:]
    }, ensure_ascii=False))
"#;

pub fn execute_single_pack_tool_sync(
    pack_state: &SkillPackState,
    tool_name: &str,
    raw_args_json: &str,
    save_as: Option<&str>,
) -> Result<PackExecResult, String> {
    let (skills_root, outputs_dir, python_exe, entry, repaired_args) = {
        let guard = pack_state.inner.lock().map_err(|e| e.to_string())?;
        let sr = guard
            .skills_root
            .clone()
            .ok_or("Không tìm thấy thư mục kho skills/ trong proj12.")?;
        let py = guard
            .python_exe
            .clone()
            .ok_or("Chưa tìm thấy môi trường Python (.venv hoặc python.exe) để chạy kho skills.")?;
        let found = guard
            .entries
            .iter()
            .find(|e| {
                e.tool_name.eq_ignore_ascii_case(tool_name)
                    || e.module_name.eq_ignore_ascii_case(tool_name)
                    || e.tool_name
                        .split("__")
                        .next()
                        .map(|p| p.eq_ignore_ascii_case(tool_name))
                        .unwrap_or(false)
            })
            .cloned()
            .ok_or_else(|| format!("Không tìm thấy skill `{tool_name}` trong kho 209 tools."))?;

        let parsed_args: serde_json::Value = if raw_args_json.trim().is_empty() {
            serde_json::json!({})
        } else {
            serde_json::from_str(raw_args_json.trim()).unwrap_or_else(|_| serde_json::json!({}))
        };
        let repaired = resolve_and_repair_args(parsed_args, &found.params, &guard.working_memory);
        (sr, guard.outputs_dir.clone(), py, found, repaired)
    };

    let t0 = Instant::now();
    let mut cmd = Command::new(&python_exe);
    cmd.args([
        "-c",
        PYTHON_EXEC_WRAPPER,
        &skills_root.to_string_lossy(),
        &entry.pack,
        &entry.module_name,
        &entry.kind,
        &entry.class_name,
        &entry.method_name,
        &outputs_dir.to_string_lossy(),
    ])
    .current_dir(skills_root.parent().unwrap_or(&skills_root))
    .env("PYTHONIOENCODING", "utf-8")
    .env("DUCK_PACK_ARGS_JSON", repaired_args.to_string())
    // Scrub LLM API keys so skills cannot leak them
    .env_remove("GEMINI_API_KEY")
    .env_remove("GEMINI_API_KEYS")
    .env_remove("GROQ_API_KEY")
    .env_remove("GROQ_API_KEYS")
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

    // Pass Gmail/Workspace non-LLM env vars if configured in .env
    for mail_var in ["GMAIL_USER", "GMAIL_APP_PASSWORD"] {
        if let Some(v) = read_env_value(mail_var) {
            cmd.env(mail_var, v);
        }
    }
    apply_no_window(&mut cmd);

    let out = cmd
        .output()
        .map_err(|e| format!("Lỗi khởi chạy Python cho `{}`: {e}", entry.tool_name))?;
    let duration_ms = t0.elapsed().as_millis() as u64;
    let stdout = String::from_utf8_lossy(&out.stdout);

    let marker = "__DUCK_PACK_JSON__";
    let Some(pos) = stdout.rfind(marker) else {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Ok(PackExecResult {
            ok: false,
            tool_name: entry.tool_name,
            pack: entry.pack,
            mem_ref: String::new(),
            duration_ms,
            summary_text: String::new(),
            data_json: String::new(),
            created_files: Vec::new(),
            error: format!(
                "Skill kết thúc bất thường: {}",
                stderr.chars().take(240).collect::<String>()
            ),
        });
    };

    let json_slice = stdout[pos + marker.len()..].trim();
    let v: serde_json::Value = serde_json::from_str(json_slice)
        .map_err(|e| format!("Phản hồi JSON từ skill lỗi: {e}"))?;

    let ok = v["ok"].as_bool().unwrap_or(false);
    let data_val = v.get("data").cloned().unwrap_or(serde_json::Value::Null);
    let err_str = v["error"].as_str().unwrap_or("").to_string();
    let created_files: Vec<String> = v["created_files"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|x| x.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    let mut mem_ref = String::new();
    if ok && !data_val.is_null() {
        if let Ok(mut guard) = pack_state.inner.lock() {
            guard.mem_seq += 1;
            let auto_key = save_as
                .map(|s| s.trim().to_string())
                .filter(|s| s.starts_with("$mem_"))
                .unwrap_or_else(|| format!("$mem_{}", guard.mem_seq));
            guard.working_memory.insert(auto_key.clone(), data_val.clone());
            mem_ref = auto_key;
        }
    }

    let data_json = serde_json::to_string_pretty(&data_val).unwrap_or_default();
    let preview = if data_json.chars().count() > 520 {
        format!(
            "{}...",
            data_json.chars().take(520).collect::<String>()
        )
    } else {
        data_json.clone()
    };

    let summary_text = if ok {
        let file_note = if created_files.is_empty() {
            String::new()
        } else {
            format!(" | File tạo mới: {}", created_files.join(", "))
        };
        format!(
            "[SKILL PACK `{}` ({}ms, {})] {}{}",
            entry.tool_name, duration_ms, mem_ref, preview, file_note
        )
    } else {
        format!("[SKILL PACK LỖI `{}`] {}", entry.tool_name, err_str)
    };

    Ok(PackExecResult {
        ok,
        tool_name: entry.tool_name,
        pack: entry.pack,
        mem_ref,
        duration_ms,
        summary_text,
        data_json,
        created_files,
        error: err_str,
    })
}

#[tauri::command]
pub async fn pack_execute_skill(
    pack_state: State<'_, SkillPackState>,
    mem_state: State<'_, MemoryState>,
    tool_name: String,
    args_json: String,
    user_query: Option<String>,
) -> Result<PackExecResult, String> {
    // Note: execute synchronously inside blocking thread using state references safely
    // Since Tauri State wraps Arc internally, we extract inner data before blocking only where needed;
    // execute_single_pack_tool_sync locks Mutex only for microseconds around HashMap access!
    let res = execute_single_pack_tool_sync(&pack_state, &tool_name, &args_json, None)?;
    let _ = cog_record_tool_outcome(
        mem_state,
        res.tool_name.clone(),
        res.ok,
        if res.ok { None } else { Some(res.error.clone()) },
        user_query,
    );
    Ok(res)
}

#[tauri::command]
pub async fn pack_execute_pipeline(
    pack_state: State<'_, SkillPackState>,
    mem_state: State<'_, MemoryState>,
    steps: Vec<PipelineStepInput>,
    user_query: Option<String>,
) -> Result<Vec<PackExecResult>, String> {
    if steps.is_empty() {
        return Err("Pipeline cần ít nhất 1 bước tool.".to_string());
    }
    let mut results = Vec::with_capacity(steps.len().min(6));
    for step in steps.into_iter().take(6) {
        let save_key = if step.save_as.trim().is_empty() {
            None
        } else {
            Some(step.save_as.as_str())
        };
        let res = execute_single_pack_tool_sync(&pack_state, &step.tool, &step.args_json, save_key)?;
        let ok = res.ok;
        results.push(res);
        if !ok {
            break;
        }
    }
    if let Some(last) = results.last() {
        let _ = cog_record_tool_outcome(
            mem_state,
            last.tool_name.clone(),
            last.ok,
            if last.ok { None } else { Some(last.error.clone()) },
            user_query,
        );
    }
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bm25_os_affinity_and_subgoal_routing() {
        let sample = vec![
            PackSkillEntry {
                tool_name: "gmail_imap_smtp__execute".to_string(),
                pack: "automationPc_skills".to_string(),
                module_name: "skill_gmail_imap_smtp".to_string(),
                description: "Read and send Gmail inbox via IMAP/SMTP".to_string(),
                risk_level: "safe".to_string(),
                kind: "schema_execute".to_string(),
                class_name: String::new(),
                method_name: "execute".to_string(),
                params: vec![],
            },
            PackSkillEntry {
                tool_name: "google_workspace_web__execute".to_string(),
                pack: "automationWeb_skills".to_string(),
                module_name: "skill_google_workspace_web".to_string(),
                description: "Create Google Sheet and Google Doc on Drive".to_string(),
                risk_level: "safe".to_string(),
                kind: "schema_execute".to_string(),
                class_name: String::new(),
                method_name: "execute".to_string(),
                params: vec![],
            },
            PackSkillEntry {
                tool_name: "linux_systemd_manager__execute".to_string(),
                pack: "automationLinux_skills".to_string(),
                module_name: "skill_linux_systemd_manager".to_string(),
                description: "Check system service units on Linux".to_string(),
                risk_level: "safe".to_string(),
                kind: "schema_execute".to_string(),
                class_name: String::new(),
                method_name: "execute".to_string(),
                params: vec![],
            },
        ];

        let (goals, routed) = route_entries_bm25(
            &sample,
            "đọc mail mới nhất trong gmail rồi tạo google sheet báo cáo",
            4,
        );
        assert_eq!(goals.len(), 2);
        let names: Vec<&str> = routed.iter().map(|(_, e)| e.tool_name.as_str()).collect();
        assert!(names.contains(&"gmail_imap_smtp__execute"));
        assert!(names.contains(&"google_workspace_web__execute"));
        assert!(!names.contains(&"linux_systemd_manager__execute"));
    }

    #[test]
    fn test_working_memory_and_fuzzy_param_repair() {
        let mut wm = HashMap::new();
        wm.insert(
            "$mem_1".to_string(),
            serde_json::json!([["Tháng 1", 120], ["Tháng 2", 180]]),
        );
        let spec = vec![
            PackParamSpec {
                name: "title".to_string(),
                param_type: "string".to_string(),
                required: true,
                description: String::new(),
                enum_values: vec![],
            },
            PackParamSpec {
                name: "rows".to_string(),
                param_type: "array".to_string(),
                required: false,
                description: String::new(),
                enum_values: vec![],
            },
        ];
        let raw = serde_json::json!({
            "sheet_name": "Bao_Cao_Q1",
            "rows": "$mem_1"
        });
        let repaired = resolve_and_repair_args(raw, &spec, &wm);
        assert_eq!(repaired["title"], "Bao_Cao_Q1");
        assert!(repaired["rows"].is_array());
    }
}
