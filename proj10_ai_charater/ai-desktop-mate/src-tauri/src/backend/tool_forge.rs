use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::State;

use crate::backend::memory::{
    db_delete_custom_skill, db_get_custom_skill, db_increment_skill_usage, db_list_custom_skills,
    db_toggle_custom_skill, db_upsert_custom_skill, skills_storage_dir, CustomSkillRecord,
    MemoryState,
};
use crate::backend::telemetry::apply_no_window;

const MAX_CAPTURE_BYTES: usize = 65_536;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SandboxRunResult {
    pub verified: bool,
    pub static_safe: bool,
    pub safety_issues: Vec<String>,
    pub exit_code: i32,
    pub timed_out: bool,
    pub duration_ms: i64,
    pub stdout: String,
    pub stderr: String,
    pub code_hash: String,
    pub failure_reason: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SkillExecResult {
    pub ok: bool,
    pub skill_id: String,
    pub exit_code: i32,
    pub timed_out: bool,
    pub duration_ms: i64,
    pub stdout: String,
    pub stderr: String,
    pub error_summary: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SaveSkillPayload {
    pub id: String,
    pub name: String,
    pub description: String,
    pub language: String,
    pub triggers_json: String,
    pub params_schema_json: String,
    pub code: String,
    pub test_args_json: String,
    pub expected_keywords_json: String,
    pub code_hash: String,
    pub heal_note: Option<String>,
}

pub struct ToolForgeState {
    pub verified_receipts: Mutex<HashMap<String, SandboxRunResult>>,
}

impl ToolForgeState {
    pub fn new() -> Self {
        Self {
            verified_receipts: Mutex::new(HashMap::new()),
        }
    }
}

pub fn normalize_language(lang: &str) -> Result<&'static str, String> {
    match lang.trim().to_ascii_lowercase().as_str() {
        "powershell" | "ps1" | "ps" => Ok("powershell"),
        "python" | "py" => Ok("python"),
        other => Err(format!(
            "Ngôn ngữ '{other}' chưa được hỗ trợ (chỉ hỗ trợ 'powershell' hoặc 'python')."
        )),
    }
}

pub fn sanitize_skill_id(raw: &str) -> String {
    let mut slug = String::with_capacity(48);
    let mut prev_underscore = false;
    for ch in raw.trim().to_ascii_lowercase().chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch);
            prev_underscore = false;
        } else if !prev_underscore && !slug.is_empty() {
            slug.push('_');
            prev_underscore = true;
        }
        if slug.len() >= 48 {
            break;
        }
    }
    while slug.ends_with('_') {
        slug.pop();
    }
    if slug.is_empty() {
        "custom_skill".to_string()
    } else {
        slug
    }
}

