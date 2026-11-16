use serde::{Deserialize, Serialize};
use std::io::Write;
use std::process::{Command, Stdio};

use crate::backend::telemetry::apply_no_window;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OllamaMessage {
    pub role: String,
    pub content: String,
}

fn post_ollama_json(url: &str, payload_str: String, timeout_secs: &str) -> Result<serde_json::Value, String> {
    let mut cmd = Command::new("curl.exe");
    cmd.args([
        "-s",
        "-m",
        timeout_secs,
        "-X",
        "POST",
        url,
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
        .map_err(|e| format!("Không thể kết nối Ollama qua curl: {e}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(payload_str.as_bytes())
            .map_err(|e| format!("Lỗi gửi dữ liệu tới Ollama: {e}"))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Lỗi chờ phản hồi Ollama: {e}"))?;

    if !output.status.success() {
        return Err("API AI không phản hồi (kiểm tra kết nối hoặc Ollama).".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let v: serde_json::Value = serde_json::from_str(stdout.trim()).map_err(|_| {
        "Không thể đọc JSON phản hồi từ AI endpoint.".to_string()
    })?;

    if let Some(err_obj) = v["error"]["message"].as_str() {
        return Err(format!("Gemini API báo lỗi: {err_obj}"));
    }
    if let Some(err_msg) = v["error"].as_str() {
        return Err(format!("Ollama báo lỗi: {err_msg}"));
    }
    Ok(v)
}

#[tauri::command]
pub async fn ask_ollama(model: String, messages: Vec<OllamaMessage>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let payload = serde_json::json!({
            "model": model,
            "messages": messages,
            "stream": false,
            "options": {
                "temperature": 0.7,
                "num_predict": 220
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
    let clean_key = api_key.trim().to_string();
    if clean_key.is_empty() {
        return Err("Chưa nhập Gemini API Key".to_string());
    }
    let clean_model = if model.trim().is_empty() {
        "gemini-2.5-flash".to_string()
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
                "temperature": 0.7,
                "maxOutputTokens": 350
            }
        });

        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            clean_model, clean_key
        );
        let v = post_ollama_json(&url, payload.to_string(), "35")?;

        let content = v["candidates"][0]["content"]["parts"][0]["text"]
            .as_str()
            .ok_or_else(|| "Gemini không trả về nội dung văn bản".to_string())?;

        Ok(content.trim().to_string())
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ nền: {e}"))?
}

