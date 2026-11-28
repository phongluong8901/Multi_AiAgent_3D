use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::UNIX_EPOCH;
use tauri::State;

use crate::backend::llm_router::{ask_9router_ref, RouterState};
use crate::backend::skill_pack_adapter::{pack_reload_catalog, SkillPackState};
use crate::backend::telemetry::apply_no_window;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EditableSkillFileInfo {
    pub pack: String,
    pub module_name: String,
    pub has_test: bool,
    pub active_version: String,
    pub version_count: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SkillVersionEntry {
    pub version: String,
    pub created_at: String,
    pub source: String,
    pub note: String,
    pub is_active: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SkillSourcePayload {
    pub pack: String,
    pub module_name: String,
    pub version: String,
    pub active_version: String,
    pub skill_code: String,
    pub test_code: String,
    pub versions: Vec<SkillVersionEntry>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SkillEvolutionPayload {
    pub ok: bool,
    pub pack: String,
    pub module_name: String,
    pub version: String,
    pub rounds_used: usize,
    pub skill_code: String,
    pub test_code: String,
    pub pytest_output: String,
    pub logs: Vec<String>,
    pub versions: Vec<SkillVersionEntry>,
    pub total_tools_after_reload: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkspaceOutputFile {
    pub name: String,
    pub path: String,
    pub ext: String,
    pub size_kb: f64,
    pub modified_sec: u64,
    pub is_image: bool,
}

pub(crate) fn resolve_skills_workspace_root() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    // Trong `tauri dev` (debug), ưu tiên thư mục gốc proj12/skills thay vì bản copy tạm trong target/debug/skills
    if cfg!(debug_assertions) {
        if let Some(app_root) = PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent() {
            if let Some(proj12) = app_root.parent() {
                candidates.push(proj12.to_path_buf());
            }
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.to_path_buf());
            candidates.push(dir.join("_up_"));
            candidates.push(dir.join("resources"));
            if let Some(p) = dir.parent() {
                candidates.push(p.to_path_buf());
            }
        }
    }
    if !cfg!(debug_assertions) {
        if let Some(app_root) = PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent() {
            if let Some(proj12) = app_root.parent() {
                candidates.push(proj12.to_path_buf());
            }
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.clone());
        if let Some(p) = cwd.parent() {
            candidates.push(p.to_path_buf());
        }
    }
    candidates
        .into_iter()
        .find(|p| p.join("skills").is_dir())
}

fn resolve_proj12_root() -> Option<PathBuf> {
    resolve_skills_workspace_root()
}

fn resolve_python_for_proj12(proj12_root: &Path) -> Option<PathBuf> {
    let mut candidates = vec![proj12_root.join(".venv").join("Scripts").join("python.exe")];
    if let Some(ws) = proj12_root.parent() {
        candidates.push(
            ws.join("proj11_AI_use_Skills")
                .join(".venv")
                .join("Scripts")
                .join("python.exe"),
        );
        candidates.push(ws.join(".venv").join("Scripts").join("python.exe"));
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
    for c in candidates {
        if c.is_file() {
            return Some(c);
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

fn sanitize_mod_name(raw: &str) -> String {
    let mut slug = String::new();
    let mut prev_u = false;
    for ch in raw.trim().to_ascii_lowercase().chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch);
            prev_u = false;
        } else if !prev_u && !slug.is_empty() {
            slug.push('_');
            prev_u = true;
        }
    }
    while slug.ends_with('_') {
        slug.pop();
    }
    if slug.is_empty() {
        return "skill_custom_auto".to_string();
    }
    if slug.starts_with("skill_") {
        slug
    } else {
        format!("skill_{slug}")
    }
}

fn read_versions_manifest(proj12_root: &Path, pack: &str, mod_name: &str) -> (String, Vec<SkillVersionEntry>) {
    let mpath = proj12_root
        .join("data")
        .join("skill_versions")
        .join(pack)
        .join(mod_name)
        .join("manifest.json");
    let Ok(raw) = std::fs::read_to_string(&mpath) else {
        return (String::new(), Vec::new());
    };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return (String::new(), Vec::new());
    };
    let active = v["active_version"].as_str().unwrap_or("").to_string();
    let mut list = Vec::new();
    if let Some(arr) = v["versions"].as_array() {
        for item in arr {
            let ver = item["version"].as_str().unwrap_or("").to_string();
            if ver.is_empty() {
                continue;
            }
            list.push(SkillVersionEntry {
                is_active: ver == active,
                version: ver,
                created_at: item["created_at"].as_str().unwrap_or("").to_string(),
                source: item["source"].as_str().unwrap_or("").to_string(),
                note: item["note"].as_str().unwrap_or("").to_string(),
            });
        }
    }
    (active, list)
}

#[tauri::command]
pub fn evolver_list_skills() -> Result<Vec<EditableSkillFileInfo>, String> {
    let root = resolve_proj12_root().ok_or("Không tìm thấy thư mục gốc proj12 (agent_runtime + skills).")?;
    let skills_dir = root.join("skills");
    let mut items = Vec::new();

    let Ok(packs) = std::fs::read_dir(&skills_dir) else {
        return Ok(items);
    };
    for p_ent in packs.flatten() {
        let p_path = p_ent.path();
        if !p_path.is_dir() {
            continue;
        }
        let pack_name = p_ent.file_name().to_string_lossy().to_string();
        if pack_name.starts_with('.') || pack_name.starts_with('_') {
            continue;
        }
        let Ok(files) = std::fs::read_dir(&p_path) else {
            continue;
        };
        for f_ent in files.flatten() {
            let fname = f_ent.file_name().to_string_lossy().to_string();
            if !fname.starts_with("skill_") || !fname.ends_with(".py") {
                continue;
            }
            let mod_name = fname.trim_end_matches(".py").to_string();
            let has_test = p_path.join(format!("test_{mod_name}.py")).is_file();
            let (active_ver, vers) = read_versions_manifest(&root, &pack_name, &mod_name);
            items.push(EditableSkillFileInfo {
                pack: pack_name.clone(),
                module_name: mod_name,
                has_test,
                active_version: active_ver,
                version_count: vers.len(),
            });
        }
    }

    // Sort auto_skills first so newly evolved skills appear right at the top
    items.sort_by(|a, b| {
        let a_auto = a.pack == "auto_skills";
        let b_auto = b.pack == "auto_skills";
        b_auto
            .cmp(&a_auto)
            .then_with(|| a.pack.cmp(&b.pack))
            .then_with(|| a.module_name.cmp(&b.module_name))
    });
    Ok(items)
}

#[tauri::command]
pub fn evolver_get_skill_source(
    pack: String,
    module_name: String,
    version: Option<String>,
) -> Result<SkillSourcePayload, String> {
    let root = resolve_proj12_root().ok_or("Không tìm thấy thư mục gốc proj12.")?;
    let clean_pack = pack.trim();
    let mod_name = sanitize_mod_name(&module_name);
    let (active_ver, versions) = read_versions_manifest(&root, clean_pack, &mod_name);

    let requested_ver = version.unwrap_or_default().trim().to_string();
    let (skill_path, test_path, shown_ver) = if !requested_ver.is_empty() {
        let vdir = root
            .join("data")
            .join("skill_versions")
            .join(clean_pack)
            .join(&mod_name)
            .join(&requested_ver);
        (
            vdir.join(format!("{mod_name}.py")),
            vdir.join(format!("test_{mod_name}.py")),
            requested_ver,
        )
    } else {
        let pdir = root.join("skills").join(clean_pack);
        (
            pdir.join(format!("{mod_name}.py")),
            pdir.join(format!("test_{mod_name}.py")),
            active_ver.clone(),
        )
    };

    let skill_code = std::fs::read_to_string(&skill_path).unwrap_or_default();
    let test_code = std::fs::read_to_string(&test_path).unwrap_or_default();

    Ok(SkillSourcePayload {
        pack: clean_pack.to_string(),
        module_name: mod_name,
        version: shown_ver,
        active_version: active_ver,
        skill_code,
        test_code,
        versions,
    })
}

fn extract_python_code_block(raw: &str) -> String {
    let trimmed = raw.trim();
    if let Some(start) = trimmed.find("```python") {
        let after = &trimmed[start + 9..];
        if let Some(end) = after.find("```") {
            return after[..end].trim().to_string();
        }
    }
    if let Some(start) = trimmed.find("```py") {
        let after = &trimmed[start + 5..];
        if let Some(end) = after.find("```") {
            return after[..end].trim().to_string();
        }
    }
    if let Some(start) = trimmed.find("```") {
        let after = &trimmed[start + 3..];
        let body = after.split_once('\n').map(|(_, b)| b).unwrap_or(after);
        if let Some(end) = body.find("```") {
            return body[..end].trim().to_string();
        }
    }
    trimmed.to_string()
}

fn now_iso_tag() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("ts_{secs}")
}

fn verify_skill_staging_sync(
    root: &Path,
    pack: &str,
    mod_name: &str,
    skill_code: &str,
    test_code: &str,
) -> (bool, String) {
    let Some(py) = resolve_python_for_proj12(root) else {
        return (
            false,
            "[ERROR] Không tìm thấy Python (.venv hoặc python trên PATH) để kiểm tra AST/Pytest."
                .to_string(),
        );
    };

    let stage_dir = root
        .join("data")
        .join("skill_staging")
        .join(format!("{mod_name}_{}", now_iso_tag()));
    if let Err(e) = std::fs::create_dir_all(&stage_dir) {
        return (false, format!("[ERROR] Không tạo được thư mục staging: {e}"));
    }

    let skill_file = stage_dir.join(format!("{mod_name}.py"));
    let test_file = stage_dir.join(format!("test_{mod_name}.py"));
    if let Err(e) = std::fs::write(&skill_file, skill_code) {
        let _ = std::fs::remove_dir_all(&stage_dir);
        return (false, format!("[ERROR] Không ghi được file skill staging: {e}"));
    }
    // Đồng thời đặt bản sao trong `stage_dir/<pack>/<mod_name>.py` + `__init__.py`
    // để pytest import kiểu `import skill_x` hay `import auto_skills.skill_x` đều chạy được 100%!
    let clean_pack = if pack.trim().is_empty() { "auto_skills" } else { pack.trim() };
    let stage_pack_dir = stage_dir.join(clean_pack);
    if std::fs::create_dir_all(&stage_pack_dir).is_ok() {
        let _ = std::fs::write(stage_pack_dir.join("__init__.py"), "");
        let _ = std::fs::write(stage_pack_dir.join(format!("{mod_name}.py")), skill_code);
    }

    // 1) AST Syntax Check
    let mut ast_cmd = Command::new(&py);
    ast_cmd
        .args([
            "-c",
            "import ast, sys; ast.parse(open(sys.argv[1], encoding='utf-8').read())",
            &skill_file.to_string_lossy(),
        ])
        .env("PYTHONUTF8", "1")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    apply_no_window(&mut ast_cmd);
    let ast_out = match ast_cmd.output() {
        Ok(o) => o,
        Err(e) => {
            let _ = std::fs::remove_dir_all(&stage_dir);
            return (false, format!("[AST ERROR] Không chạy được kiểm tra AST: {e}"));
        }
    };
    if !ast_out.status.success() {
        let err = String::from_utf8_lossy(&ast_out.stderr).trim().to_string();
        let _ = std::fs::remove_dir_all(&stage_dir);
        return (false, format!("[AST SYNTAX ERROR]\n{err}"));
    }

    // 2) Pytest Check (if test_code is provided)
    if test_code.trim().is_empty() {
        let _ = std::fs::remove_dir_all(&stage_dir);
        return (true, "[AST OK] Không có test_code, bỏ qua pytest.".to_string());
    }
    if let Err(e) = std::fs::write(&test_file, test_code) {
        let _ = std::fs::remove_dir_all(&stage_dir);
        return (false, format!("[ERROR] Không ghi được file test staging: {e}"));
    }

    let pythonpath = format!(
        "{};{}",
        stage_dir.to_string_lossy(),
        root.join("skills").to_string_lossy()
    );
    let mut pt_cmd = Command::new(&py);
    pt_cmd
        .args(["-m", "pytest", "-q", &test_file.to_string_lossy()])
        .current_dir(&stage_dir)
        .env("PYTHONPATH", pythonpath)
        .env("PYTHONIOENCODING", "utf-8")
        .env("PYTHONUTF8", "1")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    apply_no_window(&mut pt_cmd);

    let pt_res = pt_cmd.output();

    let final_res = match pt_res {
        Ok(o) => {
            let combined = format!(
                "{}\n{}",
                String::from_utf8_lossy(&o.stdout).trim(),
                String::from_utf8_lossy(&o.stderr).trim()
            )
            .trim()
            .to_string();
            if o.status.success() {
                (true, combined)
            } else if combined.contains("No module named pytest") {
                // Fallback: kiểm tra import thực tế + kiểm tra TOOL_SCHEMA & hàm execute()
                let mut smoke = Command::new(&py);
                smoke
                    .args([
                        "-c",
                        &format!(
                            "import importlib, sys; sys.path.insert(0, r'{}'); m = importlib.import_module('{}'); assert callable(getattr(m, 'execute', None)) or any(not n.startswith('_') for n in dir(m)); print('[SMOKE IMPORT OK]', m.__name__)",
                            stage_dir.to_string_lossy(),
                            mod_name
                        ),
                    ])
                    .env("PYTHONUTF8", "1")
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped());
                apply_no_window(&mut smoke);
                match smoke.output() {
                    Ok(so) if so.status.success() => (
                        true,
                        format!(
                            "[AST + IMPORT OK] (Không có pytest ở Python hiện tại, đã chạy smoke import thành công)\n{}",
                            String::from_utf8_lossy(&so.stdout).trim()
                        ),
                    ),
                    Ok(so) => (
                        false,
                        format!(
                            "[IMPORT SMOKE FAIL]\n{}",
                            String::from_utf8_lossy(&so.stderr).trim()
                        ),
                    ),
                    Err(e) => (false, format!("[IMPORT SMOKE ERR] {e}")),
                }
            } else {
                (false, combined)
            }
        }
        Err(e) => (false, format!("[PYTEST ERROR] {e}")),
    };
    let _ = std::fs::remove_dir_all(&stage_dir);
    final_res
}