pub fn compute_code_hash(language: &str, code: &str) -> String {
    let norm_lang = language.trim().to_ascii_lowercase();
    let norm_code = code.replace("\r\n", "\n");
    let mut hash: u64 = 0xcbf29ce484222325;
    for b in norm_lang.as_bytes() {
        hash ^= *b as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash ^= b':' as u64;
    hash = hash.wrapping_mul(0x100000001b3);
    for b in norm_code.as_bytes() {
        hash ^= *b as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

fn contains_dotenv_reference(lower: &str) -> bool {
    let bytes = lower.as_bytes();
    for (idx, _) in lower.match_indices(".env") {
        let after = bytes.get(idx + 4).copied();
        let is_ident_cont = matches!(after, Some(b) if b.is_ascii_alphanumeric() || b == b'_');
        if !is_ident_cont {
            return true;
        }
    }
    false
}

pub fn audit_script_safety(language: &str, code: &str) -> Vec<String> {
    let mut issues = Vec::new();
    if let Err(err) = normalize_language(language) {
        issues.push(err);
        return issues;
    }
    if code.trim().is_empty() {
        issues.push("Mã nguồn script đang trống.".to_string());
        return issues;
    }
    if code.len() > 32_768 {
        issues.push("Mã nguồn vượt quá giới hạn an toàn 32 KB.".to_string());
        return issues;
    }

    let lower = code.to_ascii_lowercase();
    let blocked_patterns: &[(&str, &str)] = &[
        ("format-volume", "Chặn lệnh format ổ đĩa (format-volume)"),
        ("clear-disk", "Chặn lệnh xóa phân vùng đĩa (clear-disk)"),
        ("bcdedit", "Chặn chỉnh sửa cấu hình boot Windows (bcdedit)"),
        ("vssadmin delete", "Chặn xóa Shadow Copy hệ thống (vssadmin delete)"),
        ("cipher /w", "Chặn ghi đè ổ đĩa (cipher /w)"),
        ("rm -rf /", "Chặn xóa đệ quy thư mục gốc"),
        ("del /f /s /q c:\\", "Chặn xóa hàng loạt file trên ổ C:"),
        ("rd /s /q c:\\", "Chặn xóa hàng loạt thư mục trên ổ C:"),
        ("remove-item -recurse -force c:\\", "Chặn Remove-Item -Recurse trên ổ C:"),
        ("shutdown /s", "Chặn lệnh tắt nguồn máy tính (shutdown /s)"),
        ("shutdown -s", "Chặn lệnh tắt nguồn máy tính (shutdown -s)"),
        ("restart-computer", "Chặn lệnh khởi động lại máy tính (restart-computer)"),
        ("set-mppreference", "Chặn thay đổi cấu hình Windows Defender"),
        ("disablerealtimemonitoring", "Chặn tắt bảo vệ thời gian thực Defender"),
        ("net user /add", "Chặn tạo tài khoản hệ thống mới"),
        ("schtasks /create", "Chặn tự cài tác vụ nền hệ thống (schtasks)"),
        ("reg delete hklm", "Chặn xóa Registry HKLM"),
        ("invoke-expression", "Chặn thực thi động Invoke-Expression"),
        ("iex(", "Chặn alias thực thi động iex("),
        ("iex (", "Chặn alias thực thi động iex ("),
        ("mimikatz", "Chặn công cụ trích xuất thông tin xác thực"),
        ("gemini_api_key", "Chặn truy cập biến bí mật GEMINI_API_KEY"),
        ("vite_gemini_api_key", "Chặn truy cập biến bí mật VITE_GEMINI_API_KEY"),
        ("mate_memory.db", "Chặn đọc ghi trực tiếp file CSDL nội bộ"),
    ];

    for (pat, reason) in blocked_patterns {
        if lower.contains(pat) {
            issues.push((*reason).to_string());
        }
    }
    if contains_dotenv_reference(&lower) {
        issues.push("Chặn đọc file cấu hình bí mật .env".to_string());
    }
    issues
}

fn read_pipe_capped<R: Read + Send + 'static>(pipe: Option<R>) -> std::thread::JoinHandle<String> {
    std::thread::spawn(move || {
        let Some(mut reader) = pipe else {
            return String::new();
        };
        let mut buf = Vec::with_capacity(4096);
        let mut chunk = [0u8; 2048];
        while let Ok(n) = reader.read(&mut chunk) {
            if n == 0 {
                break;
            }
            let remaining = MAX_CAPTURE_BYTES.saturating_sub(buf.len());
            if remaining == 0 {
                break;
            }
            buf.extend_from_slice(&chunk[..n.min(remaining)]);
        }
        String::from_utf8_lossy(&buf).to_string()
    })
}

pub fn run_script_isolated(
    language: &str,
    code: &str,
    args_json: &str,
    sandbox_mode: bool,
    timeout_secs: u64,
) -> SandboxRunResult {
    let started = Instant::now();
    let norm_lang = match normalize_language(language) {
        Ok(l) => l,
        Err(msg) => {
            return SandboxRunResult {
                verified: false,
                static_safe: false,
                safety_issues: vec![msg.clone()],
                exit_code: -1,
                timed_out: false,
                duration_ms: 0,
                stdout: String::new(),
                stderr: String::new(),
                code_hash: compute_code_hash(language, code),
                failure_reason: msg,
            };
        }
    };

    let code_hash = compute_code_hash(norm_lang, code);
    let safety_issues = audit_script_safety(norm_lang, code);
    if !safety_issues.is_empty() {
        let reason = format!(
            "Kiểm tra an toàn thất bại: {}",
            safety_issues.join("; ")
        );
        return SandboxRunResult {
            verified: false,
            static_safe: false,
            safety_issues,
            exit_code: -1,
            timed_out: false,
            duration_ms: 0,
            stdout: String::new(),
            stderr: String::new(),
            code_hash,
            failure_reason: reason,
        };
    }

    static SANDBOX_RUN_SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
    let seq = SANDBOX_RUN_SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let run_id = format!("run_{nanos}_{}_{}", std::process::id(), seq);
    let sandbox_root = std::env::temp_dir().join("duck_skill_sandbox");
    let sandbox_dir = sandbox_root.join(run_id);
    if let Err(e) = std::fs::create_dir_all(&sandbox_dir) {
        return SandboxRunResult {
            verified: false,
            static_safe: true,
            safety_issues,
            exit_code: -1,
            timed_out: false,
            duration_ms: 0,
            stdout: String::new(),
            stderr: String::new(),
            code_hash,
            failure_reason: format!("Không thể tạo thư mục sandbox tạm: {e}"),
        };
    }

    let clean_args = if args_json.trim().is_empty() {
        "{}"
    } else {
        args_json.trim()
    };
    let args_path = sandbox_dir.join("args.json");
    let _ = std::fs::write(&args_path, clean_args.as_bytes());

    let mut cmd = if norm_lang == "powershell" {
        let script_path = sandbox_dir.join("script.ps1");
        let ps_body = format!(
            "\u{FEFF}$OutputEncoding = [System.Text.UTF8Encoding]::new($false)\r\n[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)\r\n$ErrorActionPreference = 'Stop'\r\n{}\r\n",
            code.replace("\r\n", "\n").replace('\n', "\r\n")
        );
        if let Err(e) = std::fs::write(&script_path, ps_body.as_bytes()) {
            let _ = std::fs::remove_dir_all(&sandbox_dir);
            return SandboxRunResult {
                verified: false,
                static_safe: true,
                safety_issues,
                exit_code: -1,
                timed_out: false,
                duration_ms: 0,
                stdout: String::new(),
                stderr: String::new(),
                code_hash,
                failure_reason: format!("Không thể ghi script PowerShell vào sandbox: {e}"),
            };
        }
        let mut c = Command::new("powershell.exe");
        c.args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
        ]);
        c.arg(&script_path);
        c
    } else {
        let script_path = sandbox_dir.join("script.py");
        if let Err(e) = std::fs::write(&script_path, code.as_bytes()) {
            let _ = std::fs::remove_dir_all(&sandbox_dir);
            return SandboxRunResult {
                verified: false,
                static_safe: true,
                safety_issues,
                exit_code: -1,
                timed_out: false,
                duration_ms: 0,
                stdout: String::new(),
                stderr: String::new(),
                code_hash,
                failure_reason: format!("Không thể ghi script Python vào sandbox: {e}"),
            };
        }
        let mut c = Command::new("python");
        c.arg("-I");
        c.arg(&script_path);
        c.env("PYTHONIOENCODING", "utf-8");
        c
    };

    apply_no_window(&mut cmd);
    cmd.current_dir(&sandbox_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env_remove("GEMINI_API_KEY")
        .env_remove("VITE_GEMINI_API_KEY")
        .env("DUCK_SANDBOX_MODE", if sandbox_mode { "1" } else { "0" })
        .env("DUCK_SANDBOX_DIR", sandbox_dir.to_string_lossy().as_ref())
        .env("DUCK_TOOL_ARGS_JSON", clean_args)
        .env("DUCK_TOOL_ARGS_FILE", args_path.to_string_lossy().as_ref());

    let spawn_res = cmd.spawn();
    let mut child = match spawn_res {
        Ok(ch) => ch,
        Err(e) => {
            let _ = std::fs::remove_dir_all(&sandbox_dir);
            return SandboxRunResult {
                verified: false,
                static_safe: true,
                safety_issues,
                exit_code: -1,
                timed_out: false,
                duration_ms: started.elapsed().as_millis() as i64,
                stdout: String::new(),
                stderr: String::new(),
                code_hash,
                failure_reason: format!("Không thể khởi chạy tiến trình {norm_lang}: {e}"),
            };
        }
    };

    let out_handle = read_pipe_capped(child.stdout.take());
    let err_handle = read_pipe_capped(child.stderr.take());

    let limit = Duration::from_secs(timeout_secs.clamp(3, 25));
    let mut timed_out = false;
    let mut exit_code = -1i32;

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                exit_code = status.code().unwrap_or(-1);
                break;
            }
            Ok(None) => {
                if started.elapsed() >= limit {
                    timed_out = true;
                    let _ = child.kill();
                    let _ = child.wait();
                    break;
                }
                std::thread::sleep(Duration::from_millis(40));
            }
            Err(_) => {
                break;
            }
        }
    }

    let stdout = out_handle.join().unwrap_or_default();
    let stderr = err_handle.join().unwrap_or_default();
    let _ = std::fs::remove_dir_all(&sandbox_dir);

    let duration_ms = started.elapsed().as_millis() as i64;
    let mut failure_reason = String::new();
    let verified = if timed_out {
        failure_reason = format!("Quá thời gian thực thi Sandbox ({}s).", limit.as_secs());
        false
    } else if exit_code != 0 {
        let err_snippet = stderr.trim();
        failure_reason = if err_snippet.is_empty() {
            format!("Script thoát với mã lỗi {exit_code}.")
        } else {
            format!(
                "Lỗi thực thi (exit {exit_code}): {}",
                err_snippet.chars().take(260).collect::<String>()
            )
        };
        false
    } else if stdout.trim().is_empty() {
        failure_reason = "Script chạy xong (exit 0) nhưng không in kết quả ra stdout để kiểm chứng.".to_string();
        false
    } else {
        true
    };

    SandboxRunResult {
        verified,
        static_safe: true,
        safety_issues,
        exit_code,
        timed_out,
        duration_ms,
        stdout: stdout.trim().to_string(),
        stderr: stderr.trim().to_string(),
        code_hash,
        failure_reason,
    }
}

