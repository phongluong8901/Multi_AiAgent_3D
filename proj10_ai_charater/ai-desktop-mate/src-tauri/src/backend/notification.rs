use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::ffi::{CStr, CString};
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::os::raw::{c_char, c_int, c_void};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};

const SQLITE_OK: c_int = 0;
const SQLITE_ROW: c_int = 100;
const SQLITE_TRANSIENT: isize = -1;

#[cfg(windows)]
#[link(name = "kernel32")]
unsafe extern "system" {
    fn LoadLibraryA(lp_lib_file_name: *const c_char) -> *mut c_void;
    fn GetProcAddress(h_module: *mut c_void, lp_proc_name: *const c_char) -> *mut c_void;
}

type FnOpen = unsafe extern "C" fn(*const c_char, *mut *mut c_void) -> c_int;
type FnClose = unsafe extern "C" fn(*mut c_void) -> c_int;
type FnExec = unsafe extern "C" fn(
    *mut c_void,
    *const c_char,
    *const c_void,
    *mut c_void,
    *mut *mut c_char,
) -> c_int;
type FnPrepareV2 = unsafe extern "C" fn(
    *mut c_void,
    *const c_char,
    c_int,
    *mut *mut c_void,
    *mut *const c_char,
) -> c_int;
type FnStep = unsafe extern "C" fn(*mut c_void) -> c_int;
type FnFinalize = unsafe extern "C" fn(*mut c_void) -> c_int;
type FnBindText =
    unsafe extern "C" fn(*mut c_void, c_int, *const c_char, c_int, isize) -> c_int;
type FnBindInt64 = unsafe extern "C" fn(*mut c_void, c_int, i64) -> c_int;
type FnColumnText = unsafe extern "C" fn(*mut c_void, c_int) -> *const c_char;
type FnColumnInt64 = unsafe extern "C" fn(*mut c_void, c_int) -> i64;

struct SqliteApi {
    open: FnOpen,
    #[allow(dead_code)]
    close: FnClose,
    exec: FnExec,
    prepare_v2: FnPrepareV2,
    step: FnStep,
    finalize: FnFinalize,
    bind_text: FnBindText,
    bind_int64: FnBindInt64,
    column_text: FnColumnText,
    column_int64: FnColumnInt64,
}

unsafe impl Send for SqliteApi {}
unsafe impl Sync for SqliteApi {}

pub struct NotificationDb {
    api: SqliteApi,
    db: *mut c_void,
}

unsafe impl Send for NotificationDb {}

#[cfg(windows)]
unsafe fn load_proc(module: *mut c_void, name: &[u8]) -> Result<*mut c_void, String> {
    let ptr = unsafe { GetProcAddress(module, name.as_ptr() as *const c_char) };
    if ptr.is_null() {
        Err(format!(
            "Không tìm thấy hàm SQLite: {}",
            String::from_utf8_lossy(name)
        ))
    } else {
        Ok(ptr)
    }
}

#[cfg(windows)]
fn load_winsqlite3() -> Result<SqliteApi, String> {
    unsafe {
        let lib_name = CString::new("winsqlite3.dll").unwrap();
        let module = LoadLibraryA(lib_name.as_ptr());
        if module.is_null() {
            return Err("Không thể nạp winsqlite3.dll".to_string());
        }

        Ok(SqliteApi {
            open: std::mem::transmute(load_proc(module, b"sqlite3_open\0")?),
            close: std::mem::transmute(load_proc(module, b"sqlite3_close\0")?),
            exec: std::mem::transmute(load_proc(module, b"sqlite3_exec\0")?),
            prepare_v2: std::mem::transmute(load_proc(module, b"sqlite3_prepare_v2\0")?),
            step: std::mem::transmute(load_proc(module, b"sqlite3_step\0")?),
            finalize: std::mem::transmute(load_proc(module, b"sqlite3_finalize\0")?),
            bind_text: std::mem::transmute(load_proc(module, b"sqlite3_bind_text\0")?),
            bind_int64: std::mem::transmute(load_proc(module, b"sqlite3_bind_int64\0")?),
            column_text: std::mem::transmute(load_proc(module, b"sqlite3_column_text\0")?),
            column_int64: std::mem::transmute(load_proc(module, b"sqlite3_column_int64\0")?),
        })
    }
}

impl NotificationDb {
    fn open(path: &PathBuf) -> Result<Self, String> {
        #[cfg(windows)]
        {
            let api = load_winsqlite3()?;
            let path_str = path.to_string_lossy().to_string();
            let c_path = CString::new(path_str).map_err(|e| e.to_string())?;
            let mut db: *mut c_void = std::ptr::null_mut();
            let rc = unsafe { (api.open)(c_path.as_ptr(), &mut db) };
            if rc != SQLITE_OK || db.is_null() {
                return Err(format!("Không thể mở SQLite DB (mã lỗi {rc})"));
            }
            let instance = Self { api, db };
            instance.init_schema()?;
            Ok(instance)
        }
        #[cfg(not(windows))]
        {
            let _ = path;
            Err("Chỉ hỗ trợ SQLite trên Windows".to_string())
        }
    }

