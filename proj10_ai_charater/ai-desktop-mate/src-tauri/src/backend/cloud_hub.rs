use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::State;

use crate::backend::llm::read_env_value;
use crate::backend::memory::{
    db_cloud_kv_delete, db_cloud_kv_get, db_cloud_kv_set, db_get_custom_skill,
    db_upsert_custom_skill, skills_storage_dir, CustomSkillRecord, MemoryState,
};
use crate::backend::telemetry::apply_no_window;
use crate::backend::tool_forge::{
    apply_expected_keywords_check, audit_script_safety, normalize_language, run_script_isolated,
    sanitize_skill_id, write_packaged_skill_files, SandboxRunResult, ToolForgeState,
};

const CLOUD_CONFIG_KEY: &str = "cloud_hub_config_v2";
const CLOUD_SESSION_KEY: &str = "cloud_google_session_v1";
const DEFAULT_CLOUD_HUB_URL: &str = "http://127.0.0.1:8787";
static OAUTH_NONCE_SEQ: AtomicU64 = AtomicU64::new(1);

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct CloudHubConfig {
    pub google_client_id: String,
    pub google_client_secret: String,
    pub cloud_hub_api_url: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CloudHubConfigPublic {
    pub google_client_id: String,
    pub has_google_client_secret: bool,
    pub cloud_hub_api_url: String,
    pub is_google_configured: bool,
    pub is_hub_configured: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SaveCloudConfigPayload {
    pub google_client_id: String,
    pub google_client_secret: Option<String>,
    pub cloud_hub_api_url: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct CloudUserSession {
    pub sub: String,
    pub email: String,
    pub name: String,
    pub picture: String,
    pub access_token: String,
    pub refresh_token: String,
    pub id_token: String,
    pub expires_at_ms: i64,
    pub logged_in_at_ms: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CloudAuthStatus {
    pub logged_in: bool,
    pub sub: String,
    pub email: String,
    pub name: String,
    pub picture: String,
    pub expires_at_ms: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CommunitySkillDoc {
    pub skill_key: String,
    pub id: String,
    pub name: String,
    pub description: String,
    pub language: String,
    #[serde(default = "default_empty_array_json")]
    pub triggers_json: String,
    #[serde(default = "default_empty_array_json")]
    pub params_schema_json: String,
    pub code: String,
    #[serde(default = "default_empty_obj_json")]
    pub test_args_json: String,
    #[serde(default = "default_empty_array_json")]
    pub expected_keywords_json: String,
    #[serde(default = "default_version_one")]
    pub version: i64,
    #[serde(default)]
    pub code_hash: String,
    #[serde(default)]
    pub author_sub: String,
    #[serde(default)]
    pub author_email: String,
    #[serde(default)]
    pub author_name: String,
    #[serde(default)]
    pub downloads: i64,
    #[serde(default)]
    pub stars: i64,
    #[serde(default)]
    pub starred_by: Vec<String>,
    #[serde(default)]
    pub updated_at_ms: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SyncedChatMessage {
    pub msg_id: String,
    pub role: String,
    pub content: String,
    pub source: String,
    pub created_at_ms: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InstallCommunitySkillResult {
    pub skill: CustomSkillRecord,
    pub sandbox: SandboxRunResult,
}

fn default_empty_array_json() -> String {
    "[]".to_string()
}

fn default_empty_obj_json() -> String {
    "{}".to_string()
}

fn default_version_one() -> i64 {
    1
}

pub fn sha256_bytes(data: &[u8]) -> [u8; 32] {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
        0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
        0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
        0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
        0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
        0xc67178f2,
    ];
    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
        0x5be0cd19,
    ];
    let bit_len = (data.len() as u64) * 8;
    let mut padded = data.to_vec();
    padded.push(0x80);
    while (padded.len() % 64) != 56 {
        padded.push(0);
    }
    padded.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in padded.chunks_exact(64) {
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([
                chunk[i * 4],
                chunk[i * 4 + 1],
                chunk[i * 4 + 2],
                chunk[i * 4 + 3],
            ]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16]
                .wrapping_add(s0)
                .wrapping_add(w[i - 7])
                .wrapping_add(s1);
        }
        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh] = h;
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = hh
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(K[i])
                .wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);

            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(temp1);
            d = c;
            c = b;
            b = a;
            a = temp1.wrapping_add(temp2);
        }
        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
        h[5] = h[5].wrapping_add(f);
        h[6] = h[6].wrapping_add(g);
        h[7] = h[7].wrapping_add(hh);
    }

    let mut out = [0u8; 32];
    for (i, word) in h.iter().enumerate() {
        out[i * 4..i * 4 + 4].copy_from_slice(&word.to_be_bytes());
    }
    out
}

pub fn base64_url_nopad(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = String::with_capacity((bytes.len() * 4) / 3 + 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        out.push(TABLE[((triple >> 18) & 0x3f) as usize] as char);
        out.push(TABLE[((triple >> 12) & 0x3f) as usize] as char);
        if chunk.len() > 1 {
            out.push(TABLE[((triple >> 6) & 0x3f) as usize] as char);
        }
        if chunk.len() > 2 {
            out.push(TABLE[(triple & 0x3f) as usize] as char);
        }
    }
    out
}

pub fn pkce_code_challenge_s256(verifier: &str) -> String {
    let digest = sha256_bytes(verifier.as_bytes());
    base64_url_nopad(&digest)
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn generate_random_urlsafe(seed_tag: &str) -> String {
    let seq = OAUTH_NONCE_SEQ.fetch_add(1, Ordering::Relaxed);
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let pid = std::process::id();
    let stack_var: u64 = 0x9e3779b97f4a7c15;
    let stack_addr = &stack_var as *const u64 as usize;
    let material1 = format!("{seed_tag}:{nanos}:{pid}:{seq}:{stack_addr}");
    let material2 = format!("{material1}:part2:{}", nanos.wrapping_mul(6364136223846793005));
    let mut raw = Vec::with_capacity(64);
    raw.extend_from_slice(&sha256_bytes(material1.as_bytes()));
    raw.extend_from_slice(&sha256_bytes(material2.as_bytes()));
    base64_url_nopad(&raw[..48])
}

pub fn url_encode_component(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 16);
    for b in s.as_bytes() {
        let ch = *b as char;
        if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.' | '~') {
            out.push(ch);
        } else {
            out.push_str(&format!("%{:02X}", b));
        }
    }
    out
}

