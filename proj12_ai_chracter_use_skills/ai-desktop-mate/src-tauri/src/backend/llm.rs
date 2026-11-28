use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::Instant;
use tauri::Emitter;

use crate::backend::telemetry::apply_no_window;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OllamaMessage {
    pub role: String,
    pub content: String,
}

static OLLAMA_CACHE: Mutex<Option<(Vec<String>, Instant)>> = Mutex::new(None);

fn is_placeholder_secret(val: &str) -> bool {
    let t = val.trim();
    t.is_empty()
        || t.eq_ignore_ascii_case("your_gemini_api_key_here")
        || t.to_ascii_lowercase().starts_with("your_")
}

fn env_candidate_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            paths.push(dir.join(".env"));
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        let p = cwd.join(".env");
        if !paths.contains(&p) {
            paths.push(p);
        }
        let sub = cwd.join("ai-desktop-mate").join(".env");
        if !paths.contains(&sub) {
            paths.push(sub);
        }
    }
    if let Some(root) = PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent() {
        let p = root.join(".env");
        if !paths.contains(&p) {
            paths.push(p);
        }
        if let Some(ws_root) = root.parent() {
            let wp = ws_root.join(".env");
            if !paths.contains(&wp) {
                paths.push(wp);
            }
        }
    }
    paths
}

fn writable_env_path() -> PathBuf {
    if let Some(root) = PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent() {
        if root.exists() {
            return root.join(".env");
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            return dir.join(".env");
        }
    }
    PathBuf::from(".env")
}

pub fn read_env_value(key: &str) -> Option<String> {
    if let Ok(v) = std::env::var(key) {
        if !is_placeholder_secret(&v) {
            return Some(v.trim().to_string());
        }
    }
    for path in env_candidate_paths() {
        let Ok(content) = std::fs::read_to_string(&path) else {
            continue;
        };
        for raw_line in content.lines() {
            let line = raw_line.trim_start_matches('\u{FEFF}').trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            let cleaned_line = line.strip_prefix("export ").map(|s| s.trim()).unwrap_or(line);
            let Some((k, v)) = cleaned_line.split_once('=') else {
                continue;
            };
            if k.trim() != key {
                continue;
            }
            let mut val = v.trim().to_string();
            if (val.starts_with('"') && val.ends_with('"') && val.len() >= 2)
                || (val.starts_with('\'') && val.ends_with('\'') && val.len() >= 2)
            {
                val = val[1..val.len() - 1].to_string();
            }
            if !is_placeholder_secret(&val) {
                return Some(val.trim().to_string());
            }
        }
    }
    None
}

pub fn write_env_value(key: &str, value: &str) -> Result<String, String> {
    let target = writable_env_path();
    if let Some(parent) = target.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let clean_val = value.replace(['\r', '\n'], "").trim().to_string();
    let existing = std::fs::read_to_string(&target).unwrap_or_default();
    let mut lines: Vec<String> = Vec::new();
    let mut replaced = false;

    for raw_line in existing.lines() {
        let trimmed = raw_line.trim_start_matches('\u{FEFF}').trim();
        let cleaned_line = trimmed
            .strip_prefix("export ")
            .map(|s| s.trim())
            .unwrap_or(trimmed);
        if !trimmed.is_empty() && !trimmed.starts_with('#') {
            if let Some((k, _)) = cleaned_line.split_once('=') {
                if k.trim() == key {
                    lines.push(format!("{key}={clean_val}"));
                    replaced = true;
                    continue;
                }
            }
        }
        lines.push(raw_line.to_string());
    }

    if !replaced {
        if lines.is_empty() {
            lines.push("# Local environment variables (gitignored - NEVER commit to Git)".to_string());
        }
        lines.push(format!("{key}={clean_val}"));
    }

    let mut out = lines.join("\n");
    if !out.ends_with('\n') {
        out.push('\n');
    }
    std::fs::write(&target, out).map_err(|e| format!("Không thể ghi file .env: {e}"))?;
    Ok(target.to_string_lossy().to_string())
}

pub fn resolve_gemini_api_key(override_key: &str) -> String {
    let trimmed = override_key.trim();
    if !is_placeholder_secret(trimmed) {
        return trimmed.to_string();
    }
    if let Some(v) = read_env_value("GEMINI_API_KEY") {
        return v;
    }
    if let Some(v) = read_env_value("VITE_GEMINI_API_KEY") {
        return v;
    }
    String::new()
}