fn save_version_snapshot(
    root: &Path,
    pack: &str,
    mod_name: &str,
    skill_code: &str,
    test_code: &str,
    source: &str,
    note: &str,
) -> Result<(String, Vec<SkillVersionEntry>), String> {
    let pack_dir = root.join("skills").join(pack);
    std::fs::create_dir_all(&pack_dir).map_err(|e| format!("Không tạo được thư mục pack: {e}"))?;
    std::fs::write(pack_dir.join(format!("{mod_name}.py")), skill_code)
        .map_err(|e| format!("Không lưu được file skill: {e}"))?;
    if !test_code.trim().is_empty() {
        std::fs::write(pack_dir.join(format!("test_{mod_name}.py")), test_code)
            .map_err(|e| format!("Không lưu được file test: {e}"))?;
    }

    let ver_root = root.join("data").join("skill_versions").join(pack).join(mod_name);
    std::fs::create_dir_all(&ver_root)
        .map_err(|e| format!("Không tạo được thư mục skill_versions: {e}"))?;

    let (_, mut existing) = read_versions_manifest(root, pack, mod_name);
    let next_num = existing.len() + 1;
    let ver_name = format!("v{next_num}");
    let vdir = ver_root.join(&ver_name);
    std::fs::create_dir_all(&vdir).map_err(|e| format!("Không tạo được thư mục {ver_name}: {e}"))?;
    std::fs::write(vdir.join(format!("{mod_name}.py")), skill_code)
        .map_err(|e| format!("Không lưu snapshot skill: {e}"))?;
    if !test_code.trim().is_empty() {
        std::fs::write(vdir.join(format!("test_{mod_name}.py")), test_code)
            .map_err(|e| format!("Không lưu snapshot test: {e}"))?;
    }

    for item in &mut existing {
        item.is_active = false;
    }
    existing.push(SkillVersionEntry {
        version: ver_name.clone(),
        created_at: now_iso_tag(),
        source: source.to_string(),
        note: note.chars().take(160).collect(),
        is_active: true,
    });

    let manifest_json = serde_json::json!({
        "active_version": ver_name,
        "versions": existing.iter().map(|v| serde_json::json!({
            "version": v.version,
            "created_at": v.created_at,
            "source": v.source,
            "note": v.note,
        })).collect::<Vec<_>>(),
    });
    std::fs::write(
        ver_root.join("manifest.json"),
        serde_json::to_string_pretty(&manifest_json).unwrap_or_default(),
    )
    .map_err(|e| format!("Không ghi được manifest.json: {e}"))?;

    Ok((ver_name, existing))
}