pub fn url_decode_component(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'+' {
            out.push(b' ');
            i += 1;
        } else if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(hex_str) = std::str::from_utf8(&bytes[i + 1..i + 3]) {
                if let Ok(val) = u8::from_str_radix(hex_str, 16) {
                    out.push(val);
                    i += 3;
                    continue;
                }
            }
            out.push(bytes[i]);
            i += 1;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8_lossy(&out).to_string()
}

pub fn parse_oauth_callback_query(request_line_or_target: &str) -> Result<HashMap<String, String>, String> {
    let target = request_line_or_target
        .split_whitespace()
        .nth(1)
        .unwrap_or(request_line_or_target);
    let query = target.split_once('?').map(|(_, q)| q).unwrap_or("");
    let mut map = HashMap::new();
    for pair in query.split('&') {
        if pair.is_empty() {
            continue;
        }
        let (k, v) = pair.split_once('=').unwrap_or((pair, ""));
        map.insert(url_decode_component(k), url_decode_component(v));
    }
    if map.is_empty() {
        return Err("Callback thiếu tham số truy vấn OAuth.".to_string());
    }
    Ok(map)
}

pub fn build_google_auth_url(
    client_id: &str,
    redirect_uri: &str,
    state: &str,
    code_challenge: &str,
) -> String {
    format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}&code_challenge={}&code_challenge_method=S256&access_type=offline&prompt=consent",
        url_encode_component(client_id.trim()),
        url_encode_component(redirect_uri),
        url_encode_component("openid email profile"),
        url_encode_component(state),
        url_encode_component(code_challenge),
    )
}

pub fn parse_hub_skills_response(raw_json: &str) -> Result<Vec<CommunitySkillDoc>, String> {
    let val: serde_json::Value =
        serde_json::from_str(raw_json).map_err(|e| format!("JSON Cloud Hub không hợp lệ: {e}"))?;
    if val.get("ok").and_then(|v| v.as_bool()) == Some(false) {
        let err = val
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Cloud Hub từ chối yêu cầu.");
        return Err(err.to_string());
    }
    let items = val
        .get("items")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Phản hồi Cloud Hub thiếu mảng 'items'.".to_string())?;
    let mut out = Vec::with_capacity(items.len());
    for item in items {
        if let Ok(doc) = serde_json::from_value::<CommunitySkillDoc>(item.clone()) {
            out.push(doc);
        }
    }
    Ok(out)
}

fn load_effective_cloud_config(mem_state: &MemoryState) -> CloudHubConfig {
    let mut cfg = db_cloud_kv_get(mem_state, CLOUD_CONFIG_KEY)
        .and_then(|raw| serde_json::from_str::<CloudHubConfig>(&raw).ok())
        .unwrap_or_default();

    if cfg.google_client_id.trim().is_empty() {
        cfg.google_client_id = read_env_value("GOOGLE_CLIENT_ID").unwrap_or_default();
    }
    if cfg.google_client_secret.trim().is_empty() {
        cfg.google_client_secret = read_env_value("GOOGLE_CLIENT_SECRET").unwrap_or_default();
    }
    if cfg.cloud_hub_api_url.trim().is_empty() {
        cfg.cloud_hub_api_url = read_env_value("CLOUD_HUB_API_URL")
            .unwrap_or_else(|| DEFAULT_CLOUD_HUB_URL.to_string());
    }
    cfg
}

fn to_public_config(cfg: &CloudHubConfig) -> CloudHubConfigPublic {
    CloudHubConfigPublic {
        google_client_id: cfg.google_client_id.trim().to_string(),
        has_google_client_secret: !cfg.google_client_secret.trim().is_empty(),
        cloud_hub_api_url: cfg.cloud_hub_api_url.trim().to_string(),
        is_google_configured: !cfg.google_client_id.trim().is_empty(),
        is_hub_configured: !cfg.cloud_hub_api_url.trim().is_empty(),
    }
}

