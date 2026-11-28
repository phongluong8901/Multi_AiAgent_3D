use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::os::raw::{c_char, c_int, c_uchar, c_ulong, c_void};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::io::Write;
use std::sync::Mutex;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::State;

use crate::backend::cloud_hub::sha256_bytes;
use crate::backend::llm::{parse_gemini_candidate_text, read_env_value, OllamaMessage};
use crate::backend::telemetry::apply_no_window;

#[cfg(windows)]
#[repr(C)]
struct DataBlob {
    cb_data: c_ulong,
    pb_data: *mut c_uchar,
}

#[cfg(windows)]
#[link(name = "kernel32")]
unsafe extern "system" {
    fn LoadLibraryA(lp_lib_file_name: *const c_char) -> *mut c_void;
    fn GetProcAddress(h_module: *mut c_void, lp_proc_name: *const c_char) -> *mut c_void;
    fn LocalFree(h_mem: *mut c_void) -> *mut c_void;
}

#[cfg(windows)]
type FnCryptProtectData = unsafe extern "system" fn(
    *const DataBlob,
    *const u16,
    *const DataBlob,
    *mut c_void,
    *mut c_void,
    c_ulong,
    *mut DataBlob,
) -> c_int;

#[cfg(windows)]
type FnCryptUnprotectData = unsafe extern "system" fn(
    *const DataBlob,
    *mut *mut u16,
    *const DataBlob,
    *mut c_void,
    *mut c_void,
    c_ulong,
    *mut DataBlob,
) -> c_int;

#[cfg(windows)]
fn load_dpapi_fns() -> Result<(FnCryptProtectData, FnCryptUnprotectData), String> {
    unsafe {
        let m = LoadLibraryA(b"crypt32.dll\0".as_ptr() as *const c_char);
        if m.is_null() {
            return Err("Không thể nạp crypt32.dll trên Windows.".to_string());
        }
        let p_enc = GetProcAddress(m, b"CryptProtectData\0".as_ptr() as *const c_char);
        let p_dec = GetProcAddress(m, b"CryptUnprotectData\0".as_ptr() as *const c_char);
        if p_enc.is_null() || p_dec.is_null() {
            return Err("Không tìm thấy hàm DPAPI trong crypt32.dll.".to_string());
        }
        Ok((std::mem::transmute(p_enc), std::mem::transmute(p_dec)))
    }
}

const CRYPTPROTECT_UI_FORBIDDEN: c_ulong = 0x01;