#[tauri::command]
pub fn save_gemini_api_key_env(api_key: String) -> Result<String, String> {
    let _path = write_env_value("GEMINI_API_KEY", api_key.trim())?;
    Ok("[SUCCESS] Đã lưu GEMINI_API_KEY vào file .env (an toàn, không lưu trong SQLite/Git).".to_string())
}

pub fn get_installed_ollama_models() -> Result<Vec<String>, String> {
    if let Ok(guard) = OLLAMA_CACHE.lock() {
        if let Some((models, last_checked)) = guard.as_ref() {
            if last_checked.elapsed().as_secs() < 60 && !models.is_empty() {
                return Ok(models.clone());
            }
        }
    }

    let urls = ["http://127.0.0.1:11434/api/tags", "http://localhost:11434/api/tags"];
    for u in urls {
        let mut cmd = Command::new("curl.exe");
        cmd.args(["-s", "-m", "3", "-X", "GET", u]);
        apply_no_window(&mut cmd);
        if let Ok(out) = cmd.output() {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout);
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(text.trim()) {
                    let mut list = Vec::new();
                    if let Some(arr) = v["models"].as_array() {
                        for item in arr {
                            if let Some(name) = item["name"].as_str() {
                                list.push(name.to_string());
                            }
                        }
                    }
                    if !list.is_empty() {
                        if let Ok(mut guard) = OLLAMA_CACHE.lock() {
                            *guard = Some((list.clone(), Instant::now()));
                        }
                        return Ok(list);
                    }
                }
            }
        }
    }
    Err("Không tìm thấy model nào từ Ollama".to_string())
}