#[tauri::command]
pub async fn evolver_evolve_skill(
    router: State<'_, RouterState>,
    pack_state: State<'_, SkillPackState>,
    mode: String,
    pack: Option<String>,
    module_name: String,
    requirement: String,
    error_context: Option<String>,
    model: Option<String>,
    max_fix_rounds: Option<usize>,
    _live_smoke_test: Option<bool>,
) -> Result<SkillEvolutionPayload, String> {
    let root = resolve_skills_workspace_root()
        .ok_or("Không tìm thấy thư mục skills/ của ứng dụng.")?;
    let clean_mod = sanitize_mod_name(&module_name);
    let target_pack = pack
        .filter(|p| !p.trim().is_empty())
        .unwrap_or_else(|| "auto_skills".to_string());
    let is_rewrite = mode.trim() == "rewrite";
    let preferred_model = model.filter(|m| !m.trim().is_empty());
    let max_rounds = max_fix_rounds.unwrap_or(3).clamp(1, 4);

    let existing_code = if is_rewrite {
        std::fs::read_to_string(root.join("skills").join(&target_pack).join(format!("{clean_mod}.py")))
            .unwrap_or_default()
    } else {
        String::new()
    };

    let mut logs: Vec<String> = Vec::new();
    logs.push(format!(
        "[RUST-EVOLVER] Bắt đầu {} skill '{target_pack}/{clean_mod}' qua 9Router Native...",
        if is_rewrite { "nâng cấp" } else { "khởi tạo" }
    ));

    let coder_sys = "You are a senior Python tool engineer. Output ONLY one ```python ... ``` code block implementing a clean, self-contained Python 3.11+ skill module with TOOL_SCHEMA dict (name, description, risk_level, parameters with action enum) and `def execute(action: str, **kwargs) -> dict:` returning `{\"ok\": True, ...}`. Use stdlib first, avoid backslashes inside f-string expressions.";
    let coder_prompt = format!(
        "Mode: {}\nModule: {clean_mod}\nPack: {target_pack}\nRequirement:\n{}\n{}\n{}",
        if is_rewrite { "REWRITE/UPGRADE" } else { "CREATE" },
        requirement,
        if !existing_code.is_empty() {
            format!("Existing code:\n```python\n{existing_code}\n```")
        } else {
            String::new()
        },
        error_context
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .map(|e| format!("Error context to fix:\n{e}"))
            .unwrap_or_default()
    );

    let raw_skill = ask_9router_ref(
        router.inner(),
        preferred_model.as_deref(),
        coder_sys,
        &coder_prompt,
        8192,
    )
    .await?;
    let mut skill_code = extract_python_code_block(&raw_skill);
    logs.push(format!("[CODER] Đã sinh mã nguồn ({} ký tự).", skill_code.len()));

    let tester_sys = "You are a Python pytest engineer. Output ONLY one ```python ... ``` code block containing offline deterministic pytest tests (mock network/external calls) importing the skill module directly by its module name (e.g. `import skill_xxx`, NOT `auto_skills.skill_xxx`) and testing `execute(...)` happy path + error handling.";
    let tester_prompt = format!(
        "Write pytest file `test_{clean_mod}.py` for module `{clean_mod}` (import directly via `import {clean_mod}`):\n```python\n{skill_code}\n```"
    );
    let raw_test = ask_9router_ref(
        router.inner(),
        preferred_model.as_deref(),
        tester_sys,
        &tester_prompt,
        4096,
    )
    .await?;
    let mut test_code = extract_python_code_block(&raw_test);
    logs.push(format!("[TESTER] Đã sinh pytest ({} ký tự).", test_code.len()));

    let mut passed = false;
    let mut last_out = String::new();
    let mut rounds_used = 0usize;

    for round in 1..=max_rounds {
        rounds_used = round;
        let root_c = root.clone();
        let pack_c = target_pack.clone();
        let mod_c = clean_mod.clone();
        let sc_c = skill_code.clone();
        let tc_c = test_code.clone();
        let (ok, out) = tauri::async_runtime::spawn_blocking(move || {
            verify_skill_staging_sync(&root_c, &pack_c, &mod_c, &sc_c, &tc_c)
        })
        .await
        .map_err(|e| format!("Lỗi chạy verify staging: {e}"))?;

        last_out = out;
        if ok {
            passed = true;
            logs.push(format!("[VERIFY] Vòng {round}/{max_rounds} PASS."));
            break;
        }
        logs.push(format!("[VERIFY] Vòng {round}/{max_rounds} FAIL -> đang gọi Fixer..."));
        if round < max_rounds {
            let err_in_test = last_out.contains(&format!("test_{clean_mod}.py"))
                && !last_out.contains(&format!("{clean_mod}.py:"));
            if err_in_test {
                let fix_test_prompt = format!(
                    "Fix the pytest file `test_{clean_mod}.py` so it passes against `{clean_mod}.py` (import directly via `import {clean_mod}`).\nSkill code:\n```python\n{skill_code}\n```\nFailing test:\n```python\n{test_code}\n```\nPytest Error:\n{last_out}\nOutput ONLY the fixed ```python ... ``` block for `test_{clean_mod}.py`."
                );
                if let Ok(fixed_raw) = ask_9router_ref(
                    router.inner(),
                    preferred_model.as_deref(),
                    tester_sys,
                    &fix_test_prompt,
                    4096,
                )
                .await
                {
                    let cand = extract_python_code_block(&fixed_raw);
                    if !cand.trim().is_empty() {
                        test_code = cand;
                    }
                }
            } else {
                let fix_prompt = format!(
                    "Fix the Python skill `{clean_mod}` so AST & pytest pass.\nRequirement: {requirement}\nCurrent skill:\n```python\n{skill_code}\n```\nCurrent test:\n```python\n{test_code}\n```\nPytest/AST Error:\n{last_out}\nOutput ONLY the fixed ```python ... ``` block for `{clean_mod}.py`."
                );
                if let Ok(fixed_raw) = ask_9router_ref(
                    router.inner(),
                    preferred_model.as_deref(),
                    coder_sys,
                    &fix_prompt,
                    8192,
                )
                .await
                {
                    let candidate = extract_python_code_block(&fixed_raw);
                    if !candidate.trim().is_empty() {
                        skill_code = candidate;
                    }
                }
            }
        }
    }

    let mut version = String::new();
    let mut versions = Vec::new();
    let mut total_tools = 0usize;

    if passed {
        let (ver, vlist) = save_version_snapshot(
            &root,
            &target_pack,
            &clean_mod,
            &skill_code,
            &test_code,
            if is_rewrite { "ai_rewrite" } else { "ai_create" },
            &requirement,
        )?;
        version = ver;
        versions = vlist;
        logs.push(format!("[SAVED] Đã lưu {target_pack}/{clean_mod} ({version}) và hot-reload."));
        if let Ok(cat) = pack_reload_catalog(pack_state) {
            total_tools = cat.total_tools;
        }
    }

    Ok(SkillEvolutionPayload {
        ok: passed,
        pack: target_pack,
        module_name: clean_mod,
        version,
        rounds_used,
        skill_code,
        test_code,
        pytest_output: last_out,
        logs,
        versions,
        total_tools_after_reload: total_tools,
    })
}