pub fn verify_and_record_sandbox(
    receipts: &Mutex<HashMap<String, SandboxRunResult>>,
    language: &str,
    code: &str,
    test_args_json: &str,
    expected_keywords: &[String],
) -> SandboxRunResult {
    let mut res = run_script_isolated(language, code, test_args_json, true, 15);
    if res.verified && !expected_keywords.is_empty() {
        let lower_out = res.stdout.to_ascii_lowercase();
        let mut missing = Vec::new();
        for kw in expected_keywords {
            let trimmed = kw.trim();
            if trimmed.is_empty() {
                continue;
            }
            if !lower_out.contains(&trimmed.to_ascii_lowercase()) {
                missing.push(trimmed.to_string());
            }
        }
        if !missing.is_empty() {
            res.verified = false;
            res.failure_reason = format!(
                "Đầu ra Sandbox thiếu từ khóa kiểm chứng: {}",
                missing.join(", ")
            );
        }
    }

    if res.verified {
        if let Ok(mut guard) = receipts.lock() {
            guard.insert(res.code_hash.clone(), res.clone());
        }
    }
    res
}

pub fn verify_receipt_for_hash(
    receipts: &Mutex<HashMap<String, SandboxRunResult>>,
    language: &str,
    code: &str,
) -> Result<SandboxRunResult, String> {
    let norm_lang = normalize_language(language)?;
    let issues = audit_script_safety(norm_lang, code);
    if !issues.is_empty() {
        return Err(format!("Chặn đóng gói vì vi phạm an toàn: {}", issues.join("; ")));
    }
    let actual_hash = compute_code_hash(norm_lang, code);
    let guard = receipts
        .lock()
        .map_err(|_| "Lỗi khóa hàng đợi kiểm chứng Sandbox".to_string())?;
    let Some(receipt) = guard.get(&actual_hash) else {
        return Err(
            "Chỉ đóng gói khi có kiểm chứng: Mã nguồn hiện tại chưa vượt qua bài test Sandbox (hoặc vừa bị chỉnh sửa)."
                .to_string(),
        );
    };
    if !receipt.verified || !receipt.static_safe {
        return Err("Chỉ đóng gói khi có kiểm chứng: Kết quả kiểm nghiệm Sandbox chưa đạt.".to_string());
    }
    Ok(receipt.clone())
}