fn load_session(mem_state: &MemoryState) -> Option<CloudUserSession> {
    db_cloud_kv_get(mem_state, CLOUD_SESSION_KEY)
        .and_then(|raw| serde_json::from_str::<CloudUserSession>(&raw).ok())
        .filter(|s| !s.email.trim().is_empty() && !s.access_token.trim().is_empty())
}

fn session_to_status(sess: Option<&CloudUserSession>) -> CloudAuthStatus {
    match sess {
        Some(s) => CloudAuthStatus {
            logged_in: true,
            sub: s.sub.clone(),
            email: s.email.clone(),
            name: s.name.clone(),
            picture: s.picture.clone(),
            expires_at_ms: s.expires_at_ms,
        },
        None => CloudAuthStatus {
            logged_in: false,
            sub: String::new(),
            email: String::new(),
            name: String::new(),
            picture: String::new(),
            expires_at_ms: 0,
        },
    }
}

fn curl_post_form(url: &str, fields: &[(&str, &str)], timeout_secs: u32) -> Result<String, String> {
    let mut cmd = Command::new("curl.exe");
    apply_no_window(&mut cmd);
    cmd.args([
        "-sS",
        "-L",
        "--max-time",
        &timeout_secs.to_string(),
        "-X",
        "POST",
        "-H",
        "Accept: application/json",
    ]);
    for (k, v) in fields {
        cmd.arg("--data-urlencode");
        cmd.arg(format!("{k}={v}"));
    }
    cmd.arg(url);

    let out = cmd
        .output()
        .map_err(|e| format!("Không gọi được curl.exe (kiểm tra mạng): {e}"))?;
    let body = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if !out.status.success() && body.is_empty() {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(format!("Lỗi kết nối mạng tới Google OAuth: {err}"));
    }
    Ok(body)
}

fn curl_get_bearer(url: &str, bearer_token: &str, timeout_secs: u32) -> Result<String, String> {
    let mut cmd = Command::new("curl.exe");
    apply_no_window(&mut cmd);
    let mut args = vec![
        "-sS".to_string(),
        "-L".to_string(),
        "--max-time".to_string(),
        timeout_secs.to_string(),
        "-H".to_string(),
        "Accept: application/json".to_string(),
    ];
    if !bearer_token.trim().is_empty() {
        args.push("-H".to_string());
        args.push(format!("Authorization: Bearer {bearer_token}"));
    }
    args.push(url.to_string());
    cmd.args(&args);

    let out = cmd
        .output()
        .map_err(|e| format!("Không gọi được curl.exe: {e}"))?;
    let body = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if !out.status.success() && body.is_empty() {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(format!("Không kết nối được backend online ({url}): {err}"));
    }
    Ok(body)
}

fn curl_post_json_bearer(
    url: &str,
    bearer_token: &str,
    body_json: &serde_json::Value,
    timeout_secs: u32,
) -> Result<String, String> {
    let payload_str = serde_json::to_string(body_json)
        .map_err(|e| format!("Không thể tuần tự hóa JSON: {e}"))?;

    let mut cmd = Command::new("curl.exe");
    apply_no_window(&mut cmd);
    cmd.args([
        "-sS",
        "-L",
        "--max-time",
        &timeout_secs.to_string(),
        "-X",
        "POST",
        "-H",
        "Content-Type: application/json",
        "-H",
        "Accept: application/json",
        "-H",
        &format!("Authorization: Bearer {bearer_token}"),
        "--data-binary",
        "@-",
        url,
    ])
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Không gọi được curl.exe tới backend online: {e}"))?;
    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(payload_str.as_bytes());
    }
    let out = child
        .wait_with_output()
        .map_err(|e| format!("Lỗi đọc phản hồi backend online: {e}"))?;
    let text = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if !out.status.success() && text.is_empty() {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(format!("Không kết nối được backend online ({url}): {err}"));
    }
    Ok(text)
}

fn open_system_browser(url: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;
        use windows::core::{w, PCWSTR};
        use windows::Win32::UI::Shell::ShellExecuteW;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

        let wide_url: Vec<u16> = OsStr::new(url)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let res = unsafe {
            ShellExecuteW(
                None,
                w!("open"),
                PCWSTR(wide_url.as_ptr()),
                None,
                None,
                SW_SHOWNORMAL,
            )
        };
        if (res.0 as isize) <= 32 {
            return Err(format!(
                "ShellExecuteW không mở được trình duyệt mặc định (mã {}).",
                res.0 as isize
            ));
        }
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        let _ = url;
        Err("Chỉ hỗ trợ mở trình duyệt trên Windows.".to_string())
    }
}

fn write_oauth_html_response(stream: &mut std::net::TcpStream, success: bool, msg: &str) {
    let title = if success {
        "Đăng nhập thành công"
    } else {
        "Đăng nhập thất bại"
    };
    let accent = if success { "#10b981" } else { "#ef4444" };
    let html = format!(
        "<!DOCTYPE html><html lang=\"vi\"><head><meta charset=\"utf-8\"/><title>{title}</title>\
        <style>body{{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;\
        background:#0f172a;color:#f8fafc;font-family:system-ui,-apple-system,sans-serif;}}\
        .card{{max-width:460px;padding:28px;border-radius:14px;background:#1e293b;\
        border:1px solid {accent};box-shadow:0 12px 32px rgba(0,0,0,0.45);}}\
        h2{{margin:0 0 10px 0;color:{accent};font-size:18px;}}p{{margin:0;line-height:1.55;color:#cbd5e1;font-size:14px;}}\
        </style></head><body><div class=\"card\"><h2>[Duck ai Manager] {title}</h2><p>{msg}</p></div></body></html>"
    );
    let resp = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        html.len(),
        html
    );
    let _ = stream.write_all(resp.as_bytes());
    let _ = stream.flush();
}