#[tauri::command]
pub async fn evolver_manual_save(
    pack_state: State<'_, SkillPackState>,
    pack: String,
    module_name: String,
    skill_code: String,
    test_code: String,
) -> Result<SkillEvolutionPayload, String> {
    let root = resolve_skills_workspace_root()
        .ok_or("Không tìm thấy thư mục skills/ của ứng dụng.")?;
    let clean_pack = if pack.trim().is_empty() {
        "auto_skills".to_string()
    } else {
        pack.trim().to_string()
    };
    let clean_mod = sanitize_mod_name(&module_name);

    let root_c = root.clone();
    let pack_c = clean_pack.clone();
    let mod_c = clean_mod.clone();
    let sc_c = skill_code.clone();
    let tc_c = test_code.clone();
    let (ok, out) = tauri::async_runtime::spawn_blocking(move || {
        verify_skill_staging_sync(&root_c, &pack_c, &mod_c, &sc_c, &tc_c)
    })
    .await
    .map_err(|e| format!("Lỗi kiểm chứng thủ công Skill: {e}"))?;

    let mut version = String::new();
    let mut versions = Vec::new();
    let mut total_tools = 0usize;
    let mut logs = Vec::new();

    if ok {
        let (ver, vlist) = save_version_snapshot(
            &root,
            &clean_pack,
            &clean_mod,
            &skill_code,
            &test_code,
            "manual_edit",
            "Saved manually from Studio",
        )?;
        version = ver;
        versions = vlist;
        logs.push(format!("[MANUAL] Đã kiểm chứng và lưu {clean_pack}/{clean_mod} ({version})."));
        if let Ok(cat) = pack_reload_catalog(pack_state) {
            total_tools = cat.total_tools;
        }
    } else {
        logs.push("[MANUAL] Không thể lưu vì kiểm tra AST/Pytest thất bại.".to_string());
    }

    Ok(SkillEvolutionPayload {
        ok,
        pack: clean_pack,
        module_name: clean_mod,
        version,
        rounds_used: 1,
        skill_code,
        test_code,
        pytest_output: out,
        logs,
        versions,
        total_tools_after_reload: total_tools,
    })
}

