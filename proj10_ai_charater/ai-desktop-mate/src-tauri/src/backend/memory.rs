use serde::Serialize;
use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int, c_void};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

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

pub struct MemoryDb {
    api: SqliteApi,
    db: *mut c_void,
}

unsafe impl Send for MemoryDb {}

pub struct MemoryState {
    pub inner: Mutex<Option<MemoryDb>>,
    pub db_path: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct ProfileFact {
    pub key: String,
    pub value: String,
    pub updated_at: i64,
}

#[derive(Serialize, Clone, Debug)]
pub struct ChatEntry {
    pub role: String,
    pub content: String,
    pub created_at: i64,
}

#[derive(Serialize, Clone, Debug)]
pub struct AppUsageStat {
    pub app_title: String,
    pub total_sec: i64,
}

#[derive(Serialize, Clone, Debug)]
pub struct HabitPattern {
    pub app_title: String,
    pub hour_of_day: i64,
    pub days_count: i64,
    pub total_sec: i64,
    pub accepted_count: i64,
    pub dismissed_count: i64,
    pub last_shown_at: i64,
}

#[derive(Serialize, Clone, Debug)]
pub struct MemoryInsights {
    pub db_ready: bool,
    pub db_path: String,
    pub profile_facts: Vec<ProfileFact>,
    pub top_apps_today: Vec<AppUsageStat>,
    pub habit_for_hour: Option<HabitPattern>,
    pub total_chat_count: i64,
}

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn today_date_key() -> String {
    // Tính ngày địa phương đơn giản theo UTC+7 (hoặc ngày hiện tại)
    let secs = now_unix() + 7 * 3600;
    let days = secs / 86400;
    format!("day_{days}")
}

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

impl MemoryDb {
    fn open_raw(path: &PathBuf) -> Result<Self, String> {
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
            Ok(Self { api, db })
        }
        #[cfg(not(windows))]
        {
            let _ = path;
            Err("Chỉ hỗ trợ SQLite trên Windows".to_string())
        }
    }