fn ensure_valid_session_for_cloud(mem_state: &MemoryState) -> Result<CloudUserSession, String> {
    let mut sess = load_session(mem_state).ok_or_else(|| {
        "AUTH_REQUIRED: Bạn đang ở chế độ Offline/Guest. Hãy đăng nhập Google để đồng bộ Skill với Cloud Hub."
            .to_string()
    })?;
    let now = now_ms();
    if sess.expires_at_ms > 0 && now + 60_000 >= sess.expires_at_ms && !sess.refresh_token.is_empty()
    {
        let cfg = load_effective_cloud_config(mem_state);
        if !cfg.google_client_id.trim().is_empty() {
            let mut fields: Vec<(&str, &str)> = vec![
                ("client_id", cfg.google_client_id.trim()),
                ("refresh_token", sess.refresh_token.trim()),
                ("grant_type", "refresh_token"),
            ];
            if !cfg.google_client_secret.trim().is_empty() {
                fields.push(("client_secret", cfg.google_client_secret.trim()));
            }
            if let Ok(raw_tok) = curl_post_form("https://oauth2.googleapis.com/token", &fields, 12)
            {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw_tok) {
                    if let Some(new_access) = v.get("access_token").and_then(|x| x.as_str()) {
                        sess.access_token = new_access.to_string();
                        if let Some(new_id) = v.get("id_token").and_then(|x| x.as_str()) {
                            sess.id_token = new_id.to_string();
                        }
                        let exp_sec = v.get("expires_in").and_then(|x| x.as_i64()).unwrap_or(3600);
                        sess.expires_at_ms = now + exp_sec * 1000;
                        if let Ok(json_s) = serde_json::to_string(&sess) {
                            let _ = db_cloud_kv_set(mem_state, CLOUD_SESSION_KEY, &json_s);
                        }
                    }
                }
            }
        }
    }
    Ok(sess)
}

fn session_bearer(sess: &CloudUserSession) -> &str {
    if !sess.access_token.trim().is_empty() {
        sess.access_token.trim()
    } else {
        sess.id_token.trim()
    }
}

#[tauri::command]
pub fn cloud_get_config(mem_state: State<'_, MemoryState>) -> CloudHubConfigPublic {
    let cfg = load_effective_cloud_config(&mem_state);
    to_public_config(&cfg)
}

#[tauri::command]
pub fn cloud_save_config(
    mem_state: State<'_, MemoryState>,
    payload: SaveCloudConfigPayload,
) -> Result<CloudHubConfigPublic, String> {
    let existing = load_effective_cloud_config(&mem_state);
    let next_secret = match payload.google_client_secret {
        Some(s) if !s.trim().is_empty() => s.trim().to_string(),
        _ => existing.google_client_secret,
    };

    let cfg = CloudHubConfig {
        google_client_id: payload.google_client_id.trim().to_string(),
        google_client_secret: next_secret,
        cloud_hub_api_url: if payload.cloud_hub_api_url.trim().is_empty() {
            DEFAULT_CLOUD_HUB_URL.to_string()
        } else {
            payload
                .cloud_hub_api_url
                .trim()
                .trim_end_matches('/')
                .to_string()
        },
    };
    let json = serde_json::to_string(&cfg).map_err(|e| e.to_string())?;
    db_cloud_kv_set(&mem_state, CLOUD_CONFIG_KEY, &json)?;
    Ok(to_public_config(&cfg))
}

#[tauri::command]
pub fn cloud_get_auth_status(mem_state: State<'_, MemoryState>) -> CloudAuthStatus {
    let sess = load_session(&mem_state);
    session_to_status(sess.as_ref())
}

#[tauri::command]
pub fn cloud_google_logout(mem_state: State<'_, MemoryState>) -> Result<CloudAuthStatus, String> {
    db_cloud_kv_delete(&mem_state, CLOUD_SESSION_KEY)?;
    Ok(session_to_status(None))
}

#[tauri::command]
pub async fn cloud_check_hub_health(
    mem_state: State<'_, MemoryState>,
) -> Result<serde_json::Value, String> {
    let cfg = load_effective_cloud_config(&mem_state);
    let base = cfg.cloud_hub_api_url.trim().trim_end_matches('/').to_string();
    let url = format!("{base}/api/health");
    let raw = tauri::async_runtime::spawn_blocking(move || curl_get_bearer(&url, "", 4))
        .await
        .map_err(|e| format!("Lỗi kiểm tra Cloud Hub: {e}"))??;
    serde_json::from_str::<serde_json::Value>(&raw)
        .map_err(|e| format!("Phản hồi health không hợp lệ: {e}"))
}