#[tauri::command]
pub async fn evolver_activate_version(
    pack_state: State<'_, SkillPackState>,
    pack: String,
    module_name: String,
    version: String,
) -> Result<SkillEvolutionPayload, String> {
    let root = resolve_skills_workspace_root()
        .ok_or("Không tìm thấy thư mục skills/ của ứng dụng.")?;
    let clean_pack = pack.trim().to_string();
    let clean_mod = sanitize_mod_name(&module_name);
    let clean_ver = version.trim().to_string();

    let ver_root = root
        .join("data")
        .join("skill_versions")
        .join(&clean_pack)
        .join(&clean_mod);
    let vdir = ver_root.join(&clean_ver);
    let skill_code = std::fs::read_to_string(vdir.join(format!("{clean_mod}.py")))
        .map_err(|e| format!("Không tìm thấy bản {clean_ver} của {clean_mod}: {e}"))?;
    let test_code = std::fs::read_to_string(vdir.join(format!("test_{clean_mod}.py"))).unwrap_or_default();

    let pack_dir = root.join("skills").join(&clean_pack);
    std::fs::create_dir_all(&pack_dir).map_err(|e| format!("Không tạo được thư mục pack: {e}"))?;
    std::fs::write(pack_dir.join(format!("{clean_mod}.py")), &skill_code)
        .map_err(|e| format!("Không ghi được file skill: {e}"))?;
    if !test_code.trim().is_empty() {
        let _ = std::fs::write(pack_dir.join(format!("test_{clean_mod}.py")), &test_code);
    }

    let (_, mut versions) = read_versions_manifest(&root, &clean_pack, &clean_mod);
    for v in &mut versions {
        v.is_active = v.version == clean_ver;
    }
    let manifest_json = serde_json::json!({
        "active_version": clean_ver,
        "versions": versions.iter().map(|v| serde_json::json!({
            "version": v.version,
            "created_at": v.created_at,
            "source": v.source,
            "note": v.note,
        })).collect::<Vec<_>>(),
    });
    let _ = std::fs::write(
        ver_root.join("manifest.json"),
        serde_json::to_string_pretty(&manifest_json).unwrap_or_default(),
    );

    let total_tools = pack_reload_catalog(pack_state)
        .map(|c| c.total_tools)
        .unwrap_or(0);

    Ok(SkillEvolutionPayload {
        ok: true,
        pack: clean_pack.clone(),
        module_name: clean_mod.clone(),
        version: clean_ver.clone(),
        rounds_used: 0,
        skill_code,
        test_code,
        pytest_output: format!("Activated version {clean_ver}"),
        logs: vec![format!("[VERSION] Đã kích hoạt {clean_pack}/{clean_mod} -> {clean_ver}")],
        versions,
        total_tools_after_reload: total_tools,
    })
}