fn write_packaged_skill_files(skills_root: &Path, rec: &CustomSkillRecord) {
    let skill_dir = skills_root.join(&rec.id);
    if std::fs::create_dir_all(&skill_dir).is_err() {
        return;
    }
    let ext = if rec.language == "python" { "py" } else { "ps1" };
    let script_file = skill_dir.join(format!("script.{ext}"));
    let _ = std::fs::write(&script_file, rec.code.as_bytes());
    let manifest_file = skill_dir.join("manifest.json");
    if let Ok(json) = serde_json::to_string_pretty(rec) {
        let _ = std::fs::write(&manifest_file, json.as_bytes());
    }
}

#[tauri::command]
pub fn tool_forge_run_sandbox(
    forge_state: State<'_, ToolForgeState>,
    language: String,
    code: String,
    test_args_json: String,
    expected_keywords: Vec<String>,
) -> SandboxRunResult {
    verify_and_record_sandbox(
        &forge_state.verified_receipts,
        &language,
        &code,
        &test_args_json,
        &expected_keywords,
    )
}

#[tauri::command]
pub fn tool_forge_save_skill(
    mem_state: State<'_, MemoryState>,
    forge_state: State<'_, ToolForgeState>,
    payload: SaveSkillPayload,
) -> Result<CustomSkillRecord, String> {
    let norm_lang = normalize_language(&payload.language)?.to_string();
    let receipt = verify_receipt_for_hash(&forge_state.verified_receipts, &norm_lang, &payload.code)?;
    let actual_hash = receipt.code_hash.clone();
    if !payload.code_hash.trim().is_empty() && payload.code_hash.trim() != actual_hash {
        return Err("Chỉ đóng gói khi có kiểm chứng: Hash mã nguồn không khớp kết quả Sandbox.".to_string());
    }

    let skill_id = sanitize_skill_id(&payload.id);
    let existing = db_get_custom_skill(&mem_state, &skill_id);
    let next_version = existing.as_ref().map(|e| e.version + 1).unwrap_or(1);
    let usage_count = existing.as_ref().map(|e| e.usage_count).unwrap_or(0);
    let heal_count = existing.as_ref().map(|e| e.heal_count).unwrap_or(0);
    let created_at = existing.as_ref().map(|e| e.created_at).unwrap_or(0);

    let rec = CustomSkillRecord {
        id: skill_id,
        name: if payload.name.trim().is_empty() {
            "Skill Tùy Chỉnh".to_string()
        } else {
            payload.name.trim().to_string()
        },
        description: payload.description.trim().to_string(),
        language: norm_lang,
        triggers_json: if payload.triggers_json.trim().is_empty() {
            "[]".to_string()
        } else {
            payload.triggers_json.trim().to_string()
        },
        params_schema_json: if payload.params_schema_json.trim().is_empty() {
            "[]".to_string()
        } else {
            payload.params_schema_json.trim().to_string()
        },
        code: payload.code,
        test_args_json: if payload.test_args_json.trim().is_empty() {
            "{}".to_string()
        } else {
            payload.test_args_json.trim().to_string()
        },
        expected_keywords_json: if payload.expected_keywords_json.trim().is_empty() {
            "[]".to_string()
        } else {
            payload.expected_keywords_json.trim().to_string()
        },
        version: next_version,
        verified: true,
        code_hash: actual_hash,
        last_test_output: receipt.stdout.chars().take(1200).collect(),
        last_test_ms: receipt.duration_ms,
        usage_count,
        heal_count,
        last_heal_note: payload.heal_note.unwrap_or_default(),
        enabled: true,
        created_at,
        updated_at: 0,
    };

    db_upsert_custom_skill(&mem_state, &rec)?;
    write_packaged_skill_files(&skills_storage_dir(&mem_state), &rec);
    Ok(db_get_custom_skill(&mem_state, &rec.id).unwrap_or(rec))
}