#[tauri::command]
pub async fn cloud_google_login(
    mem_state: State<'_, MemoryState>,
) -> Result<CloudAuthStatus, String> {
    let cfg = load_effective_cloud_config(&mem_state);
    if cfg.google_client_id.trim().is_empty() {
        return Err(
            "Chưa có GOOGLE_CLIENT_ID. Hãy nhập Google OAuth Client ID (Desktop App) trong Cấu Hình Cloud hoặc file .env."
                .to_string(),
        );
    }

    let listener = TcpListener::bind("127.0.0.1:43821")
        .or_else(|_| TcpListener::bind("127.0.0.1:0"))
        .map_err(|e| format!("Không mở được cổng loopback nhận callback OAuth: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Không đọc được port loopback: {e}"))?
        .port();
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("Không cấu hình non-blocking loopback: {e}"))?;

    let redirect_uri = format!("http://127.0.0.1:{port}/callback");
    let state_token = generate_random_urlsafe("state");
    let code_verifier = generate_random_urlsafe("pkce");
    let code_challenge = pkce_code_challenge_s256(&code_verifier);
    let auth_url = build_google_auth_url(
        &cfg.google_client_id,
        &redirect_uri,
        &state_token,
        &code_challenge,
    );

    open_system_browser(&auth_url)?;

    let expected_state = state_token.clone();
    let code = tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        let deadline = Instant::now() + Duration::from_secs(120);
        loop {
            if Instant::now() >= deadline {
                return Err("Hết thời gian chờ đăng nhập Google trên trình duyệt (120s).".to_string());
            }
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let _ = stream.set_nonblocking(false);
                    let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
                    let mut buf = [0u8; 4096];
                    let n = stream.read(&mut buf).unwrap_or(0);
                    let req = String::from_utf8_lossy(&buf[..n]);
                    let first_line = req.lines().next().unwrap_or("");
                    if first_line.contains("/favicon.ico") {
                        let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
                        continue;
                    }
                    if !first_line.contains("/callback") {
                        write_oauth_html_response(&mut stream, false, "Đường dẫn callback không hợp lệ.");
                        continue;
                    }
                    match parse_oauth_callback_query(first_line) {
                        Ok(params) => {
                            if let Some(err) = params.get("error") {
                                write_oauth_html_response(
                                    &mut stream,
                                    false,
                                    &format!("Google từ chối cấp quyền: {err}"),
                                );
                                return Err(format!("Đăng nhập Google bị hủy hoặc từ chối: {err}"));
                            }
                            let got_state = params.get("state").map(|s| s.as_str()).unwrap_or("");
                            if got_state != expected_state {
                                write_oauth_html_response(
                                    &mut stream,
                                    false,
                                    "Sai mã bảo mật OAuth state. Vui lòng thử lại trong app.",
                                );
                                return Err("OAuth state mismatch.".to_string());
                            }
                            if let Some(auth_code) = params.get("code") {
                                write_oauth_html_response(
                                    &mut stream,
                                    true,
                                    "Bạn đã đăng nhập thành công! Có thể đóng tab trình duyệt này và quay lại Duck ai Manager.",
                                );
                                return Ok(auth_code.clone());
                            }
                            write_oauth_html_response(&mut stream, false, "Thiếu mã code từ Google.");
                            return Err("Callback Google không trả về authorization code.".to_string());
                        }
                        Err(e) => {
                            write_oauth_html_response(&mut stream, false, &e);
                            return Err(e);
                        }
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(80));
                }
                Err(e) => {
                    return Err(format!("Lỗi lắng nghe callback OAuth: {e}"));
                }
            }
        }
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ chờ OAuth: {e}"))??;

    let client_id = cfg.google_client_id.clone();
    let client_secret = cfg.google_client_secret.clone();
    let session = tauri::async_runtime::spawn_blocking(move || -> Result<CloudUserSession, String> {
        let mut fields: Vec<(&str, &str)> = vec![
            ("code", code.trim()),
            ("client_id", client_id.trim()),
            ("code_verifier", code_verifier.trim()),
            ("redirect_uri", redirect_uri.as_str()),
            ("grant_type", "authorization_code"),
        ];
        if !client_secret.trim().is_empty() {
            fields.push(("client_secret", client_secret.trim()));
        }

        let raw_tok = curl_post_form("https://oauth2.googleapis.com/token", &fields, 15)?;
        let tok_json: serde_json::Value = serde_json::from_str(&raw_tok)
            .map_err(|e| format!("Phản hồi token Google không hợp lệ: {e} | {raw_tok}"))?;
        if let Some(err) = tok_json.get("error").and_then(|v| v.as_str()) {
            let desc = tok_json
                .get("error_description")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            return Err(format!("Google OAuth token error ({err}): {desc}"));
        }

        let access_token = tok_json
            .get("access_token")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "Google không trả về access_token.".to_string())?
            .to_string();
        let refresh_token = tok_json
            .get("refresh_token")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let id_token = tok_json
            .get("id_token")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let expires_in = tok_json
            .get("expires_in")
            .and_then(|v| v.as_i64())
            .unwrap_or(3600);

        let raw_profile =
            curl_get_bearer("https://www.googleapis.com/oauth2/v3/userinfo", &access_token, 12)?;
        let prof: serde_json::Value = serde_json::from_str(&raw_profile)
            .map_err(|e| format!("Không đọc được hồ sơ Google UserInfo: {e}"))?;

        let sub = prof.get("sub").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let email = prof
            .get("email")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let name = prof
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or(if email.is_empty() { "Google User" } else { email.as_str() })
            .to_string();
        let picture = prof
            .get("picture")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        if email.is_empty() {
            return Err("Không lấy được email từ tài khoản Google.".to_string());
        }

        let now = now_ms();
        Ok(CloudUserSession {
            sub,
            email,
            name,
            picture,
            access_token,
            refresh_token,
            id_token,
            expires_at_ms: now + expires_in * 1000,
            logged_in_at_ms: now,
        })
    })
    .await
    .map_err(|e| format!("Lỗi tác vụ trao đổi token: {e}"))??;

    let sess_json = serde_json::to_string(&session).map_err(|e| e.to_string())?;
    db_cloud_kv_set(&mem_state, CLOUD_SESSION_KEY, &sess_json)?;
    Ok(session_to_status(Some(&session)))
}