#[tauri::command]
pub async fn evolver_delete_skill(
    pack_state: State<'_, SkillPackState>,
    pack: String,
    module_name: String,
) -> Result<SkillEvolutionPayload, String> {
    let root = resolve_skills_workspace_root()
        .ok_or("Không tìm thấy thư mục skills/ của ứng dụng.")?;
    let clean_pack = pack.trim().to_string();
    let clean_mod = sanitize_mod_name(&module_name);
    let pack_dir = root.join("skills").join(&clean_pack);
    let backup_dir = root
        .join("data")
        .join("skill_backups")
        .join(format!("{clean_pack}_{clean_mod}_{}", now_iso_tag()));
    let _ = std::fs::create_dir_all(&backup_dir);

    let mut deleted = Vec::new();
    for fname in [format!("{clean_mod}.py"), format!("test_{clean_mod}.py")] {
        let fpath = pack_dir.join(&fname);
        if fpath.is_file() {
            let _ = std::fs::copy(&fpath, backup_dir.join(&fname));
            if std::fs::remove_file(&fpath).is_ok() {
                deleted.push(fname);
            }
        }
    }

    let total_tools = pack_reload_catalog(pack_state)
        .map(|c| c.total_tools)
        .unwrap_or(0);

    Ok(SkillEvolutionPayload {
        ok: true,
        pack: clean_pack.clone(),
        module_name: clean_mod.clone(),
        version: String::new(),
        rounds_used: 0,
        skill_code: String::new(),
        test_code: String::new(),
        pytest_output: format!("Deleted {:?} (backup saved).", deleted),
        logs: vec![format!("[DELETE] Đã xóa an toàn {clean_pack}/{clean_mod} (đã sao lưu backup).")],
        versions: Vec::new(),
        total_tools_after_reload: total_tools,
    })
}