fn b64_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(((bytes.len() + 2) / 3) * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        out.push(TABLE[((triple >> 18) & 0x3f) as usize] as char);
        out.push(TABLE[((triple >> 12) & 0x3f) as usize] as char);
        if chunk.len() > 1 {
            out.push(TABLE[((triple >> 6) & 0x3f) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(TABLE[(triple & 0x3f) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

fn b64_val(b: u8) -> Option<u32> {
    match b {
        b'A'..=b'Z' => Some((b - b'A') as u32),
        b'a'..=b'z' => Some((b - b'a' + 26) as u32),
        b'0'..=b'9' => Some((b - b'0' + 52) as u32),
        b'+' | b'-' => Some(62),
        b'/' | b'_' => Some(63),
        _ => None,
    }
}

fn b64_decode(s: &str) -> Result<Vec<u8>, String> {
    let clean: Vec<u8> = s
        .bytes()
        .filter(|b| !b.is_ascii_whitespace() && *b != b'=')
        .collect();
    let mut out = Vec::with_capacity((clean.len() * 3) / 4 + 3);
    for chunk in clean.chunks(4) {
        if chunk.len() < 2 {
            break;
        }
        let v0 = b64_val(chunk[0]).ok_or("Base64 không hợp lệ")?;
        let v1 = b64_val(chunk[1]).ok_or("Base64 không hợp lệ")?;
        let v2 = if chunk.len() > 2 {
            b64_val(chunk[2]).ok_or("Base64 không hợp lệ")?
        } else {
            0
        };
        let v3 = if chunk.len() > 3 {
            b64_val(chunk[3]).ok_or("Base64 không hợp lệ")?
        } else {
            0
        };
        let triple = (v0 << 18) | (v1 << 12) | (v2 << 6) | v3;
        out.push(((triple >> 16) & 0xff) as u8);
        if chunk.len() > 2 {
            out.push(((triple >> 8) & 0xff) as u8);
        }
        if chunk.len() > 3 {
            out.push((triple & 0xff) as u8);
        }
    }
    Ok(out)
}

pub fn dpapi_encrypt(plaintext: &str) -> Result<String, String> {
    let raw = plaintext.as_bytes();
    #[cfg(windows)]
    {
        let (fn_protect, _) = load_dpapi_fns()?;
        let mut buf = raw.to_vec();
        let in_blob = DataBlob {
            cb_data: buf.len() as c_ulong,
            pb_data: if buf.is_empty() {
                std::ptr::null_mut()
            } else {
                buf.as_mut_ptr()
            },
        };
        let mut out_blob = DataBlob {
            cb_data: 0,
            pb_data: std::ptr::null_mut(),
        };
        let descr: Vec<u16> = "DuckAiDpapiVault\0".encode_utf16().collect();
        let ok = unsafe {
            fn_protect(
                &in_blob,
                descr.as_ptr(),
                std::ptr::null(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut out_blob,
            )
        };
        if ok == 0 || out_blob.pb_data.is_null() {
            return Err("Windows DPAPI CryptProtectData thất bại.".to_string());
        }
        let encrypted = unsafe {
            std::slice::from_raw_parts(out_blob.pb_data, out_blob.cb_data as usize).to_vec()
        };
        unsafe {
            LocalFree(out_blob.pb_data as *mut c_void);
        }
        Ok(format!("dpapi:{}", b64_encode(&encrypted)))
    }
    #[cfg(not(windows))]
    {
        Ok(format!("b64:{}", b64_encode(raw)))
    }
}

pub fn dpapi_decrypt(cipher_text: &str) -> Result<String, String> {
    let trimmed = cipher_text.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }
    #[cfg(windows)]
    if let Some(rest) = trimmed.strip_prefix("dpapi:") {
        let (_, fn_unprotect) = load_dpapi_fns()?;
        let mut raw = b64_decode(rest)?;
        let in_blob = DataBlob {
            cb_data: raw.len() as c_ulong,
            pb_data: if raw.is_empty() {
                std::ptr::null_mut()
            } else {
                raw.as_mut_ptr()
            },
        };
        let mut out_blob = DataBlob {
            cb_data: 0,
            pb_data: std::ptr::null_mut(),
        };
        let ok = unsafe {
            fn_unprotect(
                &in_blob,
                std::ptr::null_mut(),
                std::ptr::null(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut out_blob,
            )
        };
        if ok == 0 {
            return Err("Windows DPAPI CryptUnprotectData thất bại (khác tài khoản Windows hoặc dữ liệu hỏng).".to_string());
        }
        let decrypted = if out_blob.pb_data.is_null() || out_blob.cb_data == 0 {
            Vec::new()
        } else {
            unsafe { std::slice::from_raw_parts(out_blob.pb_data, out_blob.cb_data as usize).to_vec() }
        };
        if !out_blob.pb_data.is_null() {
            unsafe {
                LocalFree(out_blob.pb_data as *mut c_void);
            }
        }
        return String::from_utf8(decrypted).map_err(|e| format!("UTF-8 giải mã lỗi: {e}"));
    }
    if let Some(rest) = trimmed.strip_prefix("b64:") {
        let bytes = b64_decode(rest)?;
        return String::from_utf8(bytes).map_err(|e| format!("UTF-8 lỗi: {e}"));
    }
    Err("Định dạng chuỗi mã hóa Vault không hợp lệ.".to_string())
}

pub fn mask_api_key(raw: &str) -> String {
    let k = raw.trim();
    if k.chars().count() <= 10 {
        return "***".to_string();
    }
    let prefix: String = k.chars().take(6).collect();
    let suffix: String = k
        .chars()
        .rev()
        .take(4)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    format!("{prefix}...{suffix}")
}

fn now_unix_sec() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct StoredApiKeyRecord {
    id: String,
    provider: String,
    label: String,
    masked_key: String,
    key_hash: String,
    key_enc: String,
    #[serde(default)]
    account_id: String,
    created_at: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
struct ApiKeyVaultFile {
    #[serde(default)]
    strategy: String,
    #[serde(default)]
    keys: Vec<StoredApiKeyRecord>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PublicVaultKeyInfo {
    pub id: String,
    pub provider: String,
    pub label: String,
    pub masked_key: String,
    pub encryption: String,
    pub created_at: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct StoredWebCredential {
    site: String,
    login_url: String,
    username: String,
    password_enc: String,
    notes: String,
    updated_at: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PublicWebCredential {
    pub site: String,
    pub login_url: String,
    pub username: String,
    pub notes: String,
    pub has_password: bool,
    pub encryption: String,
    pub updated_at: u64,
}

#[derive(Clone, Debug)]
pub struct ProviderEndpoint {
    pub endpoint_id: String,
    pub provider: String, // "gemini" | "groq" | "cloudflare"
    pub model: String,
    pub api_key: String,
    pub account_id: String,
    pub priority: i32,
    pub status: String, // "healthy" | "cooldown" | "disabled"
    pub cooldown_until: u64,
    pub requests: u64,
    pub successes: u64,
    pub errors: u64,
    pub last_error: String,
    pub last_latency_ms: u64,
    pub ewma_latency_ms: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PublicEndpointStatus {
    pub endpoint_id: String,
    pub provider: String,
    pub model: String,
    pub priority: i32,
    pub status: String,
    pub cooldown_remaining_sec: u64,
    pub requests: u64,
    pub successes: u64,
    pub errors: u64,
    pub last_latency_ms: u64,
    pub ewma_latency_ms: u64,
    pub last_error: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RouterStatusPayload {
    pub strategy: String,
    pub total_endpoints: usize,
    pub healthy_endpoints: usize,
    pub endpoints: Vec<PublicEndpointStatus>,
    pub vault_keys: Vec<PublicVaultKeyInfo>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RouterChatResponse {
    pub reply: String,
    pub provider: String,
    pub model: String,
    pub endpoint_id: String,
    pub latency_ms: u64,
    pub rotated_attempts: usize,
}

impl ProviderEndpoint {
    pub fn refresh_availability(&mut self, now: u64) -> bool {
        if self.status == "disabled" {
            return false;
        }
        if self.status == "cooldown" {
            if now >= self.cooldown_until {
                self.status = "healthy".to_string();
                self.cooldown_until = 0;
                return true;
            }
            return false;
        }
        true
    }

    pub fn adaptive_score(&self) -> f64 {
        let err_rate = if self.requests == 0 {
            0.0
        } else {
            (self.errors as f64) / (self.requests as f64)
        };
        let lat_pen = if self.ewma_latency_ms > 0.0 {
            (self.ewma_latency_ms / 1000.0) * 3.0
        } else {
            0.0
        };
        let err_pen = err_rate * 25.0;
        (self.priority as f64) + lat_pen + err_pen
    }

    pub fn to_public(&mut self, now: u64) -> PublicEndpointStatus {
        self.refresh_availability(now);
        let rem = if self.status == "cooldown" && self.cooldown_until > now {
            self.cooldown_until - now
        } else {
            0
        };
        PublicEndpointStatus {
            endpoint_id: self.endpoint_id.clone(),
            provider: self.provider.clone(),
            model: self.model.clone(),
            priority: self.priority,
            status: self.status.clone(),
            cooldown_remaining_sec: rem,
            requests: self.requests,
            successes: self.successes,
            errors: self.errors,
            last_latency_ms: self.last_latency_ms,
            ewma_latency_ms: self.ewma_latency_ms.round() as u64,
            last_error: self.last_error.chars().take(150).collect(),
        }
    }
}

struct RouterInner {
    strategy: String,
    rr_index: usize,
    endpoints: Vec<ProviderEndpoint>,
    vault_dir: PathBuf,
}

pub struct RouterState {
    inner: Mutex<RouterInner>,
}

fn resolve_vault_dir(app_data_dir: Option<PathBuf>) -> PathBuf {
    if let Some(root) = PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent() {
        if root.exists() {
            let local_data = root.join("data");
            let _ = std::fs::create_dir_all(&local_data);
            return local_data;
        }
    }
    if let Some(d) = app_data_dir {
        let _ = std::fs::create_dir_all(&d);
        return d;
    }
    let fallback = PathBuf::from("data");
    let _ = std::fs::create_dir_all(&fallback);
    fallback
}

fn read_vault_file(path: &PathBuf) -> ApiKeyVaultFile {
    let Ok(raw) = std::fs::read_to_string(path) else {
        return ApiKeyVaultFile::default();
    };
    serde_json::from_str::<ApiKeyVaultFile>(&raw).unwrap_or_default()
}

fn write_vault_file(path: &PathBuf, data: &ApiKeyVaultFile) -> Result<(), String> {
    if let Some(p) = path.parent() {
        let _ = std::fs::create_dir_all(p);
    }
    let json_str = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, json_str.as_bytes()).map_err(|e| format!("Không thể ghi DPAPI Vault: {e}"))?;
    std::fs::rename(&tmp, path).map_err(|e| format!("Không thể lưu DPAPI Vault: {e}"))?;
    Ok(())
}

fn split_keys_csv(raw: &str) -> Vec<String> {
    raw.split(|c: char| c == ',' || c == ';' || c == '\n' || c == '\r')
        .map(|s| s.trim().to_string())
        .filter(|s| s.len() >= 12 && !s.to_ascii_lowercase().starts_with("your_"))
        .collect()
}

fn discover_cloudflare_account_id(api_token: &str) -> String {
    let mut cmd = Command::new("curl.exe");
    cmd.args([
        "-sS",
        "-m",
        "6",
        "-H",
        &format!("Authorization: Bearer {}", api_token.trim()),
        "https://api.cloudflare.com/client/v4/accounts",
    ]);
    apply_no_window(&mut cmd);
    if let Ok(out) = cmd.output() {
        if out.status.success() {
            let txt = String::from_utf8_lossy(&out.stdout);
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(txt.trim()) {
                if let Some(id) = v["result"][0]["id"].as_str() {
                    return id.trim().to_string();
                }
            }
        }
    }
    String::new()
}

fn build_endpoints_from_sources(vault: &ApiKeyVaultFile) -> Vec<ProviderEndpoint> {
    let mut endpoints = Vec::new();
    let mut seen_gemini = HashSet::new();
    let mut gemini_keys = Vec::new();

    if let Some(k) = read_env_value("GEMINI_API_KEY") {
        for item in split_keys_csv(&k) {
            if seen_gemini.insert(item.clone()) {
                gemini_keys.push(item);
            }
        }
    }
    if let Some(ks) = read_env_value("GEMINI_API_KEYS") {
        for item in split_keys_csv(&ks) {
            if seen_gemini.insert(item.clone()) {
                gemini_keys.push(item);
            }
        }
    }
    for rec in &vault.keys {
        if rec.provider == "gemini" {
            if let Ok(dec) = dpapi_decrypt(&rec.key_enc) {
                let clean = dec.trim().to_string();
                if clean.len() >= 12 && seen_gemini.insert(clean.clone()) {
                    gemini_keys.push(clean);
                }
            }
        }
    }

    let gemini_models = [
        ("gemini-3.5-flash", 10),
        ("gemini-2.5-flash", 28),
        ("gemini-2.0-flash", 46),
    ];
    for (idx, gkey) in gemini_keys.iter().enumerate() {
        let key_num = idx + 1;
        for (model, base_prio) in gemini_models {
            endpoints.push(ProviderEndpoint {
                endpoint_id: format!("gemini#{key_num}:{model}"),
                provider: "gemini".to_string(),
                model: model.to_string(),
                api_key: gkey.clone(),
                account_id: String::new(),
                priority: base_prio + ((idx as i32) * 2),
                status: "healthy".to_string(),
                cooldown_until: 0,
                requests: 0,
                successes: 0,
                errors: 0,
                last_error: String::new(),
                last_latency_ms: 0,
                ewma_latency_ms: 0.0,
            });
        }
    }

    // Groq Free Tier Pool (OpenAI-compatible)
    let mut seen_groq = HashSet::new();
    let mut groq_keys = Vec::new();
    for env_name in ["GROQ_API_KEY", "GROQ_API_KEYS"] {
        if let Some(raw) = read_env_value(env_name) {
            for item in split_keys_csv(&raw) {
                if seen_groq.insert(item.clone()) {
                    groq_keys.push(item);
                }
            }
        }
    }
    for rec in &vault.keys {
        if rec.provider == "groq" {
            if let Ok(dec) = dpapi_decrypt(&rec.key_enc) {
                let clean = dec.trim().to_string();
                if clean.len() >= 12 && seen_groq.insert(clean.clone()) {
                    groq_keys.push(clean);
                }
            }
        }
    }

    let groq_models = [
        ("llama-3.3-70b-versatile", 18),
        ("openai/gpt-oss-120b", 24),
        ("llama-3.1-8b-instant", 38),
    ];
    for (idx, grkey) in groq_keys.iter().enumerate() {
        let key_num = idx + 1;
        for (model, base_prio) in groq_models {
            endpoints.push(ProviderEndpoint {
                endpoint_id: format!("groq#{key_num}:{model}"),
                provider: "groq".to_string(),
                model: model.to_string(),
                api_key: grkey.clone(),
                account_id: String::new(),
                priority: base_prio + ((idx as i32) * 2),
                status: "healthy".to_string(),
                cooldown_until: 0,
                requests: 0,
                successes: 0,
                errors: 0,
                last_error: String::new(),
                last_latency_ms: 0,
                ewma_latency_ms: 0.0,
            });
        }
    }

    // Cloudflare Workers AI Pool
    let mut cf_tokens: Vec<(String, String)> = Vec::new();
    let env_cf_acc = read_env_value("CLOUDFLARE_ACCOUNT_ID").unwrap_or_default();
    if let Some(tok) = read_env_value("CLOUDFLARE_API_TOKEN") {
        for t in split_keys_csv(&tok) {
            cf_tokens.push((t, env_cf_acc.clone()));
        }
    }
    for rec in &vault.keys {
        if rec.provider == "cloudflare" {
            if let Ok(dec) = dpapi_decrypt(&rec.key_enc) {
                let clean = dec.trim().to_string();
                if clean.len() >= 12 {
                    let acc = if !rec.account_id.trim().is_empty() {
                        rec.account_id.trim().to_string()
                    } else {
                        env_cf_acc.clone()
                    };
                    cf_tokens.push((clean, acc));
                }
            }
        }
    }

    let cf_models = [
        ("@cf/meta/llama-3.3-70b-instruct-fp8-fast", 34),
        ("@cf/google/gemma-3-12b-it", 52),
    ];
    for (idx, (tok, mut acc)) in cf_tokens.into_iter().enumerate() {
        if acc.is_empty() {
            acc = discover_cloudflare_account_id(&tok);
        }
        let key_num = idx + 1;
        for (model, base_prio) in cf_models {
            let short = model.rsplit('/').next().unwrap_or(model);
            let has_acc = !acc.is_empty();
            endpoints.push(ProviderEndpoint {
                endpoint_id: format!("cloudflare#{key_num}:{short}"),
                provider: "cloudflare".to_string(),
                model: model.to_string(),
                api_key: tok.clone(),
                account_id: acc.clone(),
                priority: base_prio + ((idx as i32) * 2),
                status: if has_acc {
                    "healthy".to_string()
                } else {
                    "disabled".to_string()
                },
                cooldown_until: 0,
                requests: 0,
                successes: 0,
                errors: 0,
                last_error: if has_acc {
                    String::new()
                } else {
                    "Thiếu CLOUDFLARE_ACCOUNT_ID trong .env hoặc cấu hình Vault.".to_string()
                },
                last_latency_ms: 0,
                ewma_latency_ms: 0.0,
            });
        }
    }

    endpoints.sort_by_key(|e| e.priority);
    endpoints
}

impl RouterState {
    pub fn new(app_data_dir: Option<PathBuf>) -> Self {
        let vault_dir = resolve_vault_dir(app_data_dir);
        let api_vault_path = vault_dir.join("api_keys.enc.json");
        let vault = read_vault_file(&api_vault_path);
        let env_strat = read_env_value("LLM_ROUTER_STRATEGY").unwrap_or_default();
        let strategy = if vault.strategy == "round_robin" || env_strat.eq_ignore_ascii_case("round_robin") {
            "round_robin".to_string()
        } else {
            "priority".to_string()
        };
        let endpoints = build_endpoints_from_sources(&vault);
        Self {
            inner: Mutex::new(RouterInner {
                strategy,
                rr_index: 0,
                endpoints,
                vault_dir,
            }),
        }
    }

    pub fn collect_decrypted_keys(&self, provider: &str) -> Vec<String> {
        let Ok(guard) = self.inner.lock() else {
            return Vec::new();
        };
        let mut keys = Vec::new();
        let mut seen = HashSet::new();
        for ep in &guard.endpoints {
            if ep.provider.eq_ignore_ascii_case(provider)
                && ep.status != "disabled"
                && !ep.api_key.trim().is_empty()
                && seen.insert(ep.api_key.clone())
            {
                keys.push(ep.api_key.clone());
            }
        }
        keys
    }

    pub fn select_candidates(&self, preferred: Option<&str>, override_gemini_key: Option<&str>) -> Vec<ProviderEndpoint> {
        let Ok(mut guard) = self.inner.lock() else {
            return Vec::new();
        };
        let now = now_unix_sec();
        for ep in &mut guard.endpoints {
            ep.refresh_availability(now);
        }

        let mut avail: Vec<ProviderEndpoint> = guard
            .endpoints
            .iter()
            .filter(|e| e.status == "healthy")
            .cloned()
            .collect();

        // If caller passed an explicit ad-hoc Gemini key not yet in pool, include it as top fallback
        if let Some(ov_key) = override_gemini_key {
            let trimmed = ov_key.trim();
            if trimmed.len() >= 12
                && !trimmed.to_ascii_lowercase().starts_with("your_")
                && !guard.endpoints.iter().any(|e| e.api_key == trimmed)
            {
                avail.insert(
                    0,
                    ProviderEndpoint {
                        endpoint_id: "gemini#override:gemini-3.5-flash".to_string(),
                        provider: "gemini".to_string(),
                        model: "gemini-3.5-flash".to_string(),
                        api_key: trimmed.to_string(),
                        account_id: String::new(),
                        priority: 5,
                        status: "healthy".to_string(),
                        cooldown_until: 0,
                        requests: 0,
                        successes: 0,
                        errors: 0,
                        last_error: String::new(),
                        last_latency_ms: 0,
                        ewma_latency_ms: 0.0,
                    },
                );
            }
        }

        if avail.is_empty() {
            // Pick cooldown endpoints expiring soonest (excluding disabled)
            let mut recovering: Vec<ProviderEndpoint> = guard
                .endpoints
                .iter()
                .filter(|e| e.status != "disabled")
                .cloned()
                .collect();
            recovering.sort_by_key(|e| e.cooldown_until);
            return recovering;
        }

        if guard.strategy == "round_robin" && avail.len() > 1 {
            let idx = guard.rr_index % avail.len();
            guard.rr_index = guard.rr_index.wrapping_add(1);
            let mut rotated = avail[idx..].to_vec();
            rotated.extend_from_slice(&avail[..idx]);
            avail = rotated;
        } else {
            avail.sort_by(|a, b| {
                a.adaptive_score()
                    .partial_cmp(&b.adaptive_score())
                    .unwrap_or(std::cmp::Ordering::Equal)
            });
        }

        if let Some(pref) = preferred.map(|s| s.trim()).filter(|s| !s.is_empty() && *s != "auto" && *s != "9router") {
            let (mut matched, rest): (Vec<_>, Vec<_>) = avail.into_iter().partition(|e| {
                e.endpoint_id.eq_ignore_ascii_case(pref)
                    || e.model.eq_ignore_ascii_case(pref)
                    || e.provider.eq_ignore_ascii_case(pref)
            });
            matched.extend(rest);
            return matched;
        }

        avail
    }

    pub fn record_success(&self, endpoint_id: &str, latency_ms: u64) {
        let Ok(mut guard) = self.inner.lock() else {
            return;
        };
        if let Some(ep) = guard.endpoints.iter_mut().find(|e| e.endpoint_id == endpoint_id) {
            ep.requests += 1;
            ep.successes += 1;
            ep.last_latency_ms = latency_ms;
            ep.ewma_latency_ms = if ep.ewma_latency_ms <= 0.0 {
                latency_ms as f64
            } else {
                0.7 * ep.ewma_latency_ms + 0.3 * (latency_ms as f64)
            };
            ep.status = "healthy".to_string();
            ep.cooldown_until = 0;
            ep.last_error.clear();
        }
    }

    pub fn record_failure(&self, endpoint_id: &str, err_msg: &str) {
        let Ok(mut guard) = self.inner.lock() else {
            return;
        };
        let now = now_unix_sec();
        let low = err_msg.to_ascii_lowercase();
        if let Some(ep) = guard.endpoints.iter_mut().find(|e| e.endpoint_id == endpoint_id) {
            ep.requests += 1;
            ep.errors += 1;
            ep.last_error = err_msg.chars().take(180).collect();
            if low.contains("401")
                || low.contains("403")
                || low.contains("api key not valid")
                || low.contains("invalid api key")
                || low.contains("api_key_invalid")
            {
                ep.status = "disabled".to_string();
            } else if low.contains("429")
                || low.contains("resource_exhausted")
                || low.contains("rate_limit")
                || low.contains("quota")
            {
                let cd = if low.contains("per day") || low.contains("daily") {
                    600
                } else {
                    60
                };
                ep.status = "cooldown".to_string();
                ep.cooldown_until = now + cd;
            } else if low.contains("404") || low.contains("not found") {
                ep.status = "cooldown".to_string();
                ep.cooldown_until = now + 300;
            } else {
                ep.status = "cooldown".to_string();
                ep.cooldown_until = now + 30;
            }
        }
    }
}

fn post_http_json_with_headers(
    url: &str,
    headers: &[(&str, String)],
    payload_str: &str,
    timeout_secs: &str,
) -> Result<serde_json::Value, String> {
    let mut cmd = Command::new("curl.exe");
    cmd.args([
        "-sS",
        "-m",
        timeout_secs,
        "-X",
        "POST",
        url,
        "-H",
        "Content-Type: application/json",
    ]);
    for (k, v) in headers {
        cmd.arg("-H");
        cmd.arg(format!("{k}: {v}"));
    }
    cmd.args(["--data-binary", "@-"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    apply_no_window(&mut cmd);

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Không thể khởi chạy curl: {e}"))?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(payload_str.as_bytes())
            .map_err(|e| format!("Lỗi ghi payload HTTP: {e}"))?;
    }
    let out = child
        .wait_with_output()
        .map_err(|e| format!("Lỗi đọc phản hồi HTTP: {e}"))?;

    let stdout = String::from_utf8_lossy(&out.stdout);
    if stdout.trim().is_empty() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(format!("Endpoint không phản hồi ({stderr})."));
    }
    let v: serde_json::Value = serde_json::from_str(stdout.trim())
        .map_err(|_| format!("Phản hồi không phải JSON hợp lệ: {}", stdout.chars().take(120).collect::<String>()))?;

    if let Some(err_msg) = v["error"]["message"].as_str() {
        let code = v["error"]["code"]
            .as_i64()
            .map(|c| c.to_string())
            .or_else(|| v["error"]["status"].as_str().map(|s| s.to_string()))
            .unwrap_or_default();
        return Err(format!("HTTP {code}: {err_msg}"));
    }
    if let Some(errs) = v["errors"].as_array() {
        if let Some(first_msg) = errs.first().and_then(|e| e["message"].as_str()) {
            return Err(format!("Cloudflare AI Error: {first_msg}"));
        }
    }
    Ok(v)
}

fn call_gemini_endpoint(
    ep: &ProviderEndpoint,
    system_prompt: &str,
    messages: &[OllamaMessage],
    json_mode: bool,
    max_output_tokens: u32,
    thinking_budget: Option<u32>,
    timeout_str: &str,
) -> Result<String, String> {
    let mut contents: Vec<serde_json::Value> = Vec::new();
    for m in messages {
        if m.content.trim().is_empty() || m.role == "system" {
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

    let temp = if json_mode { 0.2 } else { 0.55 };
    let mut gen_map = serde_json::Map::new();
    gen_map.insert("temperature".to_string(), serde_json::json!(temp));
    gen_map.insert("maxOutputTokens".to_string(), serde_json::json!(max_output_tokens));
    if json_mode {
        gen_map.insert(
            "responseMimeType".to_string(),
            serde_json::json!("application/json"),
        );
    }
    if let Some(tb) = thinking_budget {
        gen_map.insert(
            "thinkingConfig".to_string(),
            serde_json::json!({ "thinkingBudget": tb }),
        );
    }

    let payload = serde_json::json!({
        "system_instruction": { "parts": [{ "text": system_prompt }] },
        "contents": contents,
        "generationConfig": serde_json::Value::Object(gen_map)
    });

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        ep.model, ep.api_key
    );

    match post_http_json_with_headers(&url, &[], &payload.to_string(), timeout_str) {
        Ok(v) => {
            if let Some((text, finish_reason)) = parse_gemini_candidate_text(&v) {
                if finish_reason == "MAX_TOKENS"
                    && json_mode
                    && serde_json::from_str::<serde_json::Value>(&text).is_err()
                {
                    return Err(format!("MAX_TOKENS cắt ngang JSON trên {}", ep.model));
                }
                return Ok(text);
            }
            Err(format!("Gemini ({}) không trả về nội dung.", ep.model))
        }
        Err(e) => {
            let low = e.to_ascii_lowercase();
            if low.contains("thinking") || low.contains("responsemimetype") || low.contains("unknown name") {
                let simple_payload = serde_json::json!({
                    "system_instruction": { "parts": [{ "text": system_prompt }] },
                    "contents": contents,
                    "generationConfig": {
                        "temperature": temp,
                        "maxOutputTokens": max_output_tokens.min(8192)
                    }
                });
                let v2 = post_http_json_with_headers(&url, &[], &simple_payload.to_string(), timeout_str)?;
                if let Some((t2, _)) = parse_gemini_candidate_text(&v2) {
                    return Ok(t2);
                }
            }
            Err(e)
        }
    }
}

fn call_openai_compat_endpoint(
    ep: &ProviderEndpoint,
    base_url: &str,
    system_prompt: &str,
    messages: &[OllamaMessage],
    json_mode: bool,
    max_output_tokens: u32,
    timeout_str: &str,
) -> Result<String, String> {
    let mut oai_msgs: Vec<serde_json::Value> = Vec::new();
    if !system_prompt.trim().is_empty() {
        oai_msgs.push(serde_json::json!({
            "role": "system",
            "content": system_prompt
        }));
    }
    for m in messages {
        if m.content.trim().is_empty() || m.role == "system" {
            continue;
        }
        let mut content = m.content.clone();
        if ep.provider == "groq" && content.len() > 6000 {
            content = format!("{}... [truncated]", content.chars().take(5800).collect::<String>());
        }
        oai_msgs.push(serde_json::json!({
            "role": if m.role == "assistant" { "assistant" } else { "user" },
            "content": content
        }));
    }
    if oai_msgs.len() <= 1 {
        oai_msgs.push(serde_json::json!({ "role": "user", "content": "Xin chào" }));
    }

    let mut body = serde_json::Map::new();
    body.insert("model".to_string(), serde_json::json!(ep.model));
    body.insert("messages".to_string(), serde_json::Value::Array(oai_msgs));
    body.insert(
        "temperature".to_string(),
        serde_json::json!(if json_mode { 0.2 } else { 0.55 }),
    );
    body.insert(
        "max_tokens".to_string(),
        serde_json::json!(max_output_tokens.min(8192)),
    );
    if json_mode && ep.provider == "groq" {
        body.insert(
            "response_format".to_string(),
            serde_json::json!({ "type": "json_object" }),
        );
    }

    let headers = [("Authorization", format!("Bearer {}", ep.api_key))];
    let v = post_http_json_with_headers(
        base_url,
        &headers,
        &serde_json::Value::Object(body).to_string(),
        timeout_str,
    )?;

    let text = v["choices"][0]["message"]["content"]
        .as_str()
        .or_else(|| v["result"]["response"].as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if text.is_empty() {
        return Err(format!("{} ({}) trả về chuỗi rỗng.", ep.provider, ep.model));
    }
    Ok(text)
}

pub fn execute_9router_sync(
    router: &RouterState,
    preferred: Option<&str>,
    override_api_key: Option<&str>,
    system_prompt: &str,
    messages: &[OllamaMessage],
    json_mode: bool,
    max_output_tokens: u32,
    thinking_budget: Option<u32>,
) -> Result<RouterChatResponse, String> {
    let candidates = router.select_candidates(preferred, override_api_key);
    if candidates.is_empty() {
        return Err(
            "Chưa có API Key nào khả dụng trong 9Router (.env hoặc DPAPI Vault). Hãy thêm GEMINI_API_KEY / GROQ_API_KEY trong Studio 3D -> AI.".to_string(),
        );
    }

    let timeout_str = if json_mode || max_output_tokens >= 12000 {
        "90"
    } else {
        "45"
    };

    let mut last_err = String::new();
    for (idx, ep) in candidates.iter().enumerate() {
        let t0 = Instant::now();
        let res = match ep.provider.as_str() {
            "gemini" => call_gemini_endpoint(
                ep,
                system_prompt,
                messages,
                json_mode,
                max_output_tokens,
                thinking_budget,
                timeout_str,
            ),
            "groq" => call_openai_compat_endpoint(
                ep,
                "https://api.groq.com/openai/v1/chat/completions",
                system_prompt,
                messages,
                json_mode,
                max_output_tokens,
                timeout_str,
            ),
            "cloudflare" => {
                if ep.account_id.trim().is_empty() {
                    Err("Thiếu CLOUDFLARE_ACCOUNT_ID".to_string())
                } else {
                    let cf_url = format!(
                        "https://api.cloudflare.com/client/v4/accounts/{}/ai/v1/chat/completions",
                        ep.account_id.trim()
                    );
                    call_openai_compat_endpoint(
                        ep,
                        &cf_url,
                        system_prompt,
                        messages,
                        json_mode,
                        max_output_tokens,
                        timeout_str,
                    )
                }
            }
            other => Err(format!("Provider không hỗ trợ: {other}")),
        };

        let elapsed_ms = t0.elapsed().as_millis() as u64;
        match res {
            Ok(reply) => {
                router.record_success(&ep.endpoint_id, elapsed_ms);
                return Ok(RouterChatResponse {
                    reply,
                    provider: ep.provider.clone(),
                    model: ep.model.clone(),
                    endpoint_id: ep.endpoint_id.clone(),
                    latency_ms: elapsed_ms,
                    rotated_attempts: idx,
                });
            }
            Err(err) => {
                router.record_failure(&ep.endpoint_id, &err);
                last_err = format!("[{}] {}", ep.endpoint_id, err);
            }
        }
    }

    Err(if last_err.is_empty() {
        "Tất cả endpoint trong 9Router đều đang quá tải hoặc lỗi kết nối.".to_string()
    } else {
        format!("9Router đã thử xoay vòng {} endpoint nhưng đều lỗi. Cuối cùng: {}", candidates.len(), last_err)
    })
}

fn collect_status_snapshot(guard: &mut RouterInner) -> RouterStatusPayload {
    let now = now_unix_sec();
    let endpoints: Vec<PublicEndpointStatus> = guard
        .endpoints
        .iter_mut()
        .map(|e| e.to_public(now))
        .collect();
    let healthy_endpoints = endpoints.iter().filter(|e| e.status == "healthy").count();
    let vault_file = read_vault_file(&guard.vault_dir.join("api_keys.enc.json"));
    let vault_keys = vault_file
        .keys
        .into_iter()
        .map(|k| PublicVaultKeyInfo {
            id: k.id,
            provider: k.provider,
            label: k.label,
            masked_key: k.masked_key,
            encryption: if k.key_enc.starts_with("dpapi:") {
                "Windows DPAPI".to_string()
            } else {
                "Base64".to_string()
            },
            created_at: k.created_at,
        })
        .collect();

    RouterStatusPayload {
        strategy: guard.strategy.clone(),
        total_endpoints: endpoints.len(),
        healthy_endpoints,
        endpoints,
        vault_keys,
    }
}

#[tauri::command]
pub fn router_get_status(router: State<'_, RouterState>) -> Result<RouterStatusPayload, String> {
    let mut guard = router.inner.lock().map_err(|e| e.to_string())?;
    Ok(collect_status_snapshot(&mut guard))
}

#[tauri::command]
pub fn router_reload_pool(router: State<'_, RouterState>) -> Result<RouterStatusPayload, String> {
    let mut guard = router.inner.lock().map_err(|e| e.to_string())?;
    let vault = read_vault_file(&guard.vault_dir.join("api_keys.enc.json"));
    if vault.strategy == "round_robin" || vault.strategy == "priority" {
        guard.strategy = vault.strategy.clone();
    }
    guard.endpoints = build_endpoints_from_sources(&vault);
    Ok(collect_status_snapshot(&mut guard))
}

#[tauri::command]
pub fn router_set_strategy(
    router: State<'_, RouterState>,
    strategy: String,
) -> Result<RouterStatusPayload, String> {
    let clean = strategy.trim().to_ascii_lowercase();
    if clean != "priority" && clean != "round_robin" {
        return Err("Chiến lược 9Router chỉ hỗ trợ 'priority' hoặc 'round_robin'.".to_string());
    }
    let mut guard = router.inner.lock().map_err(|e| e.to_string())?;
    let path = guard.vault_dir.join("api_keys.enc.json");
    let mut vault = read_vault_file(&path);
    vault.strategy = clean.clone();
    write_vault_file(&path, &vault)?;
    guard.strategy = clean;
    Ok(collect_status_snapshot(&mut guard))
}

#[tauri::command]
pub fn router_add_api_keys(
    router: State<'_, RouterState>,
    provider: String,
    raw_keys: String,
    label: Option<String>,
    account_id: Option<String>,
) -> Result<RouterStatusPayload, String> {
    let prov = provider.trim().to_ascii_lowercase();
    if prov != "gemini" && prov != "groq" && prov != "cloudflare" {
        return Err("Chỉ hỗ trợ provider 'gemini', 'groq' hoặc 'cloudflare'.".to_string());
    }
    let parts = split_keys_csv(&raw_keys);
    if parts.is_empty() {
        return Err("Vui lòng nhập ít nhất 1 API Key hợp lệ (>= 12 ký tự).".to_string());
    }

    let mut guard = router.inner.lock().map_err(|e| e.to_string())?;
    let path = guard.vault_dir.join("api_keys.enc.json");
    let mut vault = read_vault_file(&path);
    let existing_hashes: HashSet<String> = vault.keys.iter().map(|k| k.key_hash.clone()).collect();
    let now = now_unix_sec();
    let base_label = label.unwrap_or_default().trim().to_string();
    let cf_acc = account_id.unwrap_or_default().trim().to_string();

    for (idx, k) in parts.iter().enumerate() {
        let digest = sha256_bytes(format!("{prov}:{k}").as_bytes());
        let khash: String = digest.iter().take(8).map(|b| format!("{b:02x}")).collect();
        if existing_hashes.contains(&khash) {
            continue;
        }
        let enc = dpapi_encrypt(k)?;
        let item_label = if !base_label.is_empty() {
            if parts.len() > 1 {
                format!("{base_label} #{}", idx + 1)
            } else {
                base_label.clone()
            }
        } else {
            let count = vault.keys.iter().filter(|x| x.provider == prov).count() + 1;
            format!("{} Vault #{count}", prov.to_uppercase())
        };
        vault.keys.push(StoredApiKeyRecord {
            id: format!("vk_{}_{}", &khash[..10], now % 100_000),
            provider: prov.clone(),
            label: item_label,
            masked_key: mask_api_key(k),
            key_hash: khash,
            key_enc: enc,
            account_id: cf_acc.clone(),
            created_at: now,
        });
    }

    write_vault_file(&path, &vault)?;
    guard.endpoints = build_endpoints_from_sources(&vault);
    Ok(collect_status_snapshot(&mut guard))
}

#[tauri::command]
pub fn router_delete_api_key(
    router: State<'_, RouterState>,
    key_id: String,
) -> Result<RouterStatusPayload, String> {
    let target = key_id.trim();
    let mut guard = router.inner.lock().map_err(|e| e.to_string())?;
    let path = guard.vault_dir.join("api_keys.enc.json");
    let mut vault = read_vault_file(&path);
    vault.keys.retain(|k| k.id != target);
    write_vault_file(&path, &vault)?;
    guard.endpoints = build_endpoints_from_sources(&vault);
    Ok(collect_status_snapshot(&mut guard))
}

#[tauri::command]
pub async fn ask_9router(
    router: State<'_, RouterState>,
    preferred: Option<String>,
    api_key: Option<String>,
    system_prompt: String,
    messages: Vec<OllamaMessage>,
    json_mode: Option<bool>,
    max_output_tokens: Option<u32>,
    thinking_budget: Option<u32>,
) -> Result<RouterChatResponse, String> {
    let use_json = json_mode.unwrap_or(false);
    let out_toks = max_output_tokens
        .unwrap_or(if use_json { 16384 } else { 8192 })
        .clamp(512, 32768);

    // Clone Arc-like snapshot via unsafe-free scoped execution using tauri State
    // Note: execute_9router_sync only locks Mutex briefly to select & record metrics
    let candidates = router.select_candidates(preferred.as_deref(), api_key.as_deref());
    if candidates.is_empty() {
        return Err(
            "Chưa có API Key nào khả dụng trong 9Router (.env hoặc DPAPI Vault). Hãy thêm GEMINI_API_KEY / GROQ_API_KEY trong Studio 3D -> AI.".to_string(),
        );
    }

    let timeout_str = if use_json || out_toks >= 12000 { "90" } else { "45" };
    let mut last_err = String::new();

    for (idx, ep) in candidates.into_iter().enumerate() {
        let ep_clone = ep.clone();
        let sys_clone = system_prompt.clone();
        let msgs_clone = messages.clone();
        let t0 = Instant::now();

        let call_res = tauri::async_runtime::spawn_blocking(move || match ep_clone.provider.as_str() {
            "gemini" => call_gemini_endpoint(
                &ep_clone,
                &sys_clone,
                &msgs_clone,
                use_json,
                out_toks,
                thinking_budget,
                timeout_str,
            ),
            "groq" => call_openai_compat_endpoint(
                &ep_clone,
                "https://api.groq.com/openai/v1/chat/completions",
                &sys_clone,
                &msgs_clone,
                use_json,
                out_toks,
                timeout_str,
            ),
            "cloudflare" => {
                if ep_clone.account_id.trim().is_empty() {
                    Err("Thiếu CLOUDFLARE_ACCOUNT_ID".to_string())
                } else {
                    let cf_url = format!(
                        "https://api.cloudflare.com/client/v4/accounts/{}/ai/v1/chat/completions",
                        ep_clone.account_id.trim()
                    );
                    call_openai_compat_endpoint(
                        &ep_clone,
                        &cf_url,
                        &sys_clone,
                        &msgs_clone,
                        use_json,
                        out_toks,
                        timeout_str,
                    )
                }
            }
            other => Err(format!("Provider không hỗ trợ: {other}")),
        })
        .await
        .map_err(|e| format!("Lỗi luồng 9Router: {e}"))?;

        let elapsed_ms = t0.elapsed().as_millis() as u64;
        match call_res {
            Ok(reply) => {
                router.record_success(&ep.endpoint_id, elapsed_ms);
                return Ok(RouterChatResponse {
                    reply,
                    provider: ep.provider,
                    model: ep.model,
                    endpoint_id: ep.endpoint_id,
                    latency_ms: elapsed_ms,
                    rotated_attempts: idx,
                });
            }
            Err(err) => {
                router.record_failure(&ep.endpoint_id, &err);
                last_err = format!("[{}] {}", ep.endpoint_id, err);
            }
        }
    }

    Err(format!("9Router đã thử xoay vòng tất cả endpoint nhưng đều lỗi: {last_err}"))
}

pub async fn ask_9router_ref(
    router: &RouterState,
    preferred: Option<&str>,
    system_prompt: &str,
    user_prompt: &str,
    max_output_tokens: u32,
) -> Result<String, String> {
    let candidates = router.select_candidates(preferred, None);
    if candidates.is_empty() {
        return Err(
            "Chưa có API Key nào khả dụng trong 9Router (.env hoặc DPAPI Vault). Hãy thêm GEMINI_API_KEY / GROQ_API_KEY trong Studio 3D -> AI.".to_string(),
        );
    }
    let out_toks = max_output_tokens.clamp(512, 32768);
    let timeout_str = if out_toks >= 8192 { "90" } else { "45" };
    let messages = vec![OllamaMessage {
        role: "user".to_string(),
        content: user_prompt.to_string(),
    }];
    let mut last_err = String::new();

    for ep in candidates {
        let ep_clone = ep.clone();
        let sys_clone = system_prompt.to_string();
        let msgs_clone = messages.clone();
        let t0 = Instant::now();

        let call_res = tauri::async_runtime::spawn_blocking(move || match ep_clone.provider.as_str() {
            "gemini" => call_gemini_endpoint(
                &ep_clone,
                &sys_clone,
                &msgs_clone,
                false,
                out_toks,
                None,
                timeout_str,
            ),
            "groq" => call_openai_compat_endpoint(
                &ep_clone,
                "https://api.groq.com/openai/v1/chat/completions",
                &sys_clone,
                &msgs_clone,
                false,
                out_toks,
                timeout_str,
            ),
            "cloudflare" => {
                if ep_clone.account_id.trim().is_empty() {
                    Err("Thiếu CLOUDFLARE_ACCOUNT_ID".to_string())
                } else {
                    let cf_url = format!(
                        "https://api.cloudflare.com/client/v4/accounts/{}/ai/v1/chat/completions",
                        ep_clone.account_id.trim()
                    );
                    call_openai_compat_endpoint(
                        &ep_clone,
                        &cf_url,
                        &sys_clone,
                        &msgs_clone,
                        false,
                        out_toks,
                        timeout_str,
                    )
                }
            }
            other => Err(format!("Provider không hỗ trợ: {other}")),
        })
        .await
        .map_err(|e| format!("Lỗi luồng 9Router: {e}"))?;

        let elapsed_ms = t0.elapsed().as_millis() as u64;
        match call_res {
            Ok(reply) => {
                router.record_success(&ep.endpoint_id, elapsed_ms);
                return Ok(reply);
            }
            Err(err) => {
                router.record_failure(&ep.endpoint_id, &err);
                last_err = format!("[{}] {}", ep.endpoint_id, err);
            }
        }
    }

    Err(format!("9Router đã thử xoay vòng tất cả endpoint nhưng đều lỗi: {last_err}"))
}

// ============================================================================
// Encrypted Web Credential Vault (Windows DPAPI, compatible with proj11)
// ============================================================================

fn normalize_site_key(raw: &str) -> String {
    let lower = raw.trim().to_ascii_lowercase();
    let stripped = lower
        .strip_prefix("https://")
        .or_else(|| lower.strip_prefix("http://"))
        .unwrap_or(&lower);
    stripped.split('/').next().unwrap_or("").trim().to_string()
}

fn read_web_vault(path: &PathBuf) -> std::collections::BTreeMap<String, StoredWebCredential> {
    let Ok(raw) = std::fs::read_to_string(path) else {
        return std::collections::BTreeMap::new();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn write_web_vault(
    path: &PathBuf,
    map: &std::collections::BTreeMap<String, StoredWebCredential>,
) -> Result<(), String> {
    if let Some(p) = path.parent() {
        let _ = std::fs::create_dir_all(p);
    }
    let json_str = serde_json::to_string_pretty(map).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, json_str.as_bytes()).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn vault_list_web_credentials(
    router: State<'_, RouterState>,
) -> Result<Vec<PublicWebCredential>, String> {
    let guard = router.inner.lock().map_err(|e| e.to_string())?;
    let map = read_web_vault(&guard.vault_dir.join("web_vault.enc.json"));
    Ok(map
        .into_values()
        .map(|r| PublicWebCredential {
            site: r.site,
            login_url: r.login_url,
            username: r.username,
            notes: r.notes,
            has_password: !r.password_enc.is_empty(),
            encryption: if r.password_enc.starts_with("dpapi:") {
                "Windows DPAPI".to_string()
            } else {
                "Base64".to_string()
            },
            updated_at: r.updated_at,
        })
        .collect())
}

#[tauri::command]
pub fn vault_save_web_credential(
    router: State<'_, RouterState>,
    site: String,
    username: String,
    password: String,
    login_url: Option<String>,
    notes: Option<String>,
) -> Result<PublicWebCredential, String> {
    let key = normalize_site_key(&site);
    if key.is_empty() {
        return Err("Tên trang web không được để trống (vd: gmail, github).".to_string());
    }
    if username.trim().is_empty() {
        return Err("Tài khoản / Email không được để trống.".to_string());
    }
    let guard = router.inner.lock().map_err(|e| e.to_string())?;
    let path = guard.vault_dir.join("web_vault.enc.json");
    let mut map = read_web_vault(&path);
    let existing = map.get(&key).cloned();

    let pw_enc = if !password.is_empty() {
        dpapi_encrypt(&password)?
    } else if let Some(ex) = &existing {
        ex.password_enc.clone()
    } else {
        return Err("Mật khẩu không được để trống cho tài khoản mới.".to_string());
    };

    let now = now_unix_sec();
    let rec = StoredWebCredential {
        site: key.clone(),
        login_url: login_url
            .unwrap_or_else(|| existing.as_ref().map(|e| e.login_url.clone()).unwrap_or_default())
            .trim()
            .to_string(),
        username: username.trim().to_string(),
        password_enc: pw_enc.clone(),
        notes: notes
            .unwrap_or_else(|| existing.as_ref().map(|e| e.notes.clone()).unwrap_or_default())
            .trim()
            .to_string(),
        updated_at: now,
    };
    map.insert(key.clone(), rec.clone());
    write_web_vault(&path, &map)?;

    Ok(PublicWebCredential {
        site: rec.site,
        login_url: rec.login_url,
        username: rec.username,
        notes: rec.notes,
        has_password: true,
        encryption: if pw_enc.starts_with("dpapi:") {
            "Windows DPAPI".to_string()
        } else {
            "Base64".to_string()
        },
        updated_at: now,
    })
}

#[tauri::command]
pub fn vault_delete_web_credential(
    router: State<'_, RouterState>,
    site: String,
) -> Result<bool, String> {
    let key = normalize_site_key(&site);
    let guard = router.inner.lock().map_err(|e| e.to_string())?;
    let path = guard.vault_dir.join("web_vault.enc.json");
    let mut map = read_web_vault(&path);
    let removed = map.remove(&key).is_some();
    if removed {
        write_web_vault(&path, &map)?;
    }
    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dpapi_encrypt_decrypt_roundtrip() {
        let secret = "AIzaSy_Test_Secret_Key_9876543210_ Việt_Nam";
        let enc = dpapi_encrypt(secret).expect("DPAPI encrypt should succeed on Windows");
        assert!(enc.starts_with("dpapi:"));
        assert!(!enc.contains("AIzaSy"));
        let dec = dpapi_decrypt(&enc).expect("DPAPI decrypt should restore exact UTF-8");
        assert_eq!(dec, secret);
    }

    #[test]
    fn test_adaptive_ewma_and_cooldown_rotation() {
        let state = RouterState {
            inner: Mutex::new(RouterInner {
                strategy: "priority".to_string(),
                rr_index: 0,
                vault_dir: std::env::temp_dir(),
                endpoints: vec![
                    ProviderEndpoint {
                        endpoint_id: "gemini#1:gemini-3.5-flash".to_string(),
                        provider: "gemini".to_string(),
                        model: "gemini-3.5-flash".to_string(),
                        api_key: "key_one_1234567890".to_string(),
                        account_id: String::new(),
                        priority: 10,
                        status: "healthy".to_string(),
                        cooldown_until: 0,
                        requests: 0,
                        successes: 0,
                        errors: 0,
                        last_error: String::new(),
                        last_latency_ms: 0,
                        ewma_latency_ms: 0.0,
                    },
                    ProviderEndpoint {
                        endpoint_id: "groq#1:llama-3.3-70b-versatile".to_string(),
                        provider: "groq".to_string(),
                        model: "llama-3.3-70b-versatile".to_string(),
                        api_key: "gsk_two_1234567890".to_string(),
                        account_id: String::new(),
                        priority: 18,
                        status: "healthy".to_string(),
                        cooldown_until: 0,
                        requests: 0,
                        successes: 0,
                        errors: 0,
                        last_error: String::new(),
                        last_latency_ms: 0,
                        ewma_latency_ms: 0.0,
                    },
                ],
            }),
        };

        let initial = state.select_candidates(None, None);
        assert_eq!(initial[0].endpoint_id, "gemini#1:gemini-3.5-flash");

        // Trigger 429 rate limit on gemini#1 -> should rotate to groq#1!
        state.record_failure("gemini#1:gemini-3.5-flash", "HTTP 429: RESOURCE_EXHAUSTED");
        let after_429 = state.select_candidates(None, None);
        assert_eq!(after_429.len(), 1);
        assert_eq!(after_429[0].endpoint_id, "groq#1:llama-3.3-70b-versatile");

        // Record fast latency on groq#1
        state.record_success("groq#1:llama-3.3-70b-versatile", 420);
        let guard = state.inner.lock().unwrap();
        let groq_ep = guard.endpoints.iter().find(|e| e.provider == "groq").unwrap();
        assert_eq!(groq_ep.successes, 1);
        assert!((groq_ep.ewma_latency_ms - 420.0).abs() < 0.01);
    }
}