    fn exec_sql(&self, sql: &str) -> Result<(), String> {
        let c_sql = CString::new(sql).map_err(|e| e.to_string())?;
        let rc = unsafe {
            (self.api.exec)(
                self.db,
                c_sql.as_ptr(),
                std::ptr::null(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
            )
        };
        if rc != SQLITE_OK {
            return Err(format!("Lỗi thực thi SQLite (mã {rc})"));
        }
        Ok(())
    }

    fn prepare(&self, sql: &str) -> Result<*mut c_void, String> {
        let c_sql = CString::new(sql).map_err(|e| e.to_string())?;
        let mut stmt: *mut c_void = std::ptr::null_mut();
        let rc = unsafe {
            (self.api.prepare_v2)(self.db, c_sql.as_ptr(), -1, &mut stmt, std::ptr::null_mut())
        };
        if rc != SQLITE_OK || stmt.is_null() {
            return Err(format!("Lỗi prepare SQLite (mã {rc})"));
        }
        Ok(stmt)
    }

    fn bind_str(&self, stmt: *mut c_void, idx: i32, val: &str) {
        if let Ok(c_val) = CString::new(val) {
            unsafe {
                (self.api.bind_text)(stmt, idx, c_val.as_ptr(), -1, SQLITE_TRANSIENT);
            }
        }
    }

    fn col_str(&self, stmt: *mut c_void, col: i32) -> String {
        unsafe {
            let ptr = (self.api.column_text)(stmt, col);
            if ptr.is_null() {
                String::new()
            } else {
                CStr::from_ptr(ptr).to_string_lossy().to_string()
            }
        }
    }

    fn init_schema(&self) -> Result<(), String> {
        self.exec_sql(
            "
            PRAGMA journal_mode=WAL;
            PRAGMA busy_timeout=5000;
            CREATE TABLE IF NOT EXISTS notification_settings_kv (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS notification_app_rules (
                idx INTEGER NOT NULL,
                app_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                speech_alert INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS notification_web_rules (
                idx INTEGER NOT NULL,
                origin TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                speech_alert INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS notification_history (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                app_or_origin TEXT NOT NULL,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                allowed INTEGER NOT NULL DEFAULT 1
            );
            DELETE FROM notification_app_rules
            WHERE LOWER(app_id) IN ('system', 'textinputhost.exe', 'calculatorapp.exe', 'applicationframehost.exe', 'shellexperiencehost.exe');
            DELETE FROM notification_history
            WHERE LOWER(app_or_origin) LIKE '%textinputhost%'
               OR LOWER(app_or_origin) LIKE '%calculator%'
               OR LOWER(app_or_origin) = 'system'
               OR LOWER(title) LIKE '%windows input experience%';
            ",
        )?;
        Ok(())
    }

    fn has_saved_settings(&self) -> bool {
        let mut count = 0i64;
        if let Ok(stmt) = self.prepare("SELECT COUNT(*) FROM notification_settings_kv") {
            unsafe {
                if (self.api.step)(stmt) == SQLITE_ROW {
                    count = (self.api.column_int64)(stmt, 0);
                }
                (self.api.finalize)(stmt);
            }
        }
        count > 0
    }

    fn save_settings(&self, settings: &NotificationSettings) -> Result<(), String> {
        let now = now_unix_secs() as i64;
        self.exec_sql("BEGIN IMMEDIATE TRANSACTION;")?;

        let res = (|| -> Result<(), String> {
            let kv_pairs = [
                ("master_enabled", if settings.master_enabled { "1" } else { "0" }.to_string()),
                ("speech_tts_enabled", if settings.speech_tts_enabled { "1" } else { "0" }.to_string()),
                ("character_alert_enabled", if settings.character_alert_enabled { "1" } else { "0" }.to_string()),
                ("webhook_port", settings.webhook_port.to_string()),
            ];

            for (k, v) in kv_pairs {
                let stmt = self.prepare(
                    "INSERT INTO notification_settings_kv (key, value, updated_at) VALUES (?1, ?2, ?3)
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                )?;
                self.bind_str(stmt, 1, k);
                self.bind_str(stmt, 2, &v);
                unsafe {
                    (self.api.bind_int64)(stmt, 3, now);
                    (self.api.step)(stmt);
                    (self.api.finalize)(stmt);
                }
            }

            self.exec_sql("DELETE FROM notification_app_rules;")?;
            for (idx, rule) in settings.windows_apps.iter().enumerate() {
                let stmt = self.prepare(
                    "INSERT OR REPLACE INTO notification_app_rules (idx, app_id, name, enabled, speech_alert)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                )?;
                unsafe {
                    (self.api.bind_int64)(stmt, 1, idx as i64);
                }
                self.bind_str(stmt, 2, &rule.app_id);
                self.bind_str(stmt, 3, &rule.name);
                unsafe {
                    (self.api.bind_int64)(stmt, 4, if rule.enabled { 1 } else { 0 });
                    (self.api.bind_int64)(stmt, 5, if rule.speech_alert { 1 } else { 0 });
                    (self.api.step)(stmt);
                    (self.api.finalize)(stmt);
                }
            }

            self.exec_sql("DELETE FROM notification_web_rules;")?;
            for (idx, rule) in settings.web_origins.iter().enumerate() {
                let stmt = self.prepare(
                    "INSERT OR REPLACE INTO notification_web_rules (idx, origin, name, enabled, speech_alert)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                )?;
                unsafe {
                    (self.api.bind_int64)(stmt, 1, idx as i64);
                }
                self.bind_str(stmt, 2, &rule.origin);
                self.bind_str(stmt, 3, &rule.name);
                unsafe {
                    (self.api.bind_int64)(stmt, 4, if rule.enabled { 1 } else { 0 });
                    (self.api.bind_int64)(stmt, 5, if rule.speech_alert { 1 } else { 0 });
                    (self.api.step)(stmt);
                    (self.api.finalize)(stmt);
                }
            }
            Ok(())
        })();

        if res.is_ok() {
            self.exec_sql("COMMIT;")?;
        } else {
            let _ = self.exec_sql("ROLLBACK;");
        }
        res
    }

    fn load_settings(&self) -> Result<Option<NotificationSettings>, String> {
        if !self.has_saved_settings() {
            return Ok(None);
        }

        let mut settings = NotificationSettings::default();
        if let Ok(stmt) = self.prepare("SELECT key, value FROM notification_settings_kv") {
            unsafe {
                while (self.api.step)(stmt) == SQLITE_ROW {
                    let k = self.col_str(stmt, 0);
                    let v = self.col_str(stmt, 1);
                    match k.as_str() {
                        "master_enabled" => settings.master_enabled = v == "1" || v == "true",
                        "speech_tts_enabled" => settings.speech_tts_enabled = v == "1" || v == "true",
                        "character_alert_enabled" => settings.character_alert_enabled = v == "1" || v == "true",
                        "webhook_port" => {
                            if let Ok(port) = v.parse::<u16>() {
                                settings.webhook_port = port;
                            }
                        }
                        _ => {}
                    }
                }
                (self.api.finalize)(stmt);
            }
        }

        let mut app_rules = Vec::new();
        if let Ok(stmt) = self.prepare(
            "SELECT app_id, name, enabled, speech_alert FROM notification_app_rules ORDER BY idx ASC",
        ) {
            unsafe {
                while (self.api.step)(stmt) == SQLITE_ROW {
                    let app_id = self.col_str(stmt, 0);
                    let name = self.col_str(stmt, 1);
                    let enabled = (self.api.column_int64)(stmt, 2) != 0;
                    let speech_alert = (self.api.column_int64)(stmt, 3) != 0;
                    if !is_system_ignored_process(&app_id, &name) {
                        app_rules.push(AppNotificationRule {
                            app_id,
                            name,
                            enabled,
                            speech_alert,
                        });
                    }
                }
                (self.api.finalize)(stmt);
            }
        }
        if !app_rules.is_empty() {
            settings.windows_apps = app_rules;
        }

        let mut web_rules = Vec::new();
        if let Ok(stmt) = self.prepare(
            "SELECT origin, name, enabled, speech_alert FROM notification_web_rules ORDER BY idx ASC",
        ) {
            unsafe {
                while (self.api.step)(stmt) == SQLITE_ROW {
                    let origin = self.col_str(stmt, 0);
                    let name = self.col_str(stmt, 1);
                    let enabled = (self.api.column_int64)(stmt, 2) != 0;
                    let speech_alert = (self.api.column_int64)(stmt, 3) != 0;
                    web_rules.push(WebNotificationRule {
                        origin,
                        name,
                        enabled,
                        speech_alert,
                    });
                }
                (self.api.finalize)(stmt);
            }
        }
        if !web_rules.is_empty() {
            settings.web_origins = web_rules;
        }

        Ok(Some(settings))
    }

    fn insert_history(&self, item: &NotificationItem) -> Result<(), String> {
        let stmt = self.prepare(
            "INSERT OR REPLACE INTO notification_history (id, source, app_or_origin, title, body, timestamp, allowed)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        )?;
        self.bind_str(stmt, 1, &item.id);
        self.bind_str(stmt, 2, &item.source);
        self.bind_str(stmt, 3, &item.app_or_origin);
        self.bind_str(stmt, 4, &item.title);
        self.bind_str(stmt, 5, &item.body);
        unsafe {
            (self.api.bind_int64)(stmt, 6, item.timestamp as i64);
            (self.api.bind_int64)(stmt, 7, if item.allowed { 1 } else { 0 });
            (self.api.step)(stmt);
            (self.api.finalize)(stmt);
        }
        let _ = self.exec_sql(
            "DELETE FROM notification_history
             WHERE id NOT IN (SELECT id FROM notification_history ORDER BY timestamp DESC LIMIT 150);",
        );
        Ok(())
    }

    fn load_history(&self) -> VecDeque<NotificationItem> {
        let mut items = VecDeque::new();
        if let Ok(stmt) = self.prepare(
            "SELECT id, source, app_or_origin, title, body, timestamp, allowed
             FROM notification_history
             ORDER BY timestamp DESC
             LIMIT 150",
        ) {
            unsafe {
                while (self.api.step)(stmt) == SQLITE_ROW {
                    let id = self.col_str(stmt, 0);
                    let source = self.col_str(stmt, 1);
                    let app_or_origin = self.col_str(stmt, 2);
                    let title = self.col_str(stmt, 3);
                    let body = self.col_str(stmt, 4);
                    let timestamp = (self.api.column_int64)(stmt, 5).max(0) as u64;
                    let allowed = (self.api.column_int64)(stmt, 6) != 0;
                    if (source == "windows" || source == "app")
                        && is_system_ignored_process(&app_or_origin, &title)
                    {
                        continue;
                    }
                    items.push_back(NotificationItem {
                        id,
                        source,
                        app_or_origin,
                        title,
                        body,
                        timestamp,
                        allowed,
                    });
                }
                (self.api.finalize)(stmt);
            }
        }
        items
    }

    fn clear_history(&self) -> Result<(), String> {
        self.exec_sql("DELETE FROM notification_history;")
    }
}

fn now_unix_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationItem {
    pub id: String,
    pub source: String,        // "windows" | "web"
    pub app_or_origin: String, // "Zalo", "Google Chrome", "github.com", etc.
    pub title: String,
    pub body: String,
    pub timestamp: u64,
    pub allowed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppNotificationRule {
    pub app_id: String,
    pub name: String,
    pub enabled: bool,
    pub speech_alert: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebNotificationRule {
    pub origin: String,
    pub name: String,
    pub enabled: bool,
    pub speech_alert: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationSettings {
    pub master_enabled: bool,
    pub speech_tts_enabled: bool,
    pub character_alert_enabled: bool,
    pub windows_apps: Vec<AppNotificationRule>,
    pub web_origins: Vec<WebNotificationRule>,
    pub webhook_port: u16,
}

impl Default for NotificationSettings {
    fn default() -> Self {
        Self {
            master_enabled: true,
            speech_tts_enabled: true,
            character_alert_enabled: true,
            windows_apps: vec![
                AppNotificationRule {
                    app_id: "Zalo.exe".to_string(),
                    name: "Zalo".to_string(),
                    enabled: true,
                    speech_alert: true,
                },
                AppNotificationRule {
                    app_id: "chrome.exe".to_string(),
                    name: "Google Chrome".to_string(),
                    enabled: true,
                    speech_alert: false,
                },
                AppNotificationRule {
                    app_id: "Code.exe".to_string(),
                    name: "Visual Studio Code".to_string(),
                    enabled: true,
                    speech_alert: false,
                },
                AppNotificationRule {
                    app_id: "antigravity.exe".to_string(),
                    name: "Antigravity".to_string(),
                    enabled: true,
                    speech_alert: true,
                },
                AppNotificationRule {
                    app_id: "cursor.exe".to_string(),
                    name: "Cursor IDE".to_string(),
                    enabled: true,
                    speech_alert: true,
                },
                AppNotificationRule {
                    app_id: "Telegram.exe".to_string(),
                    name: "Telegram".to_string(),
                    enabled: true,
                    speech_alert: true,
                },
                AppNotificationRule {
                    app_id: "Discord.exe".to_string(),
                    name: "Discord".to_string(),
                    enabled: true,
                    speech_alert: true,
                },
                AppNotificationRule {
                    app_id: "slack.exe".to_string(),
                    name: "Slack".to_string(),
                    enabled: true,
                    speech_alert: true,
                },
                AppNotificationRule {
                    app_id: "OUTLOOK.EXE".to_string(),
                    name: "Microsoft Outlook".to_string(),
                    enabled: true,
                    speech_alert: true,
                },
                AppNotificationRule {
                    app_id: "Teams.exe".to_string(),
                    name: "Microsoft Teams".to_string(),
                    enabled: true,
                    speech_alert: false,
                },
                AppNotificationRule {
                    app_id: "msedge.exe".to_string(),
                    name: "Microsoft Edge".to_string(),
                    enabled: true,
                    speech_alert: false,
                },
                AppNotificationRule {
                    app_id: "Spotify.exe".to_string(),
                    name: "Spotify".to_string(),
                    enabled: false,
                    speech_alert: false,
                },
            ],
            web_origins: vec![
                WebNotificationRule {
                    origin: "github.com".to_string(),
                    name: "GitHub".to_string(),
                    enabled: true,
                    speech_alert: true,
                },
                WebNotificationRule {
                    origin: "mail.google.com".to_string(),
                    name: "Gmail".to_string(),
                    enabled: true,
                    speech_alert: true,
                },
                WebNotificationRule {
                    origin: "calendar.google.com".to_string(),
                    name: "Google Calendar".to_string(),
                    enabled: true,
                    speech_alert: true,
                },
                WebNotificationRule {
                    origin: "youtube.com".to_string(),
                    name: "YouTube".to_string(),
                    enabled: false,
                    speech_alert: false,
                },
                WebNotificationRule {
                    origin: "jira.atlassian.com".to_string(),
                    name: "Jira / Confluence".to_string(),
                    enabled: true,
                    speech_alert: false,
                },
                WebNotificationRule {
                    origin: "localhost".to_string(),
                    name: "Local Services".to_string(),
                    enabled: true,
                    speech_alert: true,
                },
                WebNotificationRule {
                    origin: "custom-webhook".to_string(),
                    name: "Custom Webhook".to_string(),
                    enabled: true,
                    speech_alert: true,
                },
            ],
            webhook_port: 39281,
        }
    }
}

/// Chặn tuyệt đối các tiến trình nền / tiện ích UWP hệ thống Windows để tránh spam rác Notification
fn is_system_ignored_process(proc_name: &str, title: &str) -> bool {
    let p = proc_name.trim().to_lowercase();
    let t = title.trim().to_lowercase();

    const IGNORED_PROCS: &[&str] = &[
        "textinputhost.exe",
        "calculatorapp.exe",
        "applicationframehost.exe",
        "shellexperiencehost.exe",
        "searchhost.exe",
        "startmenuexperiencehost.exe",
        "systemsettings.exe",
        "explorer.exe",
        "lockapp.exe",
        "dwm.exe",
        "taskmgr.exe",
        "sihost.exe",
        "ctfmon.exe",
        "conhost.exe",
        "svchost.exe",
        "widgets.exe",
        "ai-desktop-mate.exe",
        "system",
    ];

    if p.is_empty() || IGNORED_PROCS.iter().any(|&ig| p == ig || p.starts_with("ai-desktop-mate")) {
        return true;
    }

    const IGNORED_TITLES: &[&str] = &[
        "windows input experience",
        "calculator",
        "program manager",
        "settings",
        "default ime",
        "msctfime ui",
        "ai desktop mate",
        "windows system",
    ];

    IGNORED_TITLES.iter().any(|&ig| t == ig)
}

pub struct NotificationState {
    pub settings: Mutex<NotificationSettings>,
    pub history: Mutex<VecDeque<NotificationItem>>,
    pub db: Mutex<Option<NotificationDb>>,
    pub db_path: String,
    pub app_handle: AppHandle,
}

impl NotificationState {
    pub fn new(app_handle: AppHandle, data_dir: Option<PathBuf>) -> Arc<Self> {
        let project_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .map(|p| p.to_path_buf());

        let dir = match project_root {
            Some(ref root) if root.exists() => root.join("data"),
            _ => data_dir.clone().unwrap_or_else(|| PathBuf::from(".")),
        };
        let _ = fs::create_dir_all(&dir);
        let db_path = dir.join("mate_memory.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        let db_handle = NotificationDb::open(&db_path).ok();

        let mut initial_settings = NotificationSettings::default();
        let mut initial_history = VecDeque::new();

        if let Some(ref db) = db_handle {
            match db.load_settings() {
                Ok(Some(loaded)) => initial_settings = loaded,
                _ => {
                    let _ = db.save_settings(&initial_settings);
                }
            }
            initial_history = db.load_history();
        }

        println!("[INFO] Notification SQLite storage ready: {}", db_path_str);

        let state = Arc::new(Self {
            settings: Mutex::new(initial_settings),
            history: Mutex::new(initial_history),
            db: Mutex::new(db_handle),
            db_path: db_path_str,
            app_handle: app_handle.clone(),
        });

        // Khởi chạy Webhook HTTP Listener ở chế độ daemon nền
        let server_state = Arc::clone(&state);
        thread::spawn(move || {
            start_webhook_server(server_state);
        });

        // Khởi chạy Real App Notification Monitor ở chế độ daemon nền
        let monitor_state = Arc::clone(&state);
        thread::spawn(move || {
            start_real_windows_notification_monitor(monitor_state);
        });

        state
    }

    pub fn save_settings_to_db(&self) {
        if let Ok(settings) = self.settings.lock() {
            if let Ok(db_guard) = self.db.lock() {
                if let Some(ref db) = *db_guard {
                    if let Err(err) = db.save_settings(&settings) {
                        eprintln!("[ERROR] Lỗi lưu notification settings vào SQLite: {}", err);
                    }
                }
            }
        }
    }

    pub fn dispatch_notification(
        &self,
        source: &str,
        app_or_origin: &str,
        title: &str,
        body: &str,
    ) -> NotificationItem {
        let now = now_unix_secs();
        let id = format!("notif_{}_{}", now, fastrand_seed());

        if (source == "windows" || source == "app") && is_system_ignored_process(app_or_origin, title) {
            return NotificationItem {
                id,
                source: source.to_string(),
                app_or_origin: app_or_origin.to_string(),
                title: title.to_string(),
                body: body.to_string(),
                timestamp: now,
                allowed: false,
            };
        }

        let (allowed, speech_alert, display_app, should_record) = {
            let settings = self.settings.lock().unwrap();
            if source == "windows" || source == "app" {
                let app_clean = app_or_origin.trim().to_lowercase();
                let app_no_ext = app_clean.trim_end_matches(".exe");
                if let Some(rule) = settings.windows_apps.iter().find(|r| {
                    let r_id = r.app_id.trim().to_lowercase();
                    let r_name = r.name.trim().to_lowercase();
                    !app_clean.is_empty()
                        && (r_id == app_clean
                            || r_name == app_clean
                            || r_id.trim_end_matches(".exe") == app_no_ext
                            || r_name.trim_end_matches(".exe") == app_no_ext)
                }) {
                    let is_allowed = settings.master_enabled && rule.enabled;
                    (
                        is_allowed,
                        is_allowed && rule.speech_alert && settings.speech_tts_enabled,
                        rule.name.clone(),
                        true,
                    )
                } else {
                    // Không nằm trong danh sách ứng dụng cấu hình -> bỏ qua, không ghi rác vào lịch sử
                    (false, false, app_or_origin.to_string(), false)
                }
            } else {
                // Nguồn "web"
                if let Some(rule) = settings.web_origins.iter().find(|r| {
                    r.origin.eq_ignore_ascii_case(app_or_origin)
                        || r.name.eq_ignore_ascii_case(app_or_origin)
                }) {
                    let is_allowed = settings.master_enabled && rule.enabled;
                    (
                        is_allowed,
                        is_allowed && rule.speech_alert && settings.speech_tts_enabled,
                        rule.name.clone(),
                        true,
                    )
                } else {
                    let is_allowed = settings.master_enabled;
                    (
                        is_allowed,
                        is_allowed && settings.speech_tts_enabled,
                        app_or_origin.to_string(),
                        true,
                    )
                }
            }
        };

        let item = NotificationItem {
            id,
            source: source.to_string(),
            app_or_origin: display_app,
            title: title.to_string(),
            body: body.to_string(),
            timestamp: now,
            allowed,
        };

        if !should_record {
            return item;
        }

        // Lưu vào bộ nhớ đệm & SQLite (giữ tối đa 150 mục)
        if let Ok(mut hist) = self.history.lock() {
            hist.push_front(item.clone());
            while hist.len() > 150 {
                hist.pop_back();
            }
        }
        if let Ok(db_guard) = self.db.lock() {
            if let Some(ref db) = *db_guard {
                if let Err(err) = db.insert_history(&item) {
                    eprintln!("[ERROR] Lỗi ghi notification history vào SQLite: {}", err);
                }
            }
        }

        // Nếu thông báo được cấp phép hiển thị -> phát event tới frontend
        if allowed {
            #[derive(Serialize, Clone)]
            struct NotificationPayload {
                item: NotificationItem,
                speech_alert: bool,
            }

            let payload = NotificationPayload {
                item: item.clone(),
                speech_alert,
            };

            let _ = self.app_handle.emit("desktop-mate://notification", payload);
        }

        item
    }
}

fn fastrand_seed() -> u32 {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(12345);
    nanos % 100000
}

fn start_webhook_server(state: Arc<NotificationState>) {
    let port = {
        state
            .settings
            .lock()
            .map(|s| s.webhook_port)
            .unwrap_or(39281)
    };

    let bind_addr = format!("127.0.0.1:{}", port);
    let listener = match TcpListener::bind(&bind_addr) {
        Ok(l) => l,
        Err(e) => {
            eprintln!("[ERROR] Không thể khởi tạo Webhook server trên {}: {}", bind_addr, e);
            return;
        }
    };

    println!("[INFO] Webhook Notification Server đang chạy tại http://{}", bind_addr);

    for stream in listener.incoming() {
        if let Ok(stream) = stream {
            let state_clone = Arc::clone(&state);
            thread::spawn(move || {
                handle_http_client(stream, state_clone);
            });
        }
    }
}

fn handle_http_client(mut stream: TcpStream, state: Arc<NotificationState>) {
    let mut buffer = [0u8; 4096];
    let bytes_read = match stream.read(&mut buffer) {
        Ok(b) if b > 0 => b,
        _ => return,
    };

    let req_str = String::from_utf8_lossy(&buffer[..bytes_read]);

    if req_str.starts_with("OPTIONS ") {
        let response = "HTTP/1.1 204 No Content\r\n\
Access-Control-Allow-Origin: *\r\n\
Access-Control-Allow-Methods: POST, OPTIONS, GET\r\n\
Access-Control-Allow-Headers: Content-Type, Authorization\r\n\
Connection: close\r\n\r\n";
        let _ = stream.write_all(response.as_bytes());
        return;
    }

    if req_str.starts_with("GET /") {
        let body = r#"{"status":"online","service":"AI Desktop Mate Notification Webhook"}"#;
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            body.len(),
            body
        );
        let _ = stream.write_all(response.as_bytes());
        return;
    }

    if req_str.starts_with("POST ") {
        if let Some(pos) = req_str.find("\r\n\r\n") {
            let body_part = &req_str[pos + 4..];

            #[derive(Deserialize)]
            struct IncomingNotif {
                source: Option<String>,
                app_or_origin: Option<String>,
                title: Option<String>,
                body: Option<String>,
            }

            if let Ok(parsed) = serde_json::from_str::<IncomingNotif>(body_part) {
                let source = parsed.source.unwrap_or_else(|| "web".to_string());
                let origin = parsed.app_or_origin.unwrap_or_else(|| "custom-webhook".to_string());
                let title = parsed.title.unwrap_or_else(|| "Thông báo Web".to_string());
                let body = parsed.body.unwrap_or_default();

                let item = state.dispatch_notification(&source, &origin, &title, &body);

                let resp_body = serde_json::json!({
                    "status": "success",
                    "notification": item,
                })
                .to_string();

                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    resp_body.len(),
                    resp_body
                );
                let _ = stream.write_all(response.as_bytes());
                return;
            }
        }
    }

    let err_resp = "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{\"error\":\"Invalid notification payload\"}";
    let _ = stream.write_all(err_resp.as_bytes());
}

// ----------------- Tauri Commands -----------------

#[tauri::command]
pub fn get_notification_settings(state: State<'_, Arc<NotificationState>>) -> NotificationSettings {
    state.settings.lock().map(|s| s.clone()).unwrap_or_default()
}

#[tauri::command]
pub fn save_notification_settings(
    mut settings: NotificationSettings,
    state: State<'_, Arc<NotificationState>>,
) -> Result<String, String> {
    settings
        .windows_apps
        .retain(|r| !is_system_ignored_process(&r.app_id, &r.name));

    if let Ok(mut current) = state.settings.lock() {
        *current = settings;
    }
    state.save_settings_to_db();
    Ok("[SUCCESS] Đã lưu cấu hình Notification vào SQLite!".to_string())
}

#[tauri::command]
pub fn get_notification_history(state: State<'_, Arc<NotificationState>>) -> Vec<NotificationItem> {
    state
        .history
        .lock()
        .map(|h| h.iter().cloned().collect())
        .unwrap_or_default()
}

#[tauri::command]
pub fn clear_notification_history(state: State<'_, Arc<NotificationState>>) -> Result<String, String> {
    if let Ok(mut h) = state.history.lock() {
        h.clear();
    }
    if let Ok(db_guard) = state.db.lock() {
        if let Some(ref db) = *db_guard {
            let _ = db.clear_history();
        }
    }
    Ok("[SUCCESS] Đã xóa toàn bộ lịch sử thông báo khỏi SQLite!".to_string())
}

#[tauri::command]
pub fn post_notification(
    source: String,
    app_or_origin: String,
    title: String,
    body: String,
    state: State<'_, Arc<NotificationState>>,
) -> NotificationItem {
    state.dispatch_notification(&source, &app_or_origin, &title, &body)
}

#[tauri::command]
pub fn test_notification(
    source: String,
    app_or_origin: String,
    state: State<'_, Arc<NotificationState>>,
) -> NotificationItem {
    let key = app_or_origin.trim().to_lowercase();
    let (title, body) = if source == "windows" || source == "app" {
        match key.as_str() {
            "zalo" | "zalo.exe" => (
                "Tin nhắn mới từ Zalo",
                "Có tin nhắn chưa đọc từ nhóm dự án Desktop Mate!",
            ),
            "google chrome" | "chrome.exe" => (
                "Google Chrome Thông báo",
                "Tab đang mở vừa phát sinh thông báo mới.",
            ),
            "visual studio code" | "code.exe" => (
                "VS Code Build Alert",
                "Task biên dịch workspace vừa hoàn tất không có lỗi.",
            ),
            "antigravity" | "antigravity.exe" => (
                "Antigravity Agent",
                "Tác vụ AI trong phiên làm việc vừa hoàn thành.",
            ),
            "cursor ide" | "cursor.exe" => (
                "Cursor IDE",
                "Code review & refactor đã sẵn sàng kiểm tra.",
            ),
            "telegram" | "telegram.exe" => (
                "Tin nhắn mới từ Alex",
                "Đã nhận file báo cáo quý, MicroDuck kiểm tra giúp nhé!",
            ),
            "discord" | "discord.exe" => (
                "#general - AI Gaming Clan",
                "@everyone Server raid lúc 20:00 tối nay nhé!",
            ),
            "slack" | "slack.exe" => (
                "#standup - Tech Team",
                "PR #128 vừa được merge vào production thành công.",
            ),
            "microsoft outlook" | "outlook" | "outlook.exe" => (
                "Thư mới từ Giám đốc Kỹ thuật",
                "Kế hoạch triển khai MicroDuck Desktop Agent v2.5",
            ),
            _ => (
                "Thông báo Ứng dụng",
                "Ứng dụng bạn đang theo dõi vừa gửi một thông báo kiểm tra.",
            ),
        }
    } else {
        match key.as_str() {
            "github.com" => (
                "GitHub Alert",
                "Release v1.2.0 của learn_mlflow đã sẵn sàng tải về.",
            ),
            "mail.google.com" => (
                "Gmail Thông Báo",
                "Bạn có 3 email quan trọng chưa đọc trong hộp thư đến.",
            ),
            "calendar.google.com" => (
                "Google Lịch",
                "Sắp diễn ra: Cuộc họp thảo luận AI MicroDuck sau 15 phút.",
            ),
            _ => (
                "Web Notification",
                "Website vừa gửi thông báo sự kiện thời gian thực.",
            ),
        }
    };

    state.dispatch_notification(&source, &app_or_origin, title, body)
}

#[tauri::command]
pub fn scan_active_windows_apps() -> Vec<String> {
    let mut found_set = std::collections::HashSet::new();

    #[cfg(windows)]
    {
        use windows::Win32::Foundation::{BOOL, HWND, LPARAM};
        use windows::Win32::UI::WindowsAndMessaging::EnumWindows;

        unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
            unsafe {
                let set = &mut *(lparam.0 as *mut std::collections::HashSet<String>);
                let proc_name = crate::core::windows::get_process_name_by_hwnd(hwnd).to_lowercase();
                if proc_name.contains("zalo") {
                    set.insert("Zalo".to_string());
                } else if proc_name.contains("chrome") {
                    set.insert("Google Chrome".to_string());
                } else if proc_name == "code.exe" {
                    set.insert("Visual Studio Code".to_string());
                } else if proc_name.contains("antigravity") {
                    set.insert("Antigravity".to_string());
                } else if proc_name.contains("cursor") {
                    set.insert("Cursor IDE".to_string());
                } else if proc_name.contains("telegram") {
                    set.insert("Telegram".to_string());
                } else if proc_name.contains("discord") {
                    set.insert("Discord".to_string());
                } else if proc_name.contains("slack") {
                    set.insert("Slack".to_string());
                } else if proc_name.contains("outlook") {
                    set.insert("Microsoft Outlook".to_string());
                } else if proc_name.contains("teams") {
                    set.insert("Microsoft Teams".to_string());
                } else if proc_name.contains("msedge") {
                    set.insert("Microsoft Edge".to_string());
                } else if proc_name.contains("spotify") {
                    set.insert("Spotify".to_string());
                }
                BOOL(1)
            }
        }

        unsafe {
            let _ = EnumWindows(Some(enum_proc), LPARAM(&mut found_set as *mut _ as isize));
        }
    }

    // Kết hợp quét qua tasklist để phát hiện cả app đang thu nhỏ xuống khay hệ thống (System Tray như Zalo)
    if let Ok(res) = std::process::Command::new("tasklist")
        .args(["/FO", "CSV", "/NH"])
        .output()
    {
        let text = String::from_utf8_lossy(&res.stdout).to_lowercase();
        let candidates = [
            ("Zalo.exe", "Zalo"),
            ("chrome.exe", "Google Chrome"),
            ("Code.exe", "Visual Studio Code"),
            ("antigravity.exe", "Antigravity"),
            ("cursor.exe", "Cursor IDE"),
            ("Telegram.exe", "Telegram"),
            ("Discord.exe", "Discord"),
            ("slack.exe", "Slack"),
            ("OUTLOOK.EXE", "Microsoft Outlook"),
            ("Teams.exe", "Microsoft Teams"),
            ("msedge.exe", "Microsoft Edge"),
            ("Spotify.exe", "Spotify"),
        ];

        for (proc_name, display_name) in candidates {
            if text.contains(&proc_name.to_lowercase()) {
                found_set.insert(display_name.to_string());
            }
        }
    }

    let mut list: Vec<String> = found_set.into_iter().collect();
    list.sort();
    list
}

/// Phân tích title cửa sổ để phát hiện dấu hiệu tin nhắn mới / notification unread
fn parse_notification_indicator(title: &str) -> Option<(String, String)> {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return None;
    }

    let mut count_str = String::new();
    let mut body_str = String::new();

    if let Some(rest) = trimmed.strip_prefix('(') {
        if let Some(close_idx) = rest.find(')') {
            let num_candidate = &rest[..close_idx];
            if num_candidate.chars().all(|c| c.is_ascii_digit()) && !num_candidate.is_empty() {
                count_str = format!("{} tin nhắn/thông báo mới", num_candidate);
                body_str = rest[close_idx + 1..].trim().to_string();
            }
        }
    } else if let Some(rest) = trimmed.strip_prefix('[') {
        if let Some(close_idx) = rest.find(']') {
            let tag_candidate = &rest[..close_idx];
            count_str = format!("[{}]", tag_candidate);
            body_str = rest[close_idx + 1..].trim().to_string();
        }
    } else if let Some(open_idx) = trimmed.rfind('(') {
        if let Some(close_idx) = trimmed[open_idx..].find(')') {
            let num_candidate = &trimmed[open_idx + 1..open_idx + close_idx];
            if num_candidate.chars().all(|c| c.is_ascii_digit()) && !num_candidate.is_empty() {
                count_str = format!("{} tin nhắn mới", num_candidate);
                body_str = trimmed[..open_idx].trim().to_string();
            }
        }
    } else if trimmed.starts_with('●') || trimmed.starts_with('*') {
        count_str = "Cập nhật / Cảnh báo mới".to_string();
        body_str = trimmed.trim_start_matches(|c| c == '●' || c == '*' || c == ' ').to_string();
    }

    if !count_str.is_empty() {
        Some((count_str, body_str))
    } else {
        None
    }
}

/// Daemon quét liên tục cửa sổ ứng dụng đã cấu hình bật (bỏ qua hoàn toàn các cửa sổ hệ thống UWP/Windows)
#[cfg(windows)]
fn start_real_windows_notification_monitor(state: Arc<NotificationState>) {
    use std::collections::HashMap;
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetClassNameW, GetForegroundWindow, GetWindowRect, GetWindowTextLengthW,
        GetWindowTextW, IsWindowVisible,
    };

    println!("[INFO] Khởi động Real App Notification Monitor daemon (Filtered Apps Only)");

    let mut prev_titles: HashMap<isize, String> = HashMap::new();
    let mut recent_alerts: HashMap<String, u64> = HashMap::new();
    let mut is_first_scan = true;

    loop {
        thread::sleep(std::time::Duration::from_millis(1500));

        let (master_enabled, enabled_apps): (bool, Vec<AppNotificationRule>) = state
            .settings
            .lock()
            .map(|s| {
                let apps = s
                    .windows_apps
                    .iter()
                    .filter(|a| a.enabled && !is_system_ignored_process(&a.app_id, &a.name))
                    .cloned()
                    .collect();
                (s.master_enabled, apps)
            })
            .unwrap_or((true, Vec::new()));

        if !master_enabled || enabled_apps.is_empty() {
            is_first_scan = true;
            prev_titles.clear();
            continue;
        }

        let now_sec = now_unix_secs();
        recent_alerts.retain(|_, time| now_sec.saturating_sub(*time) < 35);

        struct WindowInfo {
            hwnd: isize,
            title: String,
            process_name: String,
            class_name: String,
            rect: RECT,
        }

        unsafe extern "system" fn enum_win_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
            unsafe {
                let list = &mut *(lparam.0 as *mut Vec<WindowInfo>);

                if !IsWindowVisible(hwnd).as_bool() {
                    return BOOL(1);
                }

                let proc_name = crate::core::windows::get_process_name_by_hwnd(hwnd);
                if proc_name.is_empty() {
                    return BOOL(1);
                }

                let len = GetWindowTextLengthW(hwnd);
                let title = if len > 0 {
                    let mut buf = vec![0u16; (len + 1) as usize];
                    GetWindowTextW(hwnd, &mut buf);
                    String::from_utf16_lossy(&buf[..len as usize])
                } else {
                    String::new()
                };

                let mut class_buf = [0u16; 128];
                let class_len = GetClassNameW(hwnd, &mut class_buf);
                let class_name = if class_len > 0 {
                    String::from_utf16_lossy(&class_buf[..class_len as usize])
                } else {
                    String::new()
                };

                let mut rect = RECT::default();
                let _ = GetWindowRect(hwnd, &mut rect);

                list.push(WindowInfo {
                    hwnd: hwnd.0 as isize,
                    title,
                    process_name: proc_name,
                    class_name,
                    rect,
                });

                BOOL(1)
            }
        }

        let mut current_windows: Vec<WindowInfo> = Vec::new();
        unsafe {
            let _ = EnumWindows(
                Some(enum_win_callback),
                LPARAM(&mut current_windows as *mut _ as isize),
            );
        }

        let mut current_map: HashMap<isize, String> = HashMap::new();
        for win in &current_windows {
            current_map.insert(win.hwnd, win.title.clone());
        }

        // Vòng quét đầu tiên chỉ dùng để đồng bộ snapshot cửa sổ hiện tại, tránh spam thông báo cũ
        if is_first_scan {
            prev_titles = current_map;
            is_first_scan = false;
            continue;
        }

        let fg_hwnd = unsafe { GetForegroundWindow() }.0 as isize;

        for win in &current_windows {
            if is_system_ignored_process(&win.process_name, &win.title) {
                continue;
            }

            let proc_lower = win.process_name.trim().to_lowercase();
            let proc_no_ext = proc_lower.trim_end_matches(".exe");

            // Chỉ bắt thông báo từ các ứng dụng đã nằm trong danh sách cấu hình và đang bật
            let Some(rule) = enabled_apps.iter().find(|r| {
                let r_id = r.app_id.trim().to_lowercase();
                let r_name = r.name.trim().to_lowercase();
                let r_id_no_ext = r_id.trim_end_matches(".exe");
                r_id == proc_lower || r_id_no_ext == proc_no_ext || r_name == proc_no_ext
            }) else {
                continue;
            };

            let is_new_window = !prev_titles.contains_key(&win.hwnd);
            let win_w = win.rect.right - win.rect.left;
            let win_h = win.rect.bottom - win.rect.top;

            // 1. Bắt popup toast mới xuất hiện của chính ứng dụng đó (bỏ qua hoàn toàn Windows.UI.Core.CoreWindow)
            let is_popup_toast = is_new_window
                && (win.class_name == "Chrome_WidgetWin_1"
                    || win.class_name.contains("Toast")
                    || win.class_name.contains("Notification"))
                && win_w >= 120
                && win_w <= 460
                && win_h >= 40
                && win_h <= 220;

            if is_popup_toast {
                let alert_title = if !win.title.is_empty() {
                    format!("{} [Thông báo]", rule.name)
                } else {
                    format!("{} [Thông báo mới]", rule.name)
                };
                let alert_body = if !win.title.is_empty() {
                    win.title.clone()
                } else {
                    format!("Ứng dụng {} vừa hiển thị thông báo trên màn hình.", rule.name)
                };

                let alert_key = format!("toast_{}_{}_{}", proc_no_ext, alert_body, win.hwnd);
                if !recent_alerts.contains_key(&alert_key) {
                    recent_alerts.insert(alert_key, now_sec);
                    state.dispatch_notification("windows", &rule.name, &alert_title, &alert_body);
                }
            }

            // 2. Bắt thay đổi tiêu đề có chỉ báo tin nhắn chưa đọc / cập nhật khi chạy nền
            if !win.title.is_empty() {
                if let Some(prev_title) = prev_titles.get(&win.hwnd) {
                    if prev_title != &win.title {
                        let indicator = parse_notification_indicator(&win.title);
                        let is_zalo_bg_change = proc_no_ext == "zalo" && win.hwnd != fg_hwnd;
                        let allow_bg_indicator = indicator.is_some()
                            && (win.hwnd != fg_hwnd
                                || (!win.title.starts_with('●') && !win.title.starts_with('*')));

                        if allow_bg_indicator || is_zalo_bg_change {
                            let (notif_tag, notif_body) = indicator.unwrap_or_else(|| {
                                ("Tin nhắn mới".to_string(), win.title.clone())
                            });

                            let alert_key =
                                format!("title_{}_{}_{}", proc_no_ext, notif_tag, notif_body);
                            if !recent_alerts.contains_key(&alert_key) {
                                recent_alerts.insert(alert_key, now_sec);
                                let title_desc = format!("{} [{}]", rule.name, notif_tag);
                                let body_desc = if !notif_body.is_empty() {
                                    notif_body
                                } else {
                                    format!(
                                        "Ứng dụng {} vừa có thông báo hoặc tin nhắn mới.",
                                        rule.name
                                    )
                                };

                                println!(
                                    "[NOTIF] App notification captured từ {}: {} - {}",
                                    rule.name, title_desc, body_desc
                                );

                                state.dispatch_notification(
                                    "windows",
                                    &rule.name,
                                    &title_desc,
                                    &body_desc,
                                );
                            }
                        }
                    }
                }
            }
        }

        prev_titles = current_map;
    }
}

#[cfg(not(windows))]
fn start_real_windows_notification_monitor(_state: Arc<NotificationState>) {}
