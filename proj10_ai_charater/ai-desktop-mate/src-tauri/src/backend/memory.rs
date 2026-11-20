use crate::backend::telemetry::EnglishVocabItem;
use serde::{Deserialize, Serialize};
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
            PRAGMA busy_timeout=5000;
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
            CREATE TABLE IF NOT EXISTS avatar_studio_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS scheduled_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                schedule_time TEXT NOT NULL DEFAULT '',
                repeat_daily INTEGER NOT NULL DEFAULT 0,
                is_done INTEGER NOT NULL DEFAULT 0,
                last_triggered_date TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS clipboard_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS user_macros (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trigger_name TEXT UNIQUE NOT NULL,
                actions_json TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS english_vocab_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT NOT NULL UNIQUE,
                phonetic TEXT NOT NULL,
                part_of_speech TEXT NOT NULL,
                meaning_vi TEXT NOT NULL,
                definition_en TEXT NOT NULL,
                example_en TEXT NOT NULL,
                example_vi TEXT NOT NULL,
                audio_url TEXT NOT NULL,
                topic TEXT NOT NULL,
                learned_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS custom_skills (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                language TEXT NOT NULL,
                triggers_json TEXT NOT NULL DEFAULT '[]',
                params_schema_json TEXT NOT NULL DEFAULT '[]',
                code TEXT NOT NULL,
                test_args_json TEXT NOT NULL DEFAULT '{}',
                expected_keywords_json TEXT NOT NULL DEFAULT '[]',
                version INTEGER NOT NULL DEFAULT 1,
                verified INTEGER NOT NULL DEFAULT 0,
                code_hash TEXT NOT NULL DEFAULT '',
                last_test_output TEXT NOT NULL DEFAULT '',
                last_test_ms INTEGER NOT NULL DEFAULT 0,
                usage_count INTEGER NOT NULL DEFAULT 0,
                heal_count INTEGER NOT NULL DEFAULT 0,
                last_heal_note TEXT NOT NULL DEFAULT '',
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS tarot_readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                drawn_at_ms INTEGER NOT NULL,
                next_draw_at_ms INTEGER NOT NULL,
                card_name TEXT NOT NULL,
                card_name_vi TEXT NOT NULL,
                card_short TEXT NOT NULL,
                arcana_type TEXT NOT NULL,
                is_reversed INTEGER NOT NULL DEFAULT 0,
                fortune_code TEXT NOT NULL,
                fortune_label TEXT NOT NULL,
                luck_score INTEGER NOT NULL DEFAULT 50,
                can_chi_day TEXT NOT NULL,
                ngu_hanh TEXT NOT NULL,
                lucky_color TEXT NOT NULL,
                lucky_numbers TEXT NOT NULL,
                summary_vi TEXT NOT NULL,
                work_advice TEXT NOT NULL,
                wealth_advice TEXT NOT NULL,
                love_advice TEXT NOT NULL,
                remedy_advice TEXT NOT NULL,
                meaning_en TEXT NOT NULL DEFAULT '',
                api_source TEXT NOT NULL DEFAULT 'tarotapi.dev',
                ai_deep_reading TEXT NOT NULL DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS idx_tarot_drawn_at ON tarot_readings(drawn_at_ms DESC);
            ",
        )?;

        let mut macro_count = 0i64;
        if let Ok(stmt) = self.prepare("SELECT COUNT(*) FROM user_macros") {
            unsafe {
                if (self.api.step)(stmt) == SQLITE_ROW {
                    macro_count = (self.api.column_int64)(stmt, 0);
                }
                (self.api.finalize)(stmt);
            }
        }
        if macro_count == 0 {
            let default_macros = [
                (
                    "chế độ code",
                    r#"[TOOL:open_app:{"target":"code"}][TOOL:control_window:{"action":"split_2"}][TOOL:web_search:{"engine":"youtube","query":"lofi coding"}][TOOL:timer:{"minutes":45,"task":"Tập trung Code"}][TOOL:system_control:{"action":"power_high"}]"#,
                ),
                (
                    "chế độ họp",
                    r#"[TOOL:media:{"action":"mute"}][TOOL:control_window:{"action":"minimize"}][TOOL:sticky_note:{"action":"pin","text":"Đang họp - ghi chú nhanh"}]"#,
                ),
                (
                    "chế độ giải lao",
                    r#"[TOOL:hardware:{"action":"clean_ram"}][TOOL:swim:{"action":"start"}][TOOL:timer:{"minutes":5,"task":"Nghỉ mắt uống nước"}]"#,
                ),
            ];
            let now = now_unix();
            for (name, acts) in default_macros {
                if let Ok(stmt) = self.prepare(
                    "INSERT INTO user_macros (trigger_name, actions_json, updated_at) VALUES (?1, ?2, ?3)",
                ) {
                    self.bind_str(stmt, 1, name);
                    self.bind_str(stmt, 2, acts);
                    unsafe {
                        (self.api.bind_int64)(stmt, 3, now);
                        (self.api.step)(stmt);
                        (self.api.finalize)(stmt);
                    }
                }
            }
        }

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


#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default)]
pub struct AvatarStudioConfig {
    pub active_character_type: String,
    pub vrm_url: String,
    pub duck_body_color: String,
    pub duck_accent_color: String,
    pub model_scale: f64,
    pub gravity: f64,
    pub bounce_factor: f64,
    pub auto_roam_enabled: bool,
    pub look_at_enabled: bool,
    pub window_interact_enabled: bool,
    pub ollama_model: String,
    pub gemini_api_key: String,
    pub gemini_model: String,
    pub llm_route_mode: String,
    pub auto_check_enabled: bool,
    pub cpu_alert_pct: f64,
    pub ram_alert_gb: f64,
    pub sound_fx_enabled: bool,
    pub sound_volume: f64,
    pub english_interval_min: f64,
    pub news_interval_min: f64,
    pub weather_interval_min: f64,
    pub app_metrics_interval_min: f64,
    pub btc_interval_min: f64,
    pub weather_source_mode: String,
    pub weather_custom_mode: String,
    pub weather_custom_temp_c: f64,
    pub weather_custom_humidity_pct: i32,
    pub weather_custom_location: String,
    pub weather_custom_desc: String,
    pub voice_tts_enabled: bool,
    pub chat_dock_side: String,
    pub auto_action_interval_sec: f64,
    pub auto_behaviors_json: String,
}

impl Default for AvatarStudioConfig {
    fn default() -> Self {
        Self {
            active_character_type: "microduck".to_string(),
            vrm_url: String::new(),
            duck_body_color: "#f4f4f6".to_string(),
            duck_accent_color: "#f97316".to_string(),
            model_scale: 1.0,
            gravity: 0.68,
            bounce_factor: 0.42,
            auto_roam_enabled: true,
            look_at_enabled: true,
            window_interact_enabled: true,
            ollama_model: "qwen2.5:1.5b".to_string(),
            gemini_api_key: String::new(),
            gemini_model: "gemini-3.5-flash".to_string(),
            llm_route_mode: "auto".to_string(),
            auto_check_enabled: true,
            cpu_alert_pct: 85.0,
            ram_alert_gb: 12.0,
            sound_fx_enabled: true,
            sound_volume: 0.7,
            english_interval_min: 15.0,
            news_interval_min: 20.0,
            weather_interval_min: 30.0,
            app_metrics_interval_min: 25.0,
            btc_interval_min: 30.0,
            weather_source_mode: "api".to_string(),
            weather_custom_mode: "clear".to_string(),
            weather_custom_temp_c: 28.0,
            weather_custom_humidity_pct: 68,
            weather_custom_location: "Tùy chỉnh".to_string(),
            weather_custom_desc: "Trời quang đãng".to_string(),
            voice_tts_enabled: true,
            chat_dock_side: "right".to_string(),
            auto_action_interval_sec: 15.0,
            auto_behaviors_json: String::new(),
        }
    }
}

#[tauri::command]
pub fn get_avatar_studio_config(state: tauri::State<'_, MemoryState>) -> AvatarStudioConfig {
    let mut env_key = crate::backend::llm::read_env_value("GEMINI_API_KEY")
        .or_else(|| crate::backend::llm::read_env_value("VITE_GEMINI_API_KEY"))
        .unwrap_or_default();

    let guard = match state.inner.lock() {
        Ok(g) => g,
        Err(_) => {
            let mut def = AvatarStudioConfig::default();
            def.gemini_api_key = env_key;
            return def;
        }
    };
    let Some(db) = guard.as_ref() else {
        let mut def = AvatarStudioConfig::default();
        def.gemini_api_key = env_key;
        return def;
    };

    let mut raw_json: Option<String> = None;
    if let Ok(stmt) = db.prepare(
        "SELECT value FROM avatar_studio_config WHERE key = 'studio_config_json' LIMIT 1",
    ) {
        unsafe {
            if (db.api.step)(stmt) == SQLITE_ROW {
                raw_json = Some(db.col_str(stmt, 0));
            }
            (db.api.finalize)(stmt);
        }
    }

    if let Some(json_str) = raw_json {
        if let Ok(mut parsed) = serde_json::from_str::<AvatarStudioConfig>(&json_str) {
            if !parsed.gemini_api_key.trim().is_empty() {
                if env_key.is_empty() {
                    let legacy = parsed.gemini_api_key.trim().to_string();
                    if crate::backend::llm::write_env_value("GEMINI_API_KEY", &legacy).is_ok() {
                        env_key = legacy;
                    }
                }
                parsed.gemini_api_key.clear();
                if let Ok(scrubbed_json) = serde_json::to_string(&parsed) {
                    if let Ok(stmt) = db.prepare(
                        "UPDATE avatar_studio_config SET value = ?1, updated_at = ?2 WHERE key = 'studio_config_json'",
                    ) {
                        db.bind_str(stmt, 1, &scrubbed_json);
                        unsafe {
                            (db.api.bind_int64)(stmt, 2, now_unix());
                            (db.api.step)(stmt);
                            (db.api.finalize)(stmt);
                        }
                    }
                }
            }
            parsed.gemini_api_key = env_key;
            return parsed;
        }
    }

    let mut def = AvatarStudioConfig::default();
    if let Some(m) = crate::backend::llm::read_env_value("GEMINI_MODEL") {
        def.gemini_model = m;
    }
    if let Some(o) = crate::backend::llm::read_env_value("OLLAMA_MODEL") {
        def.ollama_model = o;
    }
    if let Ok(json) = serde_json::to_string(&def) {
        if let Ok(stmt) = db.prepare(
            "INSERT INTO avatar_studio_config (key, value, updated_at) VALUES ('studio_config_json', ?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        ) {
            db.bind_str(stmt, 1, &json);
            unsafe {
                (db.api.bind_int64)(stmt, 2, now_unix());
                (db.api.step)(stmt);
                (db.api.finalize)(stmt);
            }
        }
    }
    def.gemini_api_key = env_key;
    def
}

#[tauri::command]
pub fn save_avatar_studio_config(
    state: tauri::State<'_, MemoryState>,
    config: AvatarStudioConfig,
) -> Result<String, String> {
    let env_res = crate::backend::llm::write_env_value("GEMINI_API_KEY", config.gemini_api_key.trim());
    let mut sanitized = config;
    sanitized.gemini_api_key.clear();

    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let json = serde_json::to_string(&sanitized).map_err(|e| e.to_string())?;
    let stmt = db.prepare(
        "INSERT INTO avatar_studio_config (key, value, updated_at) VALUES ('studio_config_json', ?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )?;
    db.bind_str(stmt, 1, &json);
    unsafe {
        (db.api.bind_int64)(stmt, 2, now_unix());
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    if let Err(err) = env_res {
        return Ok(format!(
            "[SUCCESS] Đã lưu cấu hình Studio vào SQLite (lưu .env cảnh báo: {err})"
        ));
    }
    Ok("[SUCCESS] Đã đồng bộ cấu hình Studio vào SQLite và GEMINI_API_KEY vào .env!".to_string())
}

#[tauri::command]
pub fn memory_clear_chat_history(state: tauri::State<'_, MemoryState>) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    db.exec_sql("DELETE FROM chat_memory;")
}

#[derive(Serialize, Clone, Debug)]
pub struct ScheduledNoteEntry {
    pub id: i64,
    pub content: String,
    pub schedule_time: String,
    pub repeat_daily: bool,
    pub is_done: bool,
    pub last_triggered_date: String,
    pub created_at: i64,
}

#[tauri::command]
pub fn schedule_note_list(
    state: tauri::State<'_, MemoryState>,
) -> Result<Vec<ScheduledNoteEntry>, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare(
        "SELECT id, content, schedule_time, repeat_daily, is_done, last_triggered_date, created_at
         FROM scheduled_notes
         ORDER BY is_done ASC, CASE WHEN schedule_time = '' THEN 1 ELSE 0 END ASC, schedule_time ASC, id DESC",
    )?;
    let mut entries = Vec::new();
    unsafe {
        while (db.api.step)(stmt) == SQLITE_ROW {
            entries.push(ScheduledNoteEntry {
                id: (db.api.column_int64)(stmt, 0),
                content: db.col_str(stmt, 1),
                schedule_time: db.col_str(stmt, 2),
                repeat_daily: (db.api.column_int64)(stmt, 3) != 0,
                is_done: (db.api.column_int64)(stmt, 4) != 0,
                last_triggered_date: db.col_str(stmt, 5),
                created_at: (db.api.column_int64)(stmt, 6),
            });
        }
        (db.api.finalize)(stmt);
    }
    Ok(entries)
}

#[tauri::command]
pub fn schedule_note_add(
    state: tauri::State<'_, MemoryState>,
    content: String,
    schedule_time: String,
    repeat_daily: bool,
) -> Result<ScheduledNoteEntry, String> {
    let clean_content = content.trim().to_string();
    if clean_content.is_empty() {
        return Err("Nội dung lịch hẹn / ghi chú không được trống".to_string());
    }
    let clean_time = schedule_time.trim().to_string();
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let now = now_unix();

    let stmt = db.prepare(
        "INSERT INTO scheduled_notes (content, schedule_time, repeat_daily, is_done, last_triggered_date, created_at)
         VALUES (?1, ?2, ?3, 0, '', ?4)",
    )?;
    db.bind_str(stmt, 1, &clean_content);
    db.bind_str(stmt, 2, &clean_time);
    unsafe {
        (db.api.bind_int64)(stmt, 3, if repeat_daily { 1 } else { 0 });
        (db.api.bind_int64)(stmt, 4, now);
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }

    let sel = db.prepare(
        "SELECT id, content, schedule_time, repeat_daily, is_done, last_triggered_date, created_at
         FROM scheduled_notes ORDER BY id DESC LIMIT 1",
    )?;
    let mut created: Option<ScheduledNoteEntry> = None;
    unsafe {
        if (db.api.step)(sel) == SQLITE_ROW {
            created = Some(ScheduledNoteEntry {
                id: (db.api.column_int64)(sel, 0),
                content: db.col_str(sel, 1),
                schedule_time: db.col_str(sel, 2),
                repeat_daily: (db.api.column_int64)(sel, 3) != 0,
                is_done: (db.api.column_int64)(sel, 4) != 0,
                last_triggered_date: db.col_str(sel, 5),
                created_at: (db.api.column_int64)(sel, 6),
            });
        }
        (db.api.finalize)(sel);
    }
    created.ok_or_else(|| "Không thể đọc lại lịch hẹn vừa tạo".to_string())
}

#[tauri::command]
pub fn schedule_note_toggle_done(
    state: tauri::State<'_, MemoryState>,
    id: i64,
    is_done: bool,
) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare("UPDATE scheduled_notes SET is_done = ?1 WHERE id = ?2")?;
    unsafe {
        (db.api.bind_int64)(stmt, 1, if is_done { 1 } else { 0 });
        (db.api.bind_int64)(stmt, 2, id);
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(())
}

#[tauri::command]
pub fn schedule_note_mark_triggered(
    state: tauri::State<'_, MemoryState>,
    id: i64,
    date_key: String,
    new_schedule_time: Option<String>,
) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    if let Some(next_time) = new_schedule_time {
        let stmt = db.prepare(
            "UPDATE scheduled_notes SET last_triggered_date = ?1, schedule_time = ?2 WHERE id = ?3",
        )?;
        db.bind_str(stmt, 1, date_key.trim());
        db.bind_str(stmt, 2, next_time.trim());
        unsafe {
            (db.api.bind_int64)(stmt, 3, id);
            (db.api.step)(stmt);
            (db.api.finalize)(stmt);
        }
    } else {
        let stmt = db.prepare(
            "UPDATE scheduled_notes SET last_triggered_date = ?1 WHERE id = ?2",
        )?;
        db.bind_str(stmt, 1, date_key.trim());
        unsafe {
            (db.api.bind_int64)(stmt, 2, id);
            (db.api.step)(stmt);
            (db.api.finalize)(stmt);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn schedule_note_delete(
    state: tauri::State<'_, MemoryState>,
    id: i64,
) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare("DELETE FROM scheduled_notes WHERE id = ?1")?;
    unsafe {
        (db.api.bind_int64)(stmt, 1, id);
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(())
}

#[tauri::command]
pub fn schedule_note_clear_all(state: tauri::State<'_, MemoryState>) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    db.exec_sql("DELETE FROM scheduled_notes;")
}

#[derive(Serialize, Clone, Debug)]
pub struct ClipboardHistoryEntry {
    pub id: i64,
    pub content: String,
    pub created_at: i64,
}

#[tauri::command]
pub fn clipboard_history_add(
    state: tauri::State<'_, MemoryState>,
    content: String,
) -> Result<(), String> {
    let clean = content.trim().to_string();
    if clean.is_empty() {
        return Ok(());
    }
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;

    let mut latest: Option<String> = None;
    if let Ok(sel) = db.prepare("SELECT content FROM clipboard_history ORDER BY id DESC LIMIT 1") {
        unsafe {
            if (db.api.step)(sel) == SQLITE_ROW {
                latest = Some(db.col_str(sel, 0));
            }
            (db.api.finalize)(sel);
        }
    }
    if latest.as_deref() == Some(clean.as_str()) {
        return Ok(());
    }

    let stmt = db.prepare("INSERT INTO clipboard_history (content, created_at) VALUES (?1, ?2)")?;
    db.bind_str(stmt, 1, &clean);
    unsafe {
        (db.api.bind_int64)(stmt, 2, now_unix());
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    let _ = db.exec_sql(
        "DELETE FROM clipboard_history WHERE id NOT IN (SELECT id FROM clipboard_history ORDER BY id DESC LIMIT 20);",
    );
    Ok(())
}

#[tauri::command]
pub fn clipboard_history_list(
    state: tauri::State<'_, MemoryState>,
) -> Result<Vec<ClipboardHistoryEntry>, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare(
        "SELECT id, content, created_at FROM clipboard_history ORDER BY id DESC LIMIT 20",
    )?;
    let mut items = Vec::new();
    unsafe {
        while (db.api.step)(stmt) == SQLITE_ROW {
            items.push(ClipboardHistoryEntry {
                id: (db.api.column_int64)(stmt, 0),
                content: db.col_str(stmt, 1),
                created_at: (db.api.column_int64)(stmt, 2),
            });
        }
        (db.api.finalize)(stmt);
    }
    Ok(items)
}

#[tauri::command]
pub fn clipboard_history_clear(state: tauri::State<'_, MemoryState>) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    db.exec_sql("DELETE FROM clipboard_history;")
}

#[derive(Serialize, Clone, Debug)]
pub struct MacroEntry {
    pub id: i64,
    pub trigger_name: String,
    pub actions_json: String,
    pub updated_at: i64,
}

#[tauri::command]
pub fn macro_list(state: tauri::State<'_, MemoryState>) -> Result<Vec<MacroEntry>, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare(
        "SELECT id, trigger_name, actions_json, updated_at FROM user_macros ORDER BY id ASC",
    )?;
    let mut list = Vec::new();
    unsafe {
        while (db.api.step)(stmt) == SQLITE_ROW {
            list.push(MacroEntry {
                id: (db.api.column_int64)(stmt, 0),
                trigger_name: db.col_str(stmt, 1),
                actions_json: db.col_str(stmt, 2),
                updated_at: (db.api.column_int64)(stmt, 3),
            });
        }
        (db.api.finalize)(stmt);
    }
    Ok(list)
}

#[tauri::command]
pub fn macro_upsert(
    state: tauri::State<'_, MemoryState>,
    trigger_name: String,
    actions_json: String,
) -> Result<(), String> {
    let trig = trigger_name.trim().to_lowercase();
    let acts = actions_json.trim().to_string();
    if trig.is_empty() || acts.is_empty() {
        return Err("Tên Macro hoặc danh sách lệnh không được để trống".to_string());
    }
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare(
        "INSERT INTO user_macros (trigger_name, actions_json, updated_at)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(trigger_name) DO UPDATE SET actions_json = excluded.actions_json, updated_at = excluded.updated_at",
    )?;
    db.bind_str(stmt, 1, &trig);
    db.bind_str(stmt, 2, &acts);
    unsafe {
        (db.api.bind_int64)(stmt, 3, now_unix());
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(())
}

#[tauri::command]
pub fn macro_delete(state: tauri::State<'_, MemoryState>, id: i64) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare("DELETE FROM user_macros WHERE id = ?1")?;
    unsafe {
        (db.api.bind_int64)(stmt, 1, id);
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(())
}

fn read_vocab_list(db: &MemoryDb, limit: i64) -> Result<Vec<EnglishVocabItem>, String> {
    let stmt = db.prepare(
        "SELECT word, phonetic, part_of_speech, meaning_vi, definition_en, example_en, example_vi, audio_url, topic
         FROM english_vocab_log
         ORDER BY learned_at DESC, id DESC
         LIMIT ?1",
    )?;
    let mut list = Vec::new();
    unsafe {
        (db.api.bind_int64)(stmt, 1, limit.max(1));
        while (db.api.step)(stmt) == SQLITE_ROW {
            list.push(EnglishVocabItem {
                word: db.col_str(stmt, 0),
                phonetic: db.col_str(stmt, 1),
                part_of_speech: db.col_str(stmt, 2),
                meaning_vi: db.col_str(stmt, 3),
                definition_en: db.col_str(stmt, 4),
                example_en: db.col_str(stmt, 5),
                example_vi: db.col_str(stmt, 6),
                audio_url: db.col_str(stmt, 7),
                topic: db.col_str(stmt, 8),
                synonyms: Vec::new(),
            });
        }
        (db.api.finalize)(stmt);
    }
    Ok(list)
}

#[tauri::command]
pub fn vocab_save_word(
    state: tauri::State<'_, MemoryState>,
    item: EnglishVocabItem,
) -> Result<Vec<EnglishVocabItem>, String> {
    let word_clean = item.word.trim().to_lowercase();
    if word_clean.is_empty() {
        return Err("Từ vựng không được để trống".to_string());
    }
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare(
        "INSERT INTO english_vocab_log (word, phonetic, part_of_speech, meaning_vi, definition_en, example_en, example_vi, audio_url, topic, learned_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT(word) DO UPDATE SET
           phonetic = excluded.phonetic,
           part_of_speech = excluded.part_of_speech,
           meaning_vi = excluded.meaning_vi,
           definition_en = excluded.definition_en,
           example_en = excluded.example_en,
           example_vi = excluded.example_vi,
           audio_url = excluded.audio_url,
           topic = excluded.topic,
           learned_at = excluded.learned_at",
    )?;
    db.bind_str(stmt, 1, &word_clean);
    db.bind_str(stmt, 2, &item.phonetic);
    db.bind_str(stmt, 3, &item.part_of_speech);
    db.bind_str(stmt, 4, &item.meaning_vi);
    db.bind_str(stmt, 5, &item.definition_en);
    db.bind_str(stmt, 6, &item.example_en);
    db.bind_str(stmt, 7, &item.example_vi);
    db.bind_str(stmt, 8, &item.audio_url);
    db.bind_str(stmt, 9, &item.topic);
    unsafe {
        (db.api.bind_int64)(stmt, 10, now_unix());
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    read_vocab_list(db, 100)
}

#[tauri::command]
pub fn vocab_list_words(
    state: tauri::State<'_, MemoryState>,
    limit: Option<usize>,
) -> Result<Vec<EnglishVocabItem>, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let lim = limit.unwrap_or(100) as i64;
    read_vocab_list(db, lim)
}

#[tauri::command]
pub fn vocab_delete_word(
    state: tauri::State<'_, MemoryState>,
    word: String,
) -> Result<Vec<EnglishVocabItem>, String> {
    let clean = word.trim().to_lowercase();
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare("DELETE FROM english_vocab_log WHERE word = ?1")?;
    db.bind_str(stmt, 1, &clean);
    unsafe {
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    read_vocab_list(db, 100)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CustomSkillRecord {
    pub id: String,
    pub name: String,
    pub description: String,
    pub language: String,
    pub triggers_json: String,
    pub params_schema_json: String,
    pub code: String,
    pub test_args_json: String,
    pub expected_keywords_json: String,
    pub version: i64,
    pub verified: bool,
    pub code_hash: String,
    pub last_test_output: String,
    pub last_test_ms: i64,
    pub usage_count: i64,
    pub heal_count: i64,
    pub last_heal_note: String,
    pub enabled: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

fn read_custom_skills_query(
    db: &MemoryDb,
    sql: &str,
    id_bind: Option<&str>,
) -> Vec<CustomSkillRecord> {
    let mut out = Vec::new();
    let Ok(stmt) = db.prepare(sql) else {
        return out;
    };
    if let Some(id_val) = id_bind {
        db.bind_str(stmt, 1, id_val);
    }
    unsafe {
        while (db.api.step)(stmt) == SQLITE_ROW {
            out.push(CustomSkillRecord {
                id: db.col_str(stmt, 0),
                name: db.col_str(stmt, 1),
                description: db.col_str(stmt, 2),
                language: db.col_str(stmt, 3),
                triggers_json: db.col_str(stmt, 4),
                params_schema_json: db.col_str(stmt, 5),
                code: db.col_str(stmt, 6),
                test_args_json: db.col_str(stmt, 7),
                expected_keywords_json: db.col_str(stmt, 8),
                version: (db.api.column_int64)(stmt, 9),
                verified: (db.api.column_int64)(stmt, 10) != 0,
                code_hash: db.col_str(stmt, 11),
                last_test_output: db.col_str(stmt, 12),
                last_test_ms: (db.api.column_int64)(stmt, 13),
                usage_count: (db.api.column_int64)(stmt, 14),
                heal_count: (db.api.column_int64)(stmt, 15),
                last_heal_note: db.col_str(stmt, 16),
                enabled: (db.api.column_int64)(stmt, 17) != 0,
                created_at: (db.api.column_int64)(stmt, 18),
                updated_at: (db.api.column_int64)(stmt, 19),
            });
        }
        (db.api.finalize)(stmt);
    }
    out
}

pub(crate) fn db_list_custom_skills(state: &MemoryState) -> Vec<CustomSkillRecord> {
    let Ok(guard) = state.inner.lock() else {
        return Vec::new();
    };
    let Some(db) = guard.as_ref() else {
        return Vec::new();
    };
    read_custom_skills_query(
        db,
        "SELECT id, name, description, language, triggers_json, params_schema_json, code,
                test_args_json, expected_keywords_json, version, verified, code_hash,
                last_test_output, last_test_ms, usage_count, heal_count, last_heal_note,
                enabled, created_at, updated_at
         FROM custom_skills
         ORDER BY updated_at DESC",
        None,
    )
}

pub(crate) fn db_get_custom_skill(state: &MemoryState, id: &str) -> Option<CustomSkillRecord> {
    let Ok(guard) = state.inner.lock() else {
        return None;
    };
    let Some(db) = guard.as_ref() else {
        return None;
    };
    read_custom_skills_query(
        db,
        "SELECT id, name, description, language, triggers_json, params_schema_json, code,
                test_args_json, expected_keywords_json, version, verified, code_hash,
                last_test_output, last_test_ms, usage_count, heal_count, last_heal_note,
                enabled, created_at, updated_at
         FROM custom_skills
         WHERE id = ?1
         LIMIT 1",
        Some(id),
    )
    .into_iter()
    .next()
}

pub(crate) fn db_upsert_custom_skill(
    state: &MemoryState,
    rec: &CustomSkillRecord,
) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let now = now_unix();
    let created = if rec.created_at > 0 { rec.created_at } else { now };
    let clean_code = rec.code.replace('\0', "");
    let clean_out = rec.last_test_output.replace('\0', "");

    let stmt = db.prepare(
        "INSERT INTO custom_skills (
            id, name, description, language, triggers_json, params_schema_json, code,
            test_args_json, expected_keywords_json, version, verified, code_hash,
            last_test_output, last_test_ms, usage_count, heal_count, last_heal_note,
            enabled, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            description = excluded.description,
            language = excluded.language,
            triggers_json = excluded.triggers_json,
            params_schema_json = excluded.params_schema_json,
            code = excluded.code,
            test_args_json = excluded.test_args_json,
            expected_keywords_json = excluded.expected_keywords_json,
            version = excluded.version,
            verified = excluded.verified,
            code_hash = excluded.code_hash,
            last_test_output = excluded.last_test_output,
            last_test_ms = excluded.last_test_ms,
            usage_count = excluded.usage_count,
            heal_count = excluded.heal_count,
            last_heal_note = excluded.last_heal_note,
            enabled = excluded.enabled,
            updated_at = excluded.updated_at",
    )?;

    db.bind_str(stmt, 1, &rec.id);
    db.bind_str(stmt, 2, &rec.name);
    db.bind_str(stmt, 3, &rec.description);
    db.bind_str(stmt, 4, &rec.language);
    db.bind_str(stmt, 5, &rec.triggers_json);
    db.bind_str(stmt, 6, &rec.params_schema_json);
    db.bind_str(stmt, 7, &clean_code);
    db.bind_str(stmt, 8, &rec.test_args_json);
    db.bind_str(stmt, 9, &rec.expected_keywords_json);
    unsafe {
        (db.api.bind_int64)(stmt, 10, rec.version.max(1));
        (db.api.bind_int64)(stmt, 11, if rec.verified { 1 } else { 0 });
    }
    db.bind_str(stmt, 12, &rec.code_hash);
    db.bind_str(stmt, 13, &clean_out);
    unsafe {
        (db.api.bind_int64)(stmt, 14, rec.last_test_ms.max(0));
        (db.api.bind_int64)(stmt, 15, rec.usage_count.max(0));
        (db.api.bind_int64)(stmt, 16, rec.heal_count.max(0));
    }
    db.bind_str(stmt, 17, &rec.last_heal_note);
    unsafe {
        (db.api.bind_int64)(stmt, 18, if rec.enabled { 1 } else { 0 });
        (db.api.bind_int64)(stmt, 19, created);
        (db.api.bind_int64)(stmt, 20, now);
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(())
}

pub(crate) fn db_delete_custom_skill(state: &MemoryState, id: &str) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare("DELETE FROM custom_skills WHERE id = ?1")?;
    db.bind_str(stmt, 1, id);
    unsafe {
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(())
}

pub(crate) fn db_toggle_custom_skill(
    state: &MemoryState,
    id: &str,
    enabled: bool,
) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare("UPDATE custom_skills SET enabled = ?1, updated_at = ?2 WHERE id = ?3")?;
    unsafe {
        (db.api.bind_int64)(stmt, 1, if enabled { 1 } else { 0 });
        (db.api.bind_int64)(stmt, 2, now_unix());
    }
    db.bind_str(stmt, 3, id);
    unsafe {
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(())
}

pub(crate) fn db_increment_skill_usage(state: &MemoryState, id: &str) {
    let Ok(guard) = state.inner.lock() else {
        return;
    };
    let Some(db) = guard.as_ref() else {
        return;
    };
    if let Ok(stmt) = db.prepare(
        "UPDATE custom_skills SET usage_count = usage_count + 1, updated_at = ?1 WHERE id = ?2",
    ) {
        unsafe {
            (db.api.bind_int64)(stmt, 1, now_unix());
        }
        db.bind_str(stmt, 2, id);
        unsafe {
            (db.api.step)(stmt);
            (db.api.finalize)(stmt);
        }
    }
}

pub(crate) fn skills_storage_dir(state: &MemoryState) -> PathBuf {
    let db_path = PathBuf::from(&state.db_path);
    match db_path.parent() {
        Some(parent) => parent.join("skills"),
        None => PathBuf::from("data").join("skills"),
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TarotReadingRecord {
    pub id: i64,
    pub drawn_at_ms: i64,
    pub next_draw_at_ms: i64,
    pub card_name: String,
    pub card_name_vi: String,
    pub card_short: String,
    pub arcana_type: String,
    pub is_reversed: bool,
    pub fortune_code: String,
    pub fortune_label: String,
    pub luck_score: i32,
    pub can_chi_day: String,
    pub ngu_hanh: String,
    pub lucky_color: String,
    pub lucky_numbers: String,
    pub summary_vi: String,
    pub work_advice: String,
    pub wealth_advice: String,
    pub love_advice: String,
    pub remedy_advice: String,
    pub meaning_en: String,
    pub api_source: String,
    pub ai_deep_reading: String,
}

fn read_tarot_rows(db: &MemoryDb, limit: usize) -> Vec<TarotReadingRecord> {
    let mut out = Vec::new();
    let Ok(stmt) = db.prepare(
        "SELECT id, drawn_at_ms, next_draw_at_ms, card_name, card_name_vi, card_short,
                arcana_type, is_reversed, fortune_code, fortune_label, luck_score,
                can_chi_day, ngu_hanh, lucky_color, lucky_numbers, summary_vi,
                work_advice, wealth_advice, love_advice, remedy_advice, meaning_en,
                api_source, ai_deep_reading
         FROM tarot_readings
         ORDER BY drawn_at_ms DESC, id DESC
         LIMIT ?1",
    ) else {
        return out;
    };
    unsafe {
        (db.api.bind_int64)(stmt, 1, limit.max(1) as i64);
        while (db.api.step)(stmt) == SQLITE_ROW {
            out.push(TarotReadingRecord {
                id: (db.api.column_int64)(stmt, 0),
                drawn_at_ms: (db.api.column_int64)(stmt, 1),
                next_draw_at_ms: (db.api.column_int64)(stmt, 2),
                card_name: db.col_str(stmt, 3),
                card_name_vi: db.col_str(stmt, 4),
                card_short: db.col_str(stmt, 5),
                arcana_type: db.col_str(stmt, 6),
                is_reversed: (db.api.column_int64)(stmt, 7) != 0,
                fortune_code: db.col_str(stmt, 8),
                fortune_label: db.col_str(stmt, 9),
                luck_score: (db.api.column_int64)(stmt, 10) as i32,
                can_chi_day: db.col_str(stmt, 11),
                ngu_hanh: db.col_str(stmt, 12),
                lucky_color: db.col_str(stmt, 13),
                lucky_numbers: db.col_str(stmt, 14),
                summary_vi: db.col_str(stmt, 15),
                work_advice: db.col_str(stmt, 16),
                wealth_advice: db.col_str(stmt, 17),
                love_advice: db.col_str(stmt, 18),
                remedy_advice: db.col_str(stmt, 19),
                meaning_en: db.col_str(stmt, 20),
                api_source: db.col_str(stmt, 21),
                ai_deep_reading: db.col_str(stmt, 22),
            });
        }
        (db.api.finalize)(stmt);
    }
    out
}

pub(crate) fn db_get_latest_tarot(state: &MemoryState) -> Option<TarotReadingRecord> {
    let guard = state.inner.lock().ok()?;
    let db = guard.as_ref()?;
    read_tarot_rows(db, 1).into_iter().next()
}

pub(crate) fn db_list_tarot_history(state: &MemoryState, limit: usize) -> Vec<TarotReadingRecord> {
    let Ok(guard) = state.inner.lock() else {
        return Vec::new();
    };
    let Some(db) = guard.as_ref() else {
        return Vec::new();
    };
    read_tarot_rows(db, limit)
}

pub(crate) fn db_insert_tarot_reading(
    state: &MemoryState,
    rec: &TarotReadingRecord,
) -> Result<TarotReadingRecord, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare(
        "INSERT INTO tarot_readings (
            drawn_at_ms, next_draw_at_ms, card_name, card_name_vi, card_short,
            arcana_type, is_reversed, fortune_code, fortune_label, luck_score,
            can_chi_day, ngu_hanh, lucky_color, lucky_numbers, summary_vi,
            work_advice, wealth_advice, love_advice, remedy_advice, meaning_en,
            api_source, ai_deep_reading
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)",
    )?;
    unsafe {
        (db.api.bind_int64)(stmt, 1, rec.drawn_at_ms);
        (db.api.bind_int64)(stmt, 2, rec.next_draw_at_ms);
    }
    db.bind_str(stmt, 3, &rec.card_name);
    db.bind_str(stmt, 4, &rec.card_name_vi);
    db.bind_str(stmt, 5, &rec.card_short);
    db.bind_str(stmt, 6, &rec.arcana_type);
    unsafe {
        (db.api.bind_int64)(stmt, 7, if rec.is_reversed { 1 } else { 0 });
    }
    db.bind_str(stmt, 8, &rec.fortune_code);
    db.bind_str(stmt, 9, &rec.fortune_label);
    unsafe {
        (db.api.bind_int64)(stmt, 10, rec.luck_score as i64);
    }
    db.bind_str(stmt, 11, &rec.can_chi_day);
    db.bind_str(stmt, 12, &rec.ngu_hanh);
    db.bind_str(stmt, 13, &rec.lucky_color);
    db.bind_str(stmt, 14, &rec.lucky_numbers);
    db.bind_str(stmt, 15, &rec.summary_vi);
    db.bind_str(stmt, 16, &rec.work_advice);
    db.bind_str(stmt, 17, &rec.wealth_advice);
    db.bind_str(stmt, 18, &rec.love_advice);
    db.bind_str(stmt, 19, &rec.remedy_advice);
    db.bind_str(stmt, 20, &rec.meaning_en);
    db.bind_str(stmt, 21, &rec.api_source);
    db.bind_str(stmt, 22, &rec.ai_deep_reading);
    unsafe {
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }

    let mut row_id = rec.id;
    if let Ok(id_stmt) = db.prepare("SELECT last_insert_rowid()") {
        unsafe {
            if (db.api.step)(id_stmt) == SQLITE_ROW {
                row_id = (db.api.column_int64)(id_stmt, 0);
            }
            (db.api.finalize)(id_stmt);
        }
    }

    let mut saved = rec.clone();
    saved.id = row_id;
    Ok(saved)
}

pub(crate) fn db_update_tarot_ai_reading(
    state: &MemoryState,
    id: i64,
    ai_text: &str,
) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare("UPDATE tarot_readings SET ai_deep_reading = ?1 WHERE id = ?2")?;
    db.bind_str(stmt, 1, ai_text);
    unsafe {
        (db.api.bind_int64)(stmt, 2, id);
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(())
}