#[tauri::command]
pub async fn cloud_list_community_skills(
    mem_state: State<'_, MemoryState>,
    query: Option<String>,
    language: Option<String>,
) -> Result<Vec<CommunitySkillDoc>, String> {
    let sess = ensure_valid_session_for_cloud(&mem_state)?;
    let cfg = load_effective_cloud_config(&mem_state);
    let base = cfg.cloud_hub_api_url.trim().trim_end_matches('/');
    let q_val = query.as_deref().unwrap_or("").trim();
    let lang_val = language.as_deref().unwrap_or("all").trim();
    let url = format!(
        "{base}/api/skills?q={}&lang={}",
        url_encode_component(q_val),
        url_encode_component(lang_val)
    );
    let bearer = session_bearer(&sess).to_string();

    let raw = tauri::async_runtime::spawn_blocking(move || curl_get_bearer(&url, &bearer, 15))
        .await
        .map_err(|e| format!("Lỗi tải danh sách từ Cloud Hub: {e}"))??;

    parse_hub_skills_response(&raw)
}

#[tauri::command]
pub async fn cloud_publish_skill(
    mem_state: State<'_, MemoryState>,
    skill_id: String,
) -> Result<CommunitySkillDoc, String> {
    let sess = ensure_valid_session_for_cloud(&mem_state)?;
    let cfg = load_effective_cloud_config(&mem_state);

    let clean_id = sanitize_skill_id(&skill_id);
    let skill = db_get_custom_skill(&mem_state, &clean_id)
        .ok_or_else(|| format!("Không tìm thấy skill '{clean_id}' trong máy."))?;

    if !skill.verified {
        return Err("Chỉ được đẩy lên Cloud các Skill đã vượt qua kiểm chứng Sandbox.".to_string());
    }
    let issues = audit_script_safety(&skill.language, &skill.code);
    if !issues.is_empty() {
        return Err(format!(
            "Skill bị chặn an toàn trước khi đẩy lên Cloud: {}",
            issues.join("; ")
        ));
    }

    let base = cfg.cloud_hub_api_url.trim().trim_end_matches('/');
    let url = format!("{base}/api/skills");
    let bearer = session_bearer(&sess).to_string();
    let payload = serde_json::json!({
        "id": skill.id,
        "name": skill.name,
        "description": skill.description,
        "language": skill.language,
        "triggers_json": skill.triggers_json,
        "params_schema_json": skill.params_schema_json,
        "code": skill.code,
        "test_args_json": skill.test_args_json,
        "expected_keywords_json": skill.expected_keywords_json,
        "version": skill.version,
        "code_hash": skill.code_hash,
    });

    let raw = tauri::async_runtime::spawn_blocking(move || {
        curl_post_json_bearer(&url, &bearer, &payload, 15)
    })
    .await
    .map_err(|e| format!("Lỗi đẩy skill lên Cloud Hub: {e}"))??;

    let parsed: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|e| format!("Phản hồi Cloud Hub không hợp lệ: {e} | {raw}"))?;
    if parsed.get("ok").and_then(|v| v.as_bool()) == Some(false) {
        let err = parsed
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Cloud Hub từ chối publish skill.");
        return Err(err.to_string());
    }
    let item = parsed
        .get("item")
        .cloned()
        .ok_or_else(|| "Phản hồi Cloud Hub thiếu 'item'.".to_string())?;
    serde_json::from_value::<CommunitySkillDoc>(item)
        .map_err(|e| format!("Không parse được CommunitySkillDoc: {e}"))
}