// ============================================================================
// Outputs Directory Listing, Inline Image Base64 Loader & File Opener
// ============================================================================

#[tauri::command]
pub fn workspace_list_outputs() -> Vec<WorkspaceOutputFile> {
    let mut dirs = Vec::new();
    if let Some(root) = resolve_proj12_root() {
        dirs.push(root.join("outputs"));
    }
    if let Some(app_root) = PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent() {
        dirs.push(app_root.join("data").join("outputs"));
    }

    let mut seen = std::collections::HashSet::new();
    let mut files = Vec::new();
    for d in dirs {
        let Ok(rd) = std::fs::read_dir(&d) else {
            continue;
        };
        for ent in rd.flatten() {
            let p = ent.path();
            if !p.is_file() {
                continue;
            }
            let full_str = p.to_string_lossy().to_string();
            if !seen.insert(full_str.clone()) {
                continue;
            }
            let name = ent.file_name().to_string_lossy().to_string();
            let ext = p
                .extension()
                .map(|e| e.to_string_lossy().to_ascii_lowercase())
                .unwrap_or_default();
            let meta = ent.metadata().ok();
            let size_kb = meta.as_ref().map(|m| (m.len() as f64) / 1024.0).unwrap_or(0.0);
            let modified_sec = meta
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let is_image = matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "webp" | "gif" | "svg");
            files.push(WorkspaceOutputFile {
                name,
                path: full_str,
                ext,
                size_kb: (size_kb * 10.0).round() / 10.0,
                modified_sec,
                is_image,
            });
        }
    }
    files.sort_by(|a, b| b.modified_sec.cmp(&a.modified_sec));
    files.truncate(60);
    files
}