fn post_ollama_json(url: &str, payload_str: String, timeout_secs: &str) -> Result<serde_json::Value, String> {
    // Thử gửi tới URL chỉ định, nếu là loopback 127.0.0.1 bị từ chối thì tự động thử localhost
    let urls_to_try = if url.contains("127.0.0.1:11434") {
        vec![url.to_string(), url.replace("127.0.0.1:11434", "localhost:11434")]
    } else if url.contains("localhost:11434") {
        vec![url.to_string(), url.replace("localhost:11434", "127.0.0.1:11434")]
    } else {
        vec![url.to_string()]
    };

    let mut last_err = String::new();
    for target_url in urls_to_try {
        let mut cmd = Command::new("curl.exe");
        cmd.args([
            "-s",
            "-m",
            timeout_secs,
            "-X",
            "POST",
            &target_url,
            "-H",
            "Content-Type: application/json",
            "--data-binary",
            "@-",
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
        apply_no_window(&mut cmd);

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                last_err = format!("Không thể gọi curl: {e}");
                continue;
            }
        };

        if let Some(mut stdin) = child.stdin.take() {
            if let Err(e) = stdin.write_all(payload_str.as_bytes()) {
                last_err = format!("Lỗi gửi dữ liệu: {e}");
                continue;
            }
        }

        let output = match child.wait_with_output() {
            Ok(o) => o,
            Err(e) => {
                last_err = format!("Lỗi chờ phản hồi: {e}");
                continue;
            }
        };

        if !output.status.success() {
            last_err = "API AI không phản hồi (kiểm tra kết nối hoặc Ollama).".to_string();
            continue;
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let v: serde_json::Value = match serde_json::from_str(stdout.trim()) {
            Ok(val) => val,
            Err(_) => {
                last_err = "Không thể đọc JSON phản hồi từ AI endpoint.".to_string();
                continue;
            }
        };

        if let Some(err_obj) = v["error"]["message"].as_str() {
            return Err(format!("Gemini API báo lỗi: {err_obj}"));
        }
        if let Some(err_msg) = v["error"].as_str() {
            return Err(format!("Ollama báo lỗi: {err_msg}"));
        }
        return Ok(v);
    }

    Err(last_err)
}

#[tauri::command]
pub async fn list_ollama_models() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        get_installed_ollama_models()
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

fn resolve_ollama_model(model: &str) -> String {
    if let Ok(installed) = get_installed_ollama_models() {
        if installed.is_empty() {
            model.to_string()
        } else if installed.contains(&model.to_string()) {
            model.to_string()
        } else {
            let prefix = model.split(':').next().unwrap_or(model);
            if let Some(matched) = installed.iter().find(|m| m.starts_with(prefix)) {
                matched.clone()
            } else {
                installed[0].clone()
            }
        }
    } else {
        model.to_string()
    }
}

fn get_optimal_cpu_threads() -> usize {
    std::thread::available_parallelism()
        .map(|n| (n.get().saturating_sub(1)).max(2).min(12))
        .unwrap_or(4)
}

#[tauri::command]
pub async fn ask_ollama(model: String, messages: Vec<OllamaMessage>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let target_model = resolve_ollama_model(&model);
        let num_threads = get_optimal_cpu_threads();

        let payload = serde_json::json!({
            "model": target_model,
            "messages": messages,
            "stream": false,
            "options": {
                "temperature": 0.65,
                "num_predict": 650,
                "num_ctx": 4096,
                "num_thread": num_threads
            }
        });
        let v = post_ollama_json("http://127.0.0.1:11434/api/chat", payload.to_string(), "45")?;
        let content = v["message"]["content"]
            .as_str()
            .ok_or_else(|| "Phản hồi Ollama không có nội dung".to_string())?;

        Ok(content.trim().to_string())
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

#[tauri::command]
pub async fn ask_ollama_stream(
    window: tauri::Window,
    model: String,
    messages: Vec<OllamaMessage>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let target_model = resolve_ollama_model(&model);
        let num_threads = get_optimal_cpu_threads();

        let payload = serde_json::json!({
            "model": target_model,
            "messages": messages,
            "stream": true,
            "options": {
                "temperature": 0.65,
                "num_predict": 650,
                "num_ctx": 4096,
                "num_thread": num_threads
            }
        });
        let payload_str = payload.to_string();

        let urls_to_try = [
            "http://127.0.0.1:11434/api/chat",
            "http://localhost:11434/api/chat",
        ];

        let mut last_err = String::new();
        for target_url in urls_to_try {
            let mut cmd = Command::new("curl.exe");
            cmd.args([
                "-N",
                "-s",
                "-m",
                "45",
                "-X",
                "POST",
                target_url,
                "-H",
                "Content-Type: application/json",
                "--data-binary",
                "@-",
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
            apply_no_window(&mut cmd);

            let mut child = match cmd.spawn() {
                Ok(c) => c,
                Err(e) => {
                    last_err = format!("Không thể gọi curl: {e}");
                    continue;
                }
            };

            if let Some(mut stdin) = child.stdin.take() {
                let _ = stdin.write_all(payload_str.as_bytes());
            }

            let Some(stdout) = child.stdout.take() else {
                last_err = "Không mở được luồng đọc của Ollama".to_string();
                continue;
            };

            let reader = BufReader::new(stdout);
            let mut full_content = String::new();

            for line_res in reader.lines() {
                let Ok(line) = line_res else { break };
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(trimmed) {
                    if let Some(err_msg) = v["error"].as_str() {
                        return Err(format!("Ollama báo lỗi: {err_msg}"));
                    }
                    if let Some(token) = v["message"]["content"].as_str() {
                        if !token.is_empty() {
                            full_content.push_str(token);
                            let _ = window.emit("llm_stream_token", token);
                        }
                    }
                    if v["done"].as_bool().unwrap_or(false) {
                        break;
                    }
                }
            }

            let _ = child.wait();
            if !full_content.is_empty() {
                return Ok(full_content.trim().to_string());
            }
        }

        Err(if last_err.is_empty() {
            "Ollama không phản hồi dòng stream nào.".to_string()
        } else {
            last_err
        })
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

#[tauri::command]
pub async fn embed_ollama(model: String, text: String) -> Result<Vec<f32>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let payload = serde_json::json!({
            "model": model,
            "prompt": text,
        });
        let v = post_ollama_json(
            "http://127.0.0.1:11434/api/embeddings",
            payload.to_string(),
            "15",
        )?;
        let arr = v["embedding"]
            .as_array()
            .ok_or_else(|| "Không có vector embedding từ Ollama".to_string())?;
        let vec: Vec<f32> = arr
            .iter()
            .filter_map(|x| x.as_f64().map(|f| f as f32))
            .collect();
        if vec.is_empty() {
            return Err("Vector embedding rỗng".to_string());
        }
        Ok(vec)
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

pub fn parse_gemini_candidate_text(v: &serde_json::Value) -> Option<(String, String)> {
    let parts = v["candidates"][0]["content"]["parts"].as_array()?;
    let finish_reason = v["candidates"][0]["finishReason"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let non_thought = parts
        .iter()
        .filter(|p| p["thought"].as_bool() != Some(true))
        .filter_map(|p| p["text"].as_str())
        .collect::<Vec<_>>()
        .join("");
    if !non_thought.trim().is_empty() {
        return Some((non_thought.trim().to_string(), finish_reason));
    }
    let all_joined = parts
        .iter()
        .filter_map(|p| p["text"].as_str())
        .collect::<Vec<_>>()
        .join("");
    if !all_joined.trim().is_empty() {
        Some((all_joined.trim().to_string(), finish_reason))
    } else {
        None
    }
}

#[tauri::command]
pub async fn ask_gemini(
    router: tauri::State<'_, crate::backend::llm_router::RouterState>,
    api_key: String,
    model: String,
    system_prompt: String,
    messages: Vec<OllamaMessage>,
    json_mode: Option<bool>,
    max_output_tokens: Option<u32>,
    thinking_budget: Option<u32>,
) -> Result<String, String> {
    let requested_model = if model.trim().is_empty() {
        "gemini-3.5-flash".to_string()
    } else {
        model.trim().to_string()
    };
    let use_json_mode = json_mode.unwrap_or(false);
    let out_tokens = max_output_tokens
        .unwrap_or(if use_json_mode { 16384 } else { 8192 })
        .clamp(1024, 32768);
    let effective_thinking = thinking_budget.or_else(|| {
        if use_json_mode || max_output_tokens.is_some() {
            Some(2048)
        } else {
            None
        }
    });

    // Route through 9Router Multi-Provider Pool (Gemini multi-key -> Groq -> Cloudflare failover)
    let candidates = router.select_candidates(Some(&requested_model), Some(&api_key));
    if !candidates.is_empty() {
        if let Ok(res) = crate::backend::llm_router::ask_9router(
            router,
            Some(requested_model.clone()),
            Some(api_key.clone()),
            system_prompt.clone(),
            messages.clone(),
            Some(use_json_mode),
            Some(out_tokens),
            effective_thinking,
        )
        .await
        {
            return Ok(res.reply);
        }
    }

    let clean_key = resolve_gemini_api_key(&api_key);
    if clean_key.is_empty() {
        return Err("Chưa cấu hình API Key trong .env hoặc 9Router DPAPI Vault (Studio 3D -> AI & 9Router).".to_string());
    }

    tauri::async_runtime::spawn_blocking(move || {
        let mut contents: Vec<serde_json::Value> = Vec::new();
        for m in messages {
            if m.content.trim().is_empty() {
                continue;
            }
            let role = if m.role == "assistant" { "model" } else { "user" };
            contents.push(serde_json::json!({
                "role": role,
                "parts": [{ "text": m.content }]
            }));
        }
        if contents.is_empty() {
            contents.push(serde_json::json!({
                "role": "user",
                "parts": [{ "text": "Xin chào" }]
            }));
        }

        let temp = if use_json_mode {
            0.2
        } else if max_output_tokens.is_some() {
            0.25
        } else {
            0.65
        };
        let mut gen_map = serde_json::Map::new();
        gen_map.insert("temperature".to_string(), serde_json::json!(temp));
        gen_map.insert("maxOutputTokens".to_string(), serde_json::json!(out_tokens));
        if use_json_mode {
            gen_map.insert(
                "responseMimeType".to_string(),
                serde_json::json!("application/json"),
            );
        }
        if let Some(tb) = effective_thinking {
            gen_map.insert(
                "thinkingConfig".to_string(),
                serde_json::json!({ "thinkingBudget": tb }),
            );
        }
        let gen_config = serde_json::Value::Object(gen_map);

        let payload = serde_json::json!({
            "system_instruction": {
                "parts": [{ "text": system_prompt }]
            },
            "contents": contents,
            "generationConfig": gen_config
        });

        let fallback_payload = serde_json::json!({
            "system_instruction": {
                "parts": [{ "text": system_prompt }]
            },
            "contents": contents,
            "generationConfig": {
                "temperature": 0.25,
                "maxOutputTokens": out_tokens.min(8192)
            }
        });

        let timeout_str = if use_json_mode || out_tokens >= 12000 {
            "95"
        } else {
            "45"
        };

        // Danh sách dự phòng: requested_model -> gemini-3.5-flash -> gemini-2.5-flash -> gemini-2.0-flash
        let mut models_to_try = vec![requested_model.clone()];
        for candidate in ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.0-flash"] {
            if !models_to_try.contains(&candidate.to_string()) {
                models_to_try.push(candidate.to_string());
            }
        }

        let mut last_err = String::new();
        for m in models_to_try {
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                m, clean_key
            );
            match post_ollama_json(&url, payload.to_string(), timeout_str) {
                Ok(v) => {
                    if let Some((text, finish_reason)) = parse_gemini_candidate_text(&v) {
                        if finish_reason == "MAX_TOKENS"
                            && use_json_mode
                            && serde_json::from_str::<serde_json::Value>(&text).is_err()
                        {
                            last_err = format!(
                                "Gemini ({m}) bị cắt ngắn do MAX_TOKENS ({} ký tự).",
                                text.len()
                            );
                            continue;
                        }
                        return Ok(text);
                    }
                    if let Some(err_msg) = v["error"]["message"].as_str() {
                        last_err = format!("Gemini ({m}): {err_msg}");
                    } else {
                        last_err = format!("Gemini ({m}) không trả về nội dung.");
                    }
                    continue;
                }
                Err(e) => {
                    let lower = e.to_lowercase();
                    if lower.contains("api key not valid") || lower.contains("invalid api key") {
                        return Err(e);
                    }
                    if lower.contains("responsemimetype")
                        || lower.contains("mime")
                        || lower.contains("thinking")
                        || lower.contains("unknown name")
                        || lower.contains("maxoutputtokens")
                    {
                        if let Ok(v2) = post_ollama_json(&url, fallback_payload.to_string(), timeout_str) {
                            if let Some((text2, finish2)) = parse_gemini_candidate_text(&v2) {
                                if !(finish2 == "MAX_TOKENS"
                                    && use_json_mode
                                    && serde_json::from_str::<serde_json::Value>(&text2).is_err())
                                {
                                    return Ok(text2);
                                }
                            }
                        }
                    }
                    last_err = e;
                    continue;
                }
            }
        }

        Err(if last_err.is_empty() {
            "Không thể kết nối tới các mô hình Gemini.".to_string()
        } else {
            last_err
        })
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

#[tauri::command]
pub async fn ask_gemini_vision(
    api_key: String,
    model: String,
    prompt: String,
    image_base64: String,
) -> Result<String, String> {
    let clean_key = resolve_gemini_api_key(&api_key);
    if clean_key.is_empty() {
        return Err("Chưa cấu hình GEMINI_API_KEY trong file .env (hoặc trong Studio 3D -> AI & Cảnh Báo).".to_string());
    }
    let requested_model = if model.trim().is_empty() {
        "gemini-3.5-flash".to_string()
    } else {
        model.trim().to_string()
    };
    let clean_img = image_base64.trim().to_string();
    if clean_img.is_empty() {
        return Err("Dữ liệu ảnh trống".to_string());
    }

    tauri::async_runtime::spawn_blocking(move || {
        let payload = serde_json::json!({
            "contents": [{
                "parts": [
                    { "text": prompt },
                    {
                        "inline_data": {
                            "mime_type": "image/png",
                            "data": clean_img
                        }
                    }
                ]
            }],
            "generationConfig": {
                "temperature": 0.4,
                "maxOutputTokens": 2048
            }
        });

        let mut models_to_try = vec![requested_model.clone()];
        for candidate in ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.0-flash"] {
            if !models_to_try.contains(&candidate.to_string()) {
                models_to_try.push(candidate.to_string());
            }
        }

        let mut last_err = String::new();
        for m in models_to_try {
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                m, clean_key
            );
            match post_ollama_json(&url, payload.to_string(), "45") {
                Ok(v) => {
                    if let Some(parts) = v["candidates"][0]["content"]["parts"].as_array() {
                        let joined = parts
                            .iter()
                            .filter_map(|p| p["text"].as_str())
                            .collect::<Vec<_>>()
                            .join("");
                        if !joined.trim().is_empty() {
                            return Ok(joined.trim().to_string());
                        }
                    }
                    if let Some(err_msg) = v["error"]["message"].as_str() {
                        last_err = format!("Gemini Vision ({m}): {err_msg}");
                        let lower = err_msg.to_lowercase();
                        if lower.contains("high demand")
                            || lower.contains("overloaded")
                            || lower.contains("not found")
                            || lower.contains("resource_exhausted")
                            || lower.contains("capacity")
                            || lower.contains("503")
                        {
                            continue;
                        } else {
                            return Err(last_err);
                        }
                    } else {
                        last_err = format!("Gemini Vision ({m}) không trả về nội dung.");
                        continue;
                    }
                }
                Err(e) => {
                    last_err = e;
                    continue;
                }
            }
        }

        Err(if last_err.is_empty() {
            "Không thể kết nối tới các mô hình Gemini Vision.".to_string()
        } else {
            last_err
        })
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ColabCloudConfig {
    pub tunnel_url: String,
    pub default_model: String,
    #[serde(default = "default_colab_temp")]
    pub temperature: f64,
    #[serde(default = "default_colab_ctx")]
    pub num_ctx: i64,
    #[serde(default = "default_colab_keep_alive")]
    pub keep_alive: i64,
    #[serde(default = "default_true_flag")]
    pub enabled: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct ColabScanResult {
    pub online: bool,
    pub tunnel_url: String,
    pub default_model: String,
    pub enabled: bool,
    pub models: Vec<String>,
    pub error: String,
}

fn default_colab_temp() -> f64 {
    0.2
}

fn default_colab_ctx() -> i64 {
    8192
}

fn default_colab_keep_alive() -> i64 {
    -1
}

fn default_true_flag() -> bool {
    true
}

impl Default for ColabCloudConfig {
    fn default() -> Self {
        Self {
            tunnel_url: String::new(),
            default_model: "qwen2.5-coder:14b".to_string(),
            temperature: 0.2,
            num_ctx: 8192,
            keep_alive: -1,
            enabled: true,
        }
    }
}

fn colab_config_candidate_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            paths.push(dir.join("model_local_cloud").join("colab_config.json"));
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        paths.push(cwd.join("model_local_cloud").join("colab_config.json"));
        if let Some(parent) = cwd.parent() {
            paths.push(parent.join("model_local_cloud").join("colab_config.json"));
        }
    }
    if let Some(app_root) = PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent() {
        if let Some(ws_root) = app_root.parent() {
            paths.push(ws_root.join("model_local_cloud").join("colab_config.json"));
        }
    }
    paths
}

fn read_colab_cloud_config() -> ColabCloudConfig {
    let mut cfg = ColabCloudConfig::default();
    for path in colab_config_candidate_paths() {
        if let Ok(raw) = std::fs::read_to_string(&path) {
            if let Ok(parsed) = serde_json::from_str::<ColabCloudConfig>(&raw) {
                cfg = parsed;
                break;
            }
        }
    }
    if let Some(env_url) = read_env_value("COLAB_OLLAMA_URL") {
        cfg.tunnel_url = env_url;
    }
    cfg.tunnel_url = cfg.tunnel_url.trim().trim_end_matches('/').to_string();
    if cfg.default_model.trim().is_empty() {
        cfg.default_model = "qwen2.5-coder:14b".to_string();
    }
    cfg
}

fn scan_colab_sync(cfg: &ColabCloudConfig, custom_url: Option<&str>) -> ColabScanResult {
    let url = custom_url
        .map(|s| s.trim().trim_end_matches('/').to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| cfg.tunnel_url.clone());

    if url.is_empty() {
        return ColabScanResult {
            online: false,
            tunnel_url: String::new(),
            default_model: cfg.default_model.clone(),
            enabled: cfg.enabled,
            models: Vec::new(),
            error: "Chưa cấu hình URL Cloudflare Tunnel.".to_string(),
        };
    }

    let tags_url = format!("{url}/api/tags");
    let mut cmd = Command::new("curl.exe");
    cmd.args(["-sS", "-m", "4", &tags_url]);
    apply_no_window(&mut cmd);

    let out = match cmd.output() {
        Ok(o) => o,
        Err(e) => {
            return ColabScanResult {
                online: false,
                tunnel_url: url,
                default_model: cfg.default_model.clone(),
                enabled: cfg.enabled,
                models: Vec::new(),
                error: format!("Không gọi được curl: {e}"),
            };
        }
    };

    let text = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if !out.status.success() || text.is_empty() {
        return ColabScanResult {
            online: false,
            tunnel_url: url,
            default_model: cfg.default_model.clone(),
            enabled: cfg.enabled,
            models: Vec::new(),
            error: "Colab GPU Tunnel hiện không phản hồi (chưa bật Colab).".to_string(),
        };
    }

    let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) else {
        return ColabScanResult {
            online: false,
            tunnel_url: url,
            default_model: cfg.default_model.clone(),
            enabled: cfg.enabled,
            models: Vec::new(),
            error: "Tunnel trả về HTML/lỗi thay vì Ollama /api/tags (Colab đã ngắt).".to_string(),
        };
    };

    let models: Vec<String> = v["models"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["name"].as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    ColabScanResult {
        online: !models.is_empty(),
        tunnel_url: url,
        default_model: cfg.default_model.clone(),
        enabled: cfg.enabled,
        models: models.clone(),
        error: if models.is_empty() {
            "Tunnel mở nhưng chưa có model nào.".to_string()
        } else {
            String::new()
        },
    }
}

#[tauri::command]
pub async fn colab_cloud_scan(custom_url: Option<String>) -> Result<ColabScanResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let cfg = read_colab_cloud_config();
        scan_colab_sync(&cfg, custom_url.as_deref())
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ quét Colab: {e}"))
}

#[tauri::command]
pub async fn colab_cloud_save_config(
    tunnel_url: String,
    default_model: String,
    enabled: bool,
) -> Result<ColabScanResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut cfg = read_colab_cloud_config();
        cfg.tunnel_url = tunnel_url.trim().trim_end_matches('/').to_string();
        if !default_model.trim().is_empty() {
            cfg.default_model = default_model.trim().to_string();
        }
        cfg.enabled = enabled;

        let target_path = colab_config_candidate_paths()
            .into_iter()
            .find(|p| p.exists())
            .or_else(|| {
                PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .parent()
                    .and_then(|r| r.parent())
                    .map(|ws| ws.join("model_local_cloud").join("colab_config.json"))
            });

        if let Some(p) = target_path {
            if let Some(parent) = p.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            if let Ok(json_str) = serde_json::to_string_pretty(&cfg) {
                let _ = std::fs::write(&p, json_str.as_bytes());
            }
        }
        Ok(scan_colab_sync(&cfg, None))
    })
    .await
    .map_err(|e| format!("Lỗi lưu cấu hình Colab: {e}"))?
}

#[tauri::command]
pub async fn ask_colab_cloud_stream(
    window: tauri::Window,
    tunnel_url: Option<String>,
    model: String,
    messages: Vec<OllamaMessage>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let cfg = read_colab_cloud_config();
        let base = tunnel_url
            .as_deref()
            .map(|s| s.trim().trim_end_matches('/').to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| cfg.tunnel_url.clone());

        if base.is_empty() {
            return Err("Chưa có URL Colab GPU Tunnel.".to_string());
        }

        let target_model = if model.trim().is_empty() {
            cfg.default_model.clone()
        } else {
            model.trim().to_string()
        };

        let payload = serde_json::json!({
            "model": target_model,
            "messages": messages,
            "stream": true,
            "keep_alive": cfg.keep_alive,
            "options": {
                "temperature": cfg.temperature,
                "num_ctx": cfg.num_ctx
            }
        });
        let payload_str = payload.to_string();
        let chat_url = format!("{base}/api/chat");

        let mut cmd = Command::new("curl.exe");
        cmd.args([
            "-N",
            "-sS",
            "-m",
            "90",
            "-X",
            "POST",
            &chat_url,
            "-H",
            "Content-Type: application/json",
            "--data-binary",
            "@-",
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
        apply_no_window(&mut cmd);

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Không thể gọi curl tới Colab: {e}"))?;
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(payload_str.as_bytes());
        }
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Không mở được luồng đọc Colab GPU.".to_string())?;

        let reader = BufReader::new(stdout);
        let mut full_content = String::new();
        for line_res in reader.lines() {
            let Ok(line) = line_res else { break };
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(trimmed) {
                if let Some(err_msg) = v["error"].as_str() {
                    return Err(format!("Colab GPU báo lỗi: {err_msg}"));
                }
                if let Some(token) = v["message"]["content"].as_str() {
                    if !token.is_empty() {
                        full_content.push_str(token);
                        let _ = window.emit("llm_stream_token", token);
                    }
                }
                if v["done"].as_bool().unwrap_or(false) {
                    break;
                }
            }
        }
        let _ = child.wait();
        if full_content.trim().is_empty() {
            return Err("Colab GPU Tunnel không phản hồi nội dung.".to_string());
        }
        Ok(full_content.trim().to_string())
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền Colab: {e}"))?
}

