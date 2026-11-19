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

#[tauri::command]
pub async fn ask_gemini(
    api_key: String,
    model: String,
    system_prompt: String,
    messages: Vec<OllamaMessage>,
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

        let payload = serde_json::json!({
            "system_instruction": {
                "parts": [{ "text": system_prompt }]
            },
            "contents": contents,
            "generationConfig": {
                "temperature": 0.65,
                "maxOutputTokens": 2048
            }
        });

        // Danh sách dự phòng: requested_model -> gemini-3.5-flash -> gemini-2.5-flash -> gemini-2.0-flash -> gemini-1.5-flash
        let mut models_to_try = vec![requested_model.clone()];
        for candidate in ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"] {
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
            match post_ollama_json(&url, payload.to_string(), "35") {
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
                        last_err = format!("Gemini ({m}): {err_msg}");
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
                        last_err = format!("Gemini ({m}) không trả về nội dung.");
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
        for candidate in ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"] {
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