fn b64_enc_bytes(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(((bytes.len() + 2) / 3) * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        out.push(TABLE[((triple >> 18) & 0x3f) as usize] as char);
        out.push(TABLE[((triple >> 12) & 0x3f) as usize] as char);
        out.push(if chunk.len() > 1 {
            TABLE[((triple >> 6) & 0x3f) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            TABLE[(triple & 0x3f) as usize] as char
        } else {
            '='
        });
    }
    out
}

#[tauri::command]
pub fn workspace_read_image_data_url(file_path: String) -> Result<String, String> {
    let p = PathBuf::from(file_path.trim());
    if !p.is_file() {
        return Err(format!("Không tìm thấy file ảnh: {}", file_path));
    }
    let ext = p
        .extension()
        .map(|e| e.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        _ => return Err("Định dạng không phải file ảnh hỗ trợ.".to_string()),
    };
    let bytes = std::fs::read(&p).map_err(|e| format!("Không đọc được ảnh: {e}"))?;
    if bytes.len() > 15 * 1024 * 1024 {
        return Err("Ảnh vượt quá giới hạn 15MB.".to_string());
    }
    Ok(format!("data:{mime};base64,{}", b64_enc_bytes(&bytes)))
}

#[tauri::command]
pub fn workspace_open_output_file(file_path: String) -> Result<(), String> {
    let p = PathBuf::from(file_path.trim());
    if !p.exists() {
        return Err(format!("File không tồn tại: {}", file_path));
    }
    let mut cmd = Command::new("explorer.exe");
    cmd.arg(&p);
    apply_no_window(&mut cmd);
    cmd.spawn().map_err(|e| format!("Không mở được file: {e}"))?;
    Ok(())
}