    fn open(path: &PathBuf) -> Result<Self, String> {
        let instance = Self::open_raw(path)?;
        instance.init_schema()?;
        Ok(instance)
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

    fn init_schema(&self) -> Result<(), String> {
        self.exec_sql(
            "
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS user_profile (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS chat_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS activity_logs (
                app_title TEXT NOT NULL,
                hour_of_day INTEGER NOT NULL,
                date_key TEXT NOT NULL,
                duration_sec INTEGER NOT NULL,
                PRIMARY KEY (app_title, hour_of_day, date_key)
            );
            CREATE TABLE IF NOT EXISTS suggestion_feedback (
                pattern_key TEXT PRIMARY KEY,
                accepted_count INTEGER NOT NULL DEFAULT 0,
                dismissed_count INTEGER NOT NULL DEFAULT 0,
                last_shown_at INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS memory_vectors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                embedding_json TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS daily_summaries (
                date_key TEXT PRIMARY KEY,
                summary TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS long_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                updated_at INTEGER NOT NULL
            );
            ",
        )?;

        let mut count = 0i64;
        if let Ok(stmt) = self.prepare("SELECT COUNT(*) FROM long_memory") {
            unsafe {
                if (self.api.step)(stmt) == SQLITE_ROW {
                    count = (self.api.column_int64)(stmt, 0);
                }
                (self.api.finalize)(stmt);
            }
        }
        if count == 0 {
            let defaults = [
                (
                    "persona",
                    "Tính cách mặc định",
                    "Thân thiện, hóm hỉnh, chủ động quan tâm sức khỏe và công việc của chủ nhân, trả lời ngắn gọn súc tích.",
                ),
                (
                    "rule",
                    "Quy tắc trả lời",
                    "Luôn dùng tiếng Việt có dấu tự nhiên, không dùng emoji, ưu tiên giải pháp thực tế.",
                ),
            ];
            let now = now_unix();
            for (cat, title, content) in defaults {
                if let Ok(stmt) = self.prepare(
                    "INSERT INTO long_memory (category, title, content, enabled, updated_at) VALUES (?1, ?2, ?3, 1, ?4)",
                ) {
                    self.bind_str(stmt, 1, cat);
                    self.bind_str(stmt, 2, title);
                    self.bind_str(stmt, 3, content);
                    unsafe {
                        (self.api.bind_int64)(stmt, 4, now);
                        (self.api.step)(stmt);
                        (self.api.finalize)(stmt);
                    }
                }
            }
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
}

pub fn init_memory_state(app_data_dir: Option<PathBuf>) -> MemoryState {
    // Ưu tiên lưu DB ngay trong thư mục dự án (ai-desktop-mate/data/mate_memory.db) để dễ quản lý & kiểm tra
    let project_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.to_path_buf());

    let dir = match project_root {
        Some(ref root) if root.exists() => root.join("data"),
        _ => app_data_dir.clone().unwrap_or_else(|| PathBuf::from(".")),
    };

    let _ = std::fs::create_dir_all(&dir);
    let db_path = dir.join("mate_memory.db");

    // Tự động di chuyển dữ liệu cũ từ AppData vào thư mục dự án nếu chưa có
    if !db_path.exists() {
        if let Some(ref legacy_dir) = app_data_dir {
            let legacy_db = legacy_dir.join("mate_memory.db");
            if legacy_db.exists() {
                let _ = std::fs::copy(&legacy_db, &db_path);
            }
        }
    }

    let db_path_str = db_path.to_string_lossy().to_string();

    let inner = match MemoryDb::open(&db_path) {
        Ok(db) => Some(db),
        Err(_) => None,
    };

    MemoryState {
        inner: Mutex::new(inner),
        db_path: db_path_str,
    }
}

#[tauri::command]
pub fn memory_save_profile(
    state: tauri::State<'_, MemoryState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare(
        "INSERT INTO user_profile (key, value, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )?;
    db.bind_str(stmt, 1, &key);
    db.bind_str(stmt, 2, &value);
    unsafe {
        (db.api.bind_int64)(stmt, 3, now_unix());
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(())
}

#[tauri::command]
pub fn memory_save_chat(
    state: tauri::State<'_, MemoryState>,
    role: String,
    content: String,
) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare(
        "INSERT INTO chat_memory (role, content, created_at) VALUES (?1, ?2, ?3)",
    )?;
    db.bind_str(stmt, 1, &role);
    db.bind_str(stmt, 2, &content);
    unsafe {
        (db.api.bind_int64)(stmt, 3, now_unix());
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(())
}

#[tauri::command]
pub fn memory_get_recent_chats(
    state: tauri::State<'_, MemoryState>,
    limit: i64,
) -> Result<Vec<ChatEntry>, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare(
        "SELECT role, content, created_at FROM (
            SELECT id, role, content, created_at FROM chat_memory ORDER BY id DESC LIMIT ?1
         ) ORDER BY id ASC",
    )?;
    unsafe {
        (db.api.bind_int64)(stmt, 1, limit.clamp(1, 30));
    }
    let mut items = Vec::new();
    unsafe {
        while (db.api.step)(stmt) == SQLITE_ROW {
            items.push(ChatEntry {
                role: db.col_str(stmt, 0),
                content: db.col_str(stmt, 1),
                created_at: (db.api.column_int64)(stmt, 2),
            });
        }
        (db.api.finalize)(stmt);
    }
    Ok(items)
}

#[tauri::command]
pub fn memory_log_activity(
    state: tauri::State<'_, MemoryState>,
    app_title: String,
    hour_of_day: i64,
    duration_sec: i64,
) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare(
        "INSERT INTO activity_logs (app_title, hour_of_day, date_key, duration_sec)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(app_title, hour_of_day, date_key)
         DO UPDATE SET duration_sec = duration_sec + excluded.duration_sec",
    )?;
    let date_key = today_date_key();
    db.bind_str(stmt, 1, &app_title);
    unsafe {
        (db.api.bind_int64)(stmt, 2, hour_of_day.clamp(0, 23));
    }
    db.bind_str(stmt, 3, &date_key);
    unsafe {
        (db.api.bind_int64)(stmt, 4, duration_sec.max(1));
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(())
}

#[tauri::command]
pub fn memory_record_feedback(
    state: tauri::State<'_, MemoryState>,
    pattern_key: String,
    accepted: bool,
) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let acc_inc: i64 = if accepted { 1 } else { 0 };
    let dis_inc: i64 = if accepted { 0 } else { 1 };
    let stmt = db.prepare(
        "INSERT INTO suggestion_feedback (pattern_key, accepted_count, dismissed_count, last_shown_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(pattern_key) DO UPDATE SET
            accepted_count = accepted_count + excluded.accepted_count,
            dismissed_count = dismissed_count + excluded.dismissed_count,
            last_shown_at = excluded.last_shown_at",
    )?;
    db.bind_str(stmt, 1, &pattern_key);
    unsafe {
        (db.api.bind_int64)(stmt, 2, acc_inc);
        (db.api.bind_int64)(stmt, 3, dis_inc);
        (db.api.bind_int64)(stmt, 4, now_unix());
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(())
}

#[tauri::command]
pub fn memory_get_insights(
    state: tauri::State<'_, MemoryState>,
    current_hour: i64,
) -> Result<MemoryInsights, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let Some(db) = guard.as_ref() else {
        return Ok(MemoryInsights {
            db_ready: false,
            db_path: state.db_path.clone(),
            profile_facts: vec![],
            top_apps_today: vec![],
            habit_for_hour: None,
            total_chat_count: 0,
        });
    };

    // 1. User Profile Facts
    let mut profile_facts = Vec::new();
    if let Ok(stmt) = db.prepare("SELECT key, value, updated_at FROM user_profile ORDER BY updated_at DESC LIMIT 12") {
        unsafe {
            while (db.api.step)(stmt) == SQLITE_ROW {
                profile_facts.push(ProfileFact {
                    key: db.col_str(stmt, 0),
                    value: db.col_str(stmt, 1),
                    updated_at: (db.api.column_int64)(stmt, 2),
                });
            }
            (db.api.finalize)(stmt);
        }
    }

    // 2. Top Apps Today
    let mut top_apps_today = Vec::new();
    let date_key = today_date_key();
    if let Ok(stmt) = db.prepare(
        "SELECT app_title, SUM(duration_sec) as total_sec
         FROM activity_logs WHERE date_key = ?1
         GROUP BY app_title ORDER BY total_sec DESC LIMIT 4",
    ) {
        db.bind_str(stmt, 1, &date_key);
        unsafe {
            while (db.api.step)(stmt) == SQLITE_ROW {
                top_apps_today.push(AppUsageStat {
                    app_title: db.col_str(stmt, 0),
                    total_sec: (db.api.column_int64)(stmt, 1),
                });
            }
            (db.api.finalize)(stmt);
        }
    }

    // 3. Habit for current hour
    let mut habit_for_hour: Option<HabitPattern> = None;
    if let Ok(stmt) = db.prepare(
        "SELECT a.app_title, COUNT(DISTINCT a.date_key) as days_cnt, SUM(a.duration_sec) as total_sec,
                COALESCE(f.accepted_count, 0), COALESCE(f.dismissed_count, 0), COALESCE(f.last_shown_at, 0)
         FROM activity_logs a
         LEFT JOIN suggestion_feedback f ON f.pattern_key = ('hour_' || ?1 || '_' || a.app_title)
         WHERE a.hour_of_day = ?1
         GROUP BY a.app_title
         ORDER BY total_sec DESC LIMIT 1",
    ) {
        unsafe {
            (db.api.bind_int64)(stmt, 1, current_hour.clamp(0, 23));
            if (db.api.step)(stmt) == SQLITE_ROW {
                habit_for_hour = Some(HabitPattern {
                    app_title: db.col_str(stmt, 0),
                    hour_of_day: current_hour,
                    days_count: (db.api.column_int64)(stmt, 1),
                    total_sec: (db.api.column_int64)(stmt, 2),
                    accepted_count: (db.api.column_int64)(stmt, 3),
                    dismissed_count: (db.api.column_int64)(stmt, 4),
                    last_shown_at: (db.api.column_int64)(stmt, 5),
                });
            }
            (db.api.finalize)(stmt);
        }
    }

    // 4. Total chats
    let mut total_chat_count = 0;
    if let Ok(stmt) = db.prepare("SELECT COUNT(*) FROM chat_memory") {
        unsafe {
            if (db.api.step)(stmt) == SQLITE_ROW {
                total_chat_count = (db.api.column_int64)(stmt, 0);
            }
            (db.api.finalize)(stmt);
        }
    }

    Ok(MemoryInsights {
        db_ready: true,
        db_path: state.db_path.clone(),
        profile_facts,
        top_apps_today,
        habit_for_hour,
        total_chat_count,
    })
}

#[tauri::command]
pub fn memory_clear_all(state: tauri::State<'_, MemoryState>) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    db.exec_sql(
        "DELETE FROM user_profile;
         DELETE FROM chat_memory;
         DELETE FROM activity_logs;
         DELETE FROM suggestion_feedback;
         DELETE FROM memory_vectors;
         DELETE FROM daily_summaries;",
    )
}

#[tauri::command]
pub fn memory_delete_profile(
    state: tauri::State<'_, MemoryState>,
    key: String,
) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare("DELETE FROM user_profile WHERE key = ?1")?;
    db.bind_str(stmt, 1, &key);
    unsafe {
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(())
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let mut dot = 0.0f32;
    let mut na = 0.0f32;
    let mut nb = 0.0f32;
    for i in 0..a.len() {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    let denom = na.sqrt() * nb.sqrt();
    if denom <= 1e-8 { 0.0 } else { dot / denom }
}

#[tauri::command]
pub fn memory_save_embedding(
    state: tauri::State<'_, MemoryState>,
    content: String,
    embedding: Vec<f32>,
) -> Result<(), String> {
    if embedding.is_empty() || content.trim().is_empty() {
        return Ok(());
    }
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let json = serde_json::to_string(&embedding).map_err(|e| e.to_string())?;
    let stmt = db.prepare(
        "INSERT INTO memory_vectors (content, embedding_json, created_at) VALUES (?1, ?2, ?3)",
    )?;
    db.bind_str(stmt, 1, content.trim());
    db.bind_str(stmt, 2, &json);
    unsafe {
        (db.api.bind_int64)(stmt, 3, now_unix());
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(())
}

#[tauri::command]
pub fn memory_search_similar(
    state: tauri::State<'_, MemoryState>,
    query_embedding: Vec<f32>,
    top_k: i64,
) -> Result<Vec<String>, String> {
    if query_embedding.is_empty() {
        return Ok(Vec::new());
    }
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare(
        "SELECT content, embedding_json FROM memory_vectors ORDER BY id DESC LIMIT 200",
    )?;
    let mut scored: Vec<(f32, String)> = Vec::new();
    unsafe {
        while (db.api.step)(stmt) == SQLITE_ROW {
            let content = db.col_str(stmt, 0);
            let emb_json = db.col_str(stmt, 1);
            if let Ok(vec) = serde_json::from_str::<Vec<f32>>(&emb_json) {
                let score = cosine_similarity(&query_embedding, &vec);
                if score > 0.35 {
                    scored.push((score, content));
                }
            }
        }
        (db.api.finalize)(stmt);
    }
    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    let k = top_k.clamp(1, 10) as usize;
    Ok(scored.into_iter().take(k).map(|(_, c)| c).collect())
}

#[tauri::command]
pub fn memory_save_daily_summary(
    state: tauri::State<'_, MemoryState>,
    summary: String,
) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare(
        "INSERT INTO daily_summaries (date_key, summary, updated_at)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(date_key) DO UPDATE SET summary = excluded.summary, updated_at = excluded.updated_at",
    )?;
    db.bind_str(stmt, 1, &today_date_key());
    db.bind_str(stmt, 2, summary.trim());
    unsafe {
        (db.api.bind_int64)(stmt, 3, now_unix());
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(())
}

#[tauri::command]
pub fn memory_get_daily_summary(
    state: tauri::State<'_, MemoryState>,
) -> Result<Option<String>, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare("SELECT summary FROM daily_summaries WHERE date_key = ?1")?;
    db.bind_str(stmt, 1, &today_date_key());
    let mut out = None;
    unsafe {
        if (db.api.step)(stmt) == SQLITE_ROW {
            out = Some(db.col_str(stmt, 0));
        }
        (db.api.finalize)(stmt);
    }
    Ok(out)
}

#[derive(Serialize, Clone, Debug)]
pub struct BrowserItem {
    pub title: String,
    pub url: String,
    pub visit_count: i64,
}

#[derive(Serialize, Clone, Debug)]
pub struct BrowserInsights {
    pub browser_name: String,
    pub top_youtube: Vec<BrowserItem>,
    pub top_sites: Vec<BrowserItem>,
}

#[tauri::command]
pub fn memory_scan_browser_history() -> Result<BrowserInsights, String> {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|_| "Không xác định được thư mục LOCALAPPDATA".to_string())?;
    let base = PathBuf::from(local_app_data);

    let candidates = [
        ("Google Chrome", base.join(r"Google\Chrome\User Data\Default\History")),
        ("Google Chrome (Profile 1)", base.join(r"Google\Chrome\User Data\Profile 1\History")),
        ("Microsoft Edge", base.join(r"Microsoft\Edge\User Data\Default\History")),
        ("Brave", base.join(r"BraveSoftware\Brave-Browser\User Data\Default\History")),
        ("Cốc Cốc", base.join(r"CocCoc\Browser\User Data\Default\History")),
    ];

    let mut chosen: Option<(&str, PathBuf)> = None;
    let mut best_mtime = std::time::UNIX_EPOCH;
    for (name, path) in candidates {
        if path.exists() {
            let mtime = std::fs::metadata(&path)
                .and_then(|m| m.modified())
                .unwrap_or(std::time::UNIX_EPOCH);
            if chosen.is_none() || mtime > best_mtime {
                best_mtime = mtime;
                chosen = Some((name, path));
            }
        }
    }

    let (browser_name, src_path) = chosen
        .ok_or_else(|| "Không tìm thấy tệp History của Chrome/Edge/Brave/Cốc Cốc".to_string())?;

    let tmp_path = std::env::temp_dir().join("mate_browser_hist_tmp.db");
    let _ = std::fs::remove_file(&tmp_path);
    std::fs::copy(&src_path, &tmp_path)
        .map_err(|e| format!("Không thể sao chép lịch sử {browser_name}: {e}"))?;

    let db = MemoryDb::open_raw(&tmp_path)?;

    let mut top_youtube: Vec<BrowserItem> = Vec::new();
    if let Ok(stmt) = db.prepare(
        "SELECT title, url, visit_count FROM urls
         WHERE (url LIKE '%youtube.com/watch%' OR url LIKE '%youtube.com/@%')
           AND title != '' AND title != 'YouTube'
         ORDER BY visit_count DESC, last_visit_time DESC LIMIT 5",
    ) {
        unsafe {
            while (db.api.step)(stmt) == SQLITE_ROW {
                top_youtube.push(BrowserItem {
                    title: db.col_str(stmt, 0),
                    url: db.col_str(stmt, 1),
                    visit_count: (db.api.column_int64)(stmt, 2),
                });
            }
            (db.api.finalize)(stmt);
        }
    }

    let mut top_sites: Vec<BrowserItem> = Vec::new();
    if let Ok(stmt) = db.prepare(
        "SELECT title, url, visit_count FROM urls
         WHERE url LIKE 'http%' AND url NOT LIKE '%youtube.com%'
           AND url NOT LIKE '%localhost%' AND url NOT LIKE '%127.0.0.1%'
           AND title != ''
         ORDER BY visit_count DESC, last_visit_time DESC LIMIT 5",
    ) {
        unsafe {
            while (db.api.step)(stmt) == SQLITE_ROW {
                top_sites.push(BrowserItem {
                    title: db.col_str(stmt, 0),
                    url: db.col_str(stmt, 1),
                    visit_count: (db.api.column_int64)(stmt, 2),
                });
            }
            (db.api.finalize)(stmt);
        }
    }

    unsafe {
        (db.api.close)(db.db);
    }
    let _ = std::fs::remove_file(&tmp_path);

    Ok(BrowserInsights {
        browser_name: browser_name.to_string(),
        top_youtube,
        top_sites,
    })
}

#[derive(Serialize, Clone, Debug)]
pub struct LongMemoryEntry {
    pub id: i64,
    pub category: String,
    pub title: String,
    pub content: String,
    pub enabled: bool,
    pub updated_at: i64,
}

#[tauri::command]
pub fn long_memory_list(state: tauri::State<'_, MemoryState>) -> Result<Vec<LongMemoryEntry>, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare(
        "SELECT id, category, title, content, enabled, updated_at
         FROM long_memory
         ORDER BY CASE category WHEN 'persona' THEN 0 WHEN 'rule' THEN 1 ELSE 2 END, id DESC",
    )?;
    let mut entries: Vec<LongMemoryEntry> = Vec::new();
    unsafe {
        while (db.api.step)(stmt) == SQLITE_ROW {
            entries.push(LongMemoryEntry {
                id: (db.api.column_int64)(stmt, 0),
                category: db.col_str(stmt, 1),
                title: db.col_str(stmt, 2),
                content: db.col_str(stmt, 3),
                enabled: (db.api.column_int64)(stmt, 4) != 0,
                updated_at: (db.api.column_int64)(stmt, 5),
            });
        }
        (db.api.finalize)(stmt);
    }
    Ok(entries)
}