#[tauri::command]
pub async fn cloud_install_community_skill(
    mem_state: State<'_, MemoryState>,
    forge_state: State<'_, ToolForgeState>,
    skill_key: String,
) -> Result<InstallCommunitySkillResult, String> {
    let sess = ensure_valid_session_for_cloud(&mem_state)?;
    let cfg = load_effective_cloud_config(&mem_state);
    let base = cfg.cloud_hub_api_url.trim().trim_end_matches('/').to_string();
    let encoded_key = url_encode_component(skill_key.trim());
    let get_url = format!("{base}/api/skills/{encoded_key}");
    let bearer = session_bearer(&sess).to_string();

    let raw_doc = tauri::async_runtime::spawn_blocking(move || curl_get_bearer(&get_url, &bearer, 15))
        .await
        .map_err(|e| format!("Lỗi tải skill từ Cloud Hub: {e}"))??;

    let doc_json: serde_json::Value = serde_json::from_str(&raw_doc)
        .map_err(|e| format!("Phản hồi Cloud Hub không hợp lệ: {e}"))?;
    if doc_json.get("ok").and_then(|v| v.as_bool()) == Some(false) {
        let err = doc_json
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Không tải được Skill từ Cloud Hub.");
        return Err(err.to_string());
    }
    let doc_val = doc_json
        .get("item")
        .filter(|v| !v.is_null())
        .ok_or_else(|| "Không tìm thấy Skill này trên Cloud Hub.".to_string())?;
    let doc: CommunitySkillDoc = serde_json::from_value(doc_val.clone())
        .map_err(|e| format!("Dữ liệu Skill cộng đồng bị lỗi cấu trúc: {e}"))?;

    let norm_lang = normalize_language(&doc.language)?.to_string();
    let issues = audit_script_safety(&norm_lang, &doc.code);
    if !issues.is_empty() {
        return Err(format!(
            "Skill cộng đồng bị chặn bởi kiểm duyệt an toàn cục bộ: {}",
            issues.join("; ")
        ));
    }

    let expected_kw: Vec<String> =
        serde_json::from_str(&doc.expected_keywords_json).unwrap_or_default();
    let lang_run = norm_lang.clone();
    let code_run = doc.code.clone();
    let args_run = doc.test_args_json.clone();
    let mut sb = tauri::async_runtime::spawn_blocking(move || {
        run_script_isolated(&lang_run, &code_run, &args_run, true, 15)
    })
    .await
    .map_err(|e| format!("Lỗi chạy kiểm nghiệm Sandbox skill cộng đồng: {e}"))?;
    apply_expected_keywords_check(&mut sb, &expected_kw);

    if !sb.verified {
        return Err(format!(
            "Skill cộng đồng chưa vượt qua Sandbox trên máy bạn ({}). Hãy bấm 'Nạp Vào Editor' để kiểm tra trước.",
            sb.failure_reason
        ));
    }

    if let Ok(mut guard) = forge_state.verified_receipts.lock() {
        guard.insert(sb.code_hash.clone(), sb.clone());
    }

    let clean_id = sanitize_skill_id(&doc.id);
    let rec = CustomSkillRecord {
        id: clean_id,
        name: doc.name,
        description: doc.description,
        language: norm_lang,
        triggers_json: doc.triggers_json,
        params_schema_json: doc.params_schema_json,
        code: doc.code,
        test_args_json: doc.test_args_json,
        expected_keywords_json: doc.expected_keywords_json,
        version: doc.version.max(1),
        verified: true,
        code_hash: sb.code_hash.clone(),
        last_test_output: sb.stdout.chars().take(1200).collect(),
        last_test_ms: sb.duration_ms,
        usage_count: 0,
        heal_count: 0,
        last_heal_note: format!("Pulled from Cloud Hub ({})", doc.author_email),
        enabled: true,
        created_at: 0,
        updated_at: 0,
    };

    db_upsert_custom_skill(&mem_state, &rec)?;
    write_packaged_skill_files(&skills_storage_dir(&mem_state), &rec);
    let saved = db_get_custom_skill(&mem_state, &rec.id).unwrap_or(rec);

    // Best-effort increment download counter on backend online
    let dl_url = format!("{base}/api/skills/{encoded_key}/download");
    let dl_bearer = session_bearer(&sess).to_string();
    let _ = tauri::async_runtime::spawn_blocking(move || {
        let _ = curl_post_json_bearer(&dl_url, &dl_bearer, &serde_json::json!({}), 5);
    });

    Ok(InstallCommunitySkillResult {
        skill: saved,
        sandbox: sb,
    })
}

fn curl_delete_bearer(url: &str, bearer_token: &str, timeout_secs: u32) -> Result<String, String> {
    let mut cmd = Command::new("curl.exe");
    apply_no_window(&mut cmd);
    cmd.args([
        "-sS",
        "-L",
        "--max-time",
        &timeout_secs.to_string(),
        "-X",
        "DELETE",
        "-H",
        "Accept: application/json",
        "-H",
        &format!("Authorization: Bearer {bearer_token}"),
        url,
    ]);
    let out = cmd
        .output()
        .map_err(|e| format!("Không gọi được curl.exe: {e}"))?;
    let body = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if !out.status.success() && body.is_empty() {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(format!("Không kết nối được backend online ({url}): {err}"));
    }
    Ok(body)
}

#[tauri::command]
pub async fn cloud_delete_community_skill(
    mem_state: State<'_, MemoryState>,
    skill_key: String,
) -> Result<String, String> {
    let sess = ensure_valid_session_for_cloud(&mem_state)?;
    let cfg = load_effective_cloud_config(&mem_state);
    let base = cfg.cloud_hub_api_url.trim().trim_end_matches('/');
    let encoded = url_encode_component(skill_key.trim());
    let url = format!("{base}/api/skills/{encoded}");
    let bearer = session_bearer(&sess).to_string();

    let raw = tauri::async_runtime::spawn_blocking(move || curl_delete_bearer(&url, &bearer, 12))
        .await
        .map_err(|e| format!("Lỗi xóa skill trên Cloud Hub: {e}"))??;
    let parsed: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|e| format!("Phản hồi Cloud Hub không hợp lệ: {e}"))?;
    if parsed.get("ok").and_then(|v| v.as_bool()) == Some(false) {
        let err = parsed
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Không xóa được skill.");
        return Err(err.to_string());
    }
    Ok(skill_key)
}