#[tauri::command]
pub fn tool_forge_list_skills(mem_state: State<'_, MemoryState>) -> Vec<CustomSkillRecord> {
    db_list_custom_skills(&mem_state)
}

#[tauri::command]
pub fn tool_forge_delete_skill(
    mem_state: State<'_, MemoryState>,
    id: String,
) -> Result<(), String> {
    let clean_id = sanitize_skill_id(&id);
    db_delete_custom_skill(&mem_state, &clean_id)?;
    let skill_dir = skills_storage_dir(&mem_state).join(&clean_id);
    if skill_dir.exists() {
        let _ = std::fs::remove_dir_all(&skill_dir);
    }
    Ok(())
}

#[tauri::command]
pub fn tool_forge_toggle_skill(
    mem_state: State<'_, MemoryState>,
    id: String,
    enabled: bool,
) -> Result<(), String> {
    let clean_id = sanitize_skill_id(&id);
    db_toggle_custom_skill(&mem_state, &clean_id, enabled)
}

#[tauri::command]
pub async fn tool_forge_execute_skill(
    mem_state: State<'_, MemoryState>,
    id: String,
    args_json: String,
) -> Result<SkillExecResult, String> {
    let clean_id = sanitize_skill_id(&id);
    let skill = db_get_custom_skill(&mem_state, &clean_id)
        .ok_or_else(|| format!("Không tìm thấy skill '{clean_id}' trong SQLite."))?;

    if !skill.enabled {
        return Err(format!("Skill '{}' đang bị tắt.", skill.name));
    }
    if !skill.verified {
        return Err(format!("Skill '{}' chưa được kiểm chứng Sandbox.", skill.name));
    }
    let issues = audit_script_safety(&skill.language, &skill.code);
    if !issues.is_empty() {
        return Err(format!("Skill bị chặn vì an toàn: {}", issues.join("; ")));
    }

    let lang = skill.language.clone();
    let code = skill.code.clone();
    let sid = skill.id.clone();

    let run = tauri::async_runtime::spawn_blocking(move || {
        run_script_isolated(&lang, &code, &args_json, false, 20)
    })
    .await
    .map_err(|e| format!("Lỗi chạy tác vụ skill: {e}"))?;

    let ok = run.static_safe && !run.timed_out && run.exit_code == 0;
    if ok {
        db_increment_skill_usage(&mem_state, &sid);
    }

    Ok(SkillExecResult {
        ok,
        skill_id: sid,
        exit_code: run.exit_code,
        timed_out: run.timed_out,
        duration_ms: run.duration_ms,
        stdout: run.stdout,
        stderr: run.stderr,
        error_summary: if ok { String::new() } else { run.failure_reason },
    })
}