#[tauri::command]
pub fn long_memory_upsert(
    state: tauri::State<'_, MemoryState>,
    category: String,
    title: String,
    content: String,
) -> Result<(), String> {
    let cat_clean = category.trim().to_string();
    let title_clean = title.trim().to_string();
    let content_clean = content.trim().to_string();
    if content_clean.is_empty() {
        return Err("Nội dung Long Memory không được trống".to_string());
    }

    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let now = now_unix();

    if cat_clean == "persona" {
        let mut existing_id: Option<i64> = None;
        if let Ok(stmt) = db.prepare("SELECT id FROM long_memory WHERE category = 'persona' LIMIT 1") {
            unsafe {
                if (db.api.step)(stmt) == SQLITE_ROW {
                    existing_id = Some((db.api.column_int64)(stmt, 0));
                }
                (db.api.finalize)(stmt);
            }
        }
        if let Some(id) = existing_id {
            let stmt = db.prepare(
                "UPDATE long_memory SET title = ?1, content = ?2, enabled = 1, updated_at = ?3 WHERE id = ?4",
            )?;
            db.bind_str(stmt, 1, if title_clean.is_empty() { "Tính cách nhân vật" } else { &title_clean });
            db.bind_str(stmt, 2, &content_clean);
            unsafe {
                (db.api.bind_int64)(stmt, 3, now);
                (db.api.bind_int64)(stmt, 4, id);
                (db.api.step)(stmt);
                (db.api.finalize)(stmt);
            }
            return Ok(());
        }
    }

    let stmt = db.prepare(
        "INSERT INTO long_memory (category, title, content, enabled, updated_at) VALUES (?1, ?2, ?3, 1, ?4)",
    )?;
    db.bind_str(stmt, 1, if cat_clean.is_empty() { "rule" } else { &cat_clean });
    db.bind_str(stmt, 2, if title_clean.is_empty() { "Quy tắc" } else { &title_clean });
    db.bind_str(stmt, 3, &content_clean);
    unsafe {
        (db.api.bind_int64)(stmt, 4, now);
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(())
}

#[tauri::command]
pub fn long_memory_toggle(
    state: tauri::State<'_, MemoryState>,
    id: i64,
    enabled: bool,
) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare("UPDATE long_memory SET enabled = ?1, updated_at = ?2 WHERE id = ?3")?;
    unsafe {
        (db.api.bind_int64)(stmt, 1, if enabled { 1 } else { 0 });
        (db.api.bind_int64)(stmt, 2, now_unix());
        (db.api.bind_int64)(stmt, 3, id);
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(())
}

#[tauri::command]
pub fn long_memory_delete(
    state: tauri::State<'_, MemoryState>,
    id: i64,
) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare("DELETE FROM long_memory WHERE id = ?1")?;
    unsafe {
        (db.api.bind_int64)(stmt, 1, id);
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(())
}