#[tauri::command]
pub async fn cloud_toggle_star_skill(
    mem_state: State<'_, MemoryState>,
    skill_key: String,
) -> Result<serde_json::Value, String> {
    let sess = ensure_valid_session_for_cloud(&mem_state)?;
    let cfg = load_effective_cloud_config(&mem_state);
    let base = cfg.cloud_hub_api_url.trim().trim_end_matches('/');
    let encoded = url_encode_component(skill_key.trim());
    let url = format!("{base}/api/skills/{encoded}/star");
    let bearer = session_bearer(&sess).to_string();

    let raw = tauri::async_runtime::spawn_blocking(move || {
        curl_post_json_bearer(&url, &bearer, &serde_json::json!({}), 10)
    })
    .await
    .map_err(|e| format!("Lỗi star skill: {e}"))??;
    let parsed: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|e| format!("Phản hồi Cloud Hub không hợp lệ: {e}"))?;
    if parsed.get("ok").and_then(|v| v.as_bool()) == Some(false) {
        let err = parsed
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Không star được skill.");
        return Err(err.to_string());
    }
    Ok(parsed)
}

#[tauri::command]
pub async fn cloud_sync_chat_pull(
    mem_state: State<'_, MemoryState>,
    since_ms: Option<i64>,
) -> Result<Vec<SyncedChatMessage>, String> {
    let sess = ensure_valid_session_for_cloud(&mem_state)?;
    let cfg = load_effective_cloud_config(&mem_state);
    let base = cfg.cloud_hub_api_url.trim().trim_end_matches('/');
    let since = since_ms.unwrap_or(0);
    let url = format!("{base}/api/chat?since_ms={since}");
    let bearer = session_bearer(&sess).to_string();

    let raw = tauri::async_runtime::spawn_blocking(move || curl_get_bearer(&url, &bearer, 10))
        .await
        .map_err(|e| format!("Lỗi đồng bộ chat từ Cloud Hub: {e}"))??;
    let parsed: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|e| format!("Phản hồi chat sync không hợp lệ: {e}"))?;
    if parsed.get("ok").and_then(|v| v.as_bool()) == Some(false) {
        let err = parsed
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Không kéo được tin nhắn đồng bộ.");
        return Err(err.to_string());
    }
    let arr = parsed
        .get("items")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let items: Vec<SyncedChatMessage> = arr
        .into_iter()
        .filter_map(|v| serde_json::from_value(v).ok())
        .collect();
    Ok(items)
}

#[tauri::command]
pub async fn cloud_sync_chat_push(
    mem_state: State<'_, MemoryState>,
    msg_id: String,
    role: String,
    content: String,
    created_at_ms: i64,
) -> Result<(), String> {
    let sess = ensure_valid_session_for_cloud(&mem_state)?;
    let cfg = load_effective_cloud_config(&mem_state);
    let base = cfg.cloud_hub_api_url.trim().trim_end_matches('/');
    let url = format!("{base}/api/chat");
    let bearer = session_bearer(&sess).to_string();
    let payload = serde_json::json!({
        "msg_id": msg_id,
        "role": role,
        "content": content,
        "source": "desktop",
        "created_at_ms": created_at_ms,
    });

    let _ = tauri::async_runtime::spawn_blocking(move || {
        curl_post_json_bearer(&url, &bearer, &payload, 8)
    })
    .await
    .map_err(|e| format!("Lỗi đẩy chat sync: {e}"))??;
    Ok(())
}

#[tauri::command]
pub async fn cloud_sync_chat_stream_chunk(
    mem_state: State<'_, MemoryState>,
    stream_id: String,
    token: String,
    done: bool,
) -> Result<(), String> {
    let sess = ensure_valid_session_for_cloud(&mem_state)?;
    let cfg = load_effective_cloud_config(&mem_state);
    let base = cfg.cloud_hub_api_url.trim().trim_end_matches('/');
    let url = format!("{base}/api/chat/stream-chunk");
    let bearer = session_bearer(&sess).to_string();
    let payload = serde_json::json!({
        "stream_id": stream_id,
        "token": token,
        "done": done,
    });
    let _ = tauri::async_runtime::spawn_blocking(move || {
        curl_post_json_bearer(&url, &bearer, &payload, 4)
    })
    .await;
    Ok(())
}

#[tauri::command]
pub fn cloud_open_web_companion(mem_state: State<'_, MemoryState>) -> Result<String, String> {
    let cfg = load_effective_cloud_config(&mem_state);
    let base = cfg.cloud_hub_api_url.trim().trim_end_matches('/');
    let url = if let Some(sess) = ensure_valid_session_for_cloud(&mem_state).ok() {
        let tok = session_bearer(&sess);
        format!("{base}/#token={}", url_encode_component(tok))
    } else {
        format!("{base}/")
    };
    open_system_browser(&url)?;
    Ok(base.to_string())
}