#[tauri::command]
pub async fn tool_forge_apply_healed_skill(
    mem_state: State<'_, MemoryState>,
    forge_state: State<'_, ToolForgeState>,
    id: String,
    patched_code: String,
    heal_note: String,
    test_args_json: String,
    expected_keywords: Vec<String>,
) -> Result<(CustomSkillRecord, SandboxRunResult), String> {
    let clean_id = sanitize_skill_id(&id);
    let mut skill = db_get_custom_skill(&mem_state, &clean_id)
        .ok_or_else(|| format!("Không tìm thấy skill '{clean_id}' để tự vá."))?;

    let lang = skill.language.clone();
    let code_clone = patched_code.clone();
    let args_to_use = if test_args_json.trim().is_empty() {
        skill.test_args_json.clone()
    } else {
        test_args_json
    };
    let kws_to_use = if expected_keywords.is_empty() {
        serde_json::from_str::<Vec<String>>(&skill.expected_keywords_json).unwrap_or_default()
    } else {
        expected_keywords
    };

    let sandbox_res = tauri::async_runtime::spawn_blocking(move || {
        run_script_isolated(&lang, &code_clone, &args_to_use, true, 15)
    })
    .await
    .map_err(|e| format!("Lỗi chạy Sandbox khi tự vá skill: {e}"))?;

    let mut final_res = sandbox_res;
    if final_res.verified && !kws_to_use.is_empty() {
        let lower_out = final_res.stdout.to_ascii_lowercase();
        let mut missing = Vec::new();
        for kw in &kws_to_use {
            let trimmed = kw.trim();
            if !trimmed.is_empty() && !lower_out.contains(&trimmed.to_ascii_lowercase()) {
                missing.push(trimmed.to_string());
            }
        }
        if !missing.is_empty() {
            final_res.verified = false;
            final_res.failure_reason = format!(
                "Bản vá chưa đạt kiểm chứng Sandbox (thiếu từ khóa: {}).",
                missing.join(", ")
            );
        }
    }

    if !final_res.verified {
        return Err(if final_res.failure_reason.is_empty() {
            "Bản vá chưa vượt qua kiểm nghiệm Sandbox nên chưa được lưu đè.".to_string()
        } else {
            final_res.failure_reason
        });
    }

    if let Ok(mut guard) = forge_state.verified_receipts.lock() {
        guard.insert(final_res.code_hash.clone(), final_res.clone());
    }

    skill.code = patched_code;
    skill.code_hash = final_res.code_hash.clone();
    skill.verified = true;
    skill.version += 1;
    skill.heal_count += 1;
    skill.last_heal_note = heal_note.trim().to_string();
    skill.last_test_output = final_res.stdout.chars().take(1200).collect();
    skill.last_test_ms = final_res.duration_ms;

    db_upsert_custom_skill(&mem_state, &skill)?;
    write_packaged_skill_files(&skills_storage_dir(&mem_state), &skill);
    let refreshed = db_get_custom_skill(&mem_state, &clean_id).unwrap_or(skill);
    Ok((refreshed, final_res))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_safety_audit_blocks_dangerous_and_secret_access() {
        let issues_disk = audit_script_safety("powershell", "Format-Volume -DriveLetter D");
        assert!(!issues_disk.is_empty(), "Expected destructive disk command to be blocked");

        let issues_env = audit_script_safety("powershell", "Get-Content .env");
        assert!(!issues_env.is_empty(), "Expected .env secret read to be blocked");

        let issues_py_env = audit_script_safety("python", "open('.env').read()");
        assert!(!issues_py_env.is_empty(), "Expected Python open('.env') to be blocked");

        let issues_py_environ = audit_script_safety(
            "python",
            "import os, json\nprint(os.environ.get('DUCK_TOOL_ARGS_JSON', '{}'))",
        );
        assert!(
            issues_py_environ.is_empty(),
            "Python os.environ.get must NOT false-positive on .env: {:?}",
            issues_py_environ
        );

        let issues_db = audit_script_safety("python", "open('mate_memory.db', 'rb')");
        assert!(!issues_db.is_empty(), "Expected direct DB access to be blocked");

        let issues_ok = audit_script_safety(
            "powershell",
            "$a = $env:DUCK_TOOL_ARGS_JSON | ConvertFrom-Json; Write-Output 'OK'",
        );
        assert!(issues_ok.is_empty(), "Safe script should pass audit: {:?}", issues_ok);
    }

    #[test]
    fn test_sandbox_runs_real_powershell_and_scrubs_secrets() {
        let code = r#"
$raw = $env:DUCK_TOOL_ARGS_JSON
$argsObj = $raw | ConvertFrom-Json
$k = ('GEMINI' + '_API_KEY')
$hasSecret = [string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($k))
Write-Output ("SANDBOX=" + $env:DUCK_SANDBOX_MODE + "|PORT=" + $argsObj.port + "|SCRUBBED=" + $hasSecret)
"#;
        let state = ToolForgeState::new();
        let res = verify_and_record_sandbox(
            &state.verified_receipts,
            "powershell",
            code,
            r#"{"port":59999}"#,
            &["PORT=59999".to_string(), "SCRUBBED=True".to_string()],
        );
        assert!(res.verified, "Sandbox should verify clean PowerShell run: {:?}", res);
        assert_eq!(res.exit_code, 0);
        assert!(res.stdout.contains("SANDBOX=1|PORT=59999|SCRUBBED=True"));
    }

    #[test]
    fn test_sandbox_timeout_kills_runaway_script() {
        let code = "Start-Sleep -Seconds 15; Write-Output 'DONE'";
        let res = run_script_isolated("powershell", code, "{}", true, 3);
        assert!(!res.verified);
        assert!(res.timed_out, "Long sleeping script should be killed on timeout");
    }

    #[test]
    fn test_verification_gate_rejects_unverified_hash() {
        let state = ToolForgeState::new();
        let code_v1 = "Write-Output 'VERIFIED_PORT_CHECK'";
        let res = verify_and_record_sandbox(
            &state.verified_receipts,
            "powershell",
            code_v1,
            "{}",
            &["VERIFIED_PORT_CHECK".to_string()],
        );
        assert!(res.verified);

        assert!(verify_receipt_for_hash(&state.verified_receipts, "powershell", code_v1).is_ok());

        let tampered = "Write-Output 'UNVERIFIED_EDIT'";
        let gate_err = verify_receipt_for_hash(&state.verified_receipts, "powershell", tampered);
        assert!(gate_err.is_err(), "Tampered/unverified code must fail hard packaging gate");
    }
}
