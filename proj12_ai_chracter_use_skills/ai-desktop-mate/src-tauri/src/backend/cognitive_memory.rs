use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use tauri::State;

use crate::backend::memory::{now_unix, MemoryDb, MemoryState, SQLITE_ROW};

const CORE_PROFILE_KEYS: &[&str] = &["user_name", "user_role", "default_city", "work_tech_stack"];

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CognitiveFact {
    pub key: String,
    pub value: String,
    pub category: String,
    pub importance: i64,
    pub access_count: i64,
    pub effective_score: f64,
    pub last_accessed_at: i64,
    pub updated_at: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FactConflictRecord {
    pub id: i64,
    pub key: String,
    pub old_value: String,
    pub new_value: String,
    pub valid_from: i64,
    pub valid_to: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CognitiveRule {
    pub id: i64,
    pub rule_key: String,
    pub rule_text: String,
    pub source: String,
    pub active: bool,
    pub hit_count: i64,
    pub updated_at: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ToolAntiPattern {
    pub tool_name: String,
    pub error_sig: String,
    pub lesson: String,
    pub occurrences: i64,
    pub updated_at: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ToolPlaybook {
    pub playbook_id: String,
    pub trigger_keywords: String,
    pub tools_csv: String,
    pub strategy_hint: String,
    pub success_count: i64,
    pub updated_at: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RecentEntity {
    pub entity_key: String,
    pub entity_type: String,
    pub label: String,
    pub uri_or_path: String,
    pub updated_at: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SleepConsolidationResult {
    pub consolidated_events: usize,
    pub pruned_old_logs: usize,
    pub active_facts: usize,
    pub active_rules: usize,
    pub playbooks_count: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CognitiveContextBundle {
    pub prompt_block: String,
    pub matched_facts: Vec<CognitiveFact>,
    pub active_rules: Vec<CognitiveRule>,
    pub matched_playbooks: Vec<ToolPlaybook>,
    pub recent_entities: Vec<RecentEntity>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct CognitiveSyncBundle {
    pub facts: Vec<CognitiveFact>,
    pub rules: Vec<CognitiveRule>,
    pub playbooks: Vec<ToolPlaybook>,
    pub exported_at_ms: i64,
}

pub fn normalize_vi_ascii(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for ch in raw.chars() {
        let mapped = match ch {
            'à' | 'á' | 'ạ' | 'ả' | 'ã' | 'â' | 'ầ' | 'ấ' | 'ậ' | 'ẩ' | 'ẫ' | 'ă' | 'ằ' | 'ắ'
            | 'ặ' | 'ẳ' | 'ẵ' | 'À' | 'Á' | 'Ạ' | 'Ả' | 'Ã' | 'Â' | 'Ầ' | 'Ấ' | 'Ậ' | 'Ẩ'
            | 'Ẫ' | 'Ă' | 'Ằ' | 'Ắ' | 'Ặ' | 'Ẳ' | 'Ẵ' => 'a',
            'è' | 'é' | 'ẹ' | 'ẻ' | 'ẽ' | 'ê' | 'ề' | 'ế' | 'ệ' | 'ể' | 'ễ' | 'È' | 'É' | 'Ẹ'
            | 'Ẻ' | 'Ẽ' | 'Ê' | 'Ề' | 'Ế' | 'Ệ' | 'Ể' | 'Ễ' => 'e',
            'ì' | 'í' | 'ị' | 'ỉ' | 'ĩ' | 'Ì' | 'Í' | 'Ị' | 'Ỉ' | 'Ĩ' => 'i',
            'ò' | 'ó' | 'ọ' | 'ỏ' | 'õ' | 'ô' | 'ồ' | 'ố' | 'ộ' | 'ổ' | 'ỗ' | 'ơ' | 'ờ' | 'ớ'
            | 'ợ' | 'ở' | 'ỡ' | 'Ò' | 'Ó' | 'Ọ' | 'Ỏ' | 'Õ' | 'Ô' | 'Ồ' | 'Ố' | 'Ộ' | 'Ổ'
            | 'Ỗ' | 'Ơ' | 'Ờ' | 'Ớ' | 'Ợ' | 'Ở' | 'Ỡ' => 'o',
            'ù' | 'ú' | 'ụ' | 'ủ' | 'ũ' | 'ư' | 'ừ' | 'ứ' | 'ự' | 'ử' | 'ữ' | 'Ù' | 'Ú' | 'Ụ'
            | 'Ủ' | 'Ũ' | 'Ư' | 'Ừ' | 'Ứ' | 'Ự' | 'Ử' | 'Ữ' => 'u',
            'ỳ' | 'ý' | 'ỵ' | 'ỷ' | 'ỹ' | 'Ỳ' | 'Ý' | 'Ỵ' | 'Ỷ' | 'Ỹ' => 'y',
            'đ' | 'Đ' => 'd',
            c => c.to_ascii_lowercase(),
        };
        out.push(mapped);
    }
    out
}

pub fn tokenize_vi_set(raw: &str) -> HashSet<String> {
    let norm = normalize_vi_ascii(raw);
    let stop: HashSet<&str> = [
        "la", "va", "cua", "cho", "voi", "cac", "nhung", "mot", "nay", "kia", "thi", "co",
        "khong", "duoc", "nhu", "the", "nao", "xem", "di", "nhe", "nha", "toi", "minh", "ban",
    ]
    .into_iter()
    .collect();

    norm.split(|c: char| !c.is_ascii_alphanumeric() && c != '_')
        .filter(|w| w.len() >= 2 && !stop.contains(w))
        .map(|w| w.to_string())
        .collect()
}

pub fn compute_decay_score(importance: i64, last_accessed_at: i64, access_count: i64, now: i64) -> f64 {
    let days = ((now - last_accessed_at).max(0) as f64) / 86_400.0;
    let imp = ((importance.max(10)) as f64) / 100.0;
    let cnt = (access_count.max(0) as f64) + 1.0;
    let score = imp * (-0.03 * days).exp() + 0.15 * cnt.ln();
    (score * 10000.0).round() / 10000.0
}

fn normalize_error_sig(err: &str) -> String {
    let first = err.lines().next().unwrap_or("").trim();
    let mut compact = String::with_capacity(first.len().min(140));
    let mut prev_space = false;
    for ch in first.chars() {
        if ch.is_whitespace() {
            if !prev_space {
                compact.push(' ');
                prev_space = true;
            }
        } else {
            compact.push(ch);
            prev_space = false;
        }
        if compact.len() >= 140 {
            break;
        }
    }
    if compact.is_empty() {
        "unknown_error".to_string()
    } else {
        compact
    }
}

pub(crate) fn upsert_fact_db(
    db: &MemoryDb,
    key: &str,
    value: &str,
    category: &str,
    importance: i64,
) -> Result<(), String> {
    let clean_key = key.trim();
    let clean_val = value.trim();
    if clean_key.is_empty() || clean_val.is_empty() {
        return Ok(());
    }
    let now = now_unix();

    // Check existing value for Conflict Resolution archival
    if let Ok(sel) = db.prepare("SELECT value, updated_at FROM cognitive_facts WHERE key = ?1 LIMIT 1") {
        db.bind_str(sel, 1, clean_key);
        let mut old_pair: Option<(String, i64)> = None;
        unsafe {
            if (db.api.step)(sel) == SQLITE_ROW {
                old_pair = Some((db.col_str(sel, 0), (db.api.column_int64)(sel, 1)));
            }
            (db.api.finalize)(sel);
        }
        if let Some((old_val, old_ts)) = old_pair {
            if old_val != clean_val {
                if let Ok(hist) = db.prepare(
                    "INSERT INTO user_fact_history (key, old_value, new_value, valid_from, valid_to)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                ) {
                    db.bind_str(hist, 1, clean_key);
                    db.bind_str(hist, 2, &old_val);
                    db.bind_str(hist, 3, clean_val);
                    unsafe {
                        (db.api.bind_int64)(hist, 4, old_ts);
                        (db.api.bind_int64)(hist, 5, now);
                        (db.api.step)(hist);
                        (db.api.finalize)(hist);
                    }
                }
            }
        }
    }

    let stmt = db.prepare(
        "INSERT INTO cognitive_facts (key, value, category, importance, access_count, last_accessed_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 1, ?5, ?5)
         ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            category = excluded.category,
            importance = MAX(cognitive_facts.importance, excluded.importance),
            access_count = cognitive_facts.access_count + 1,
            last_accessed_at = excluded.last_accessed_at,
            updated_at = excluded.updated_at",
    )?;
    db.bind_str(stmt, 1, clean_key);
    db.bind_str(stmt, 2, clean_val);
    db.bind_str(stmt, 3, if category.trim().is_empty() { "general" } else { category.trim() });
    unsafe {
        (db.api.bind_int64)(stmt, 4, importance.clamp(10, 300));
        (db.api.bind_int64)(stmt, 5, now);
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(())
}

pub(crate) fn upsert_rule_db(
    db: &MemoryDb,
    rule_key: &str,
    rule_text: &str,
    source: &str,
) -> Result<(), String> {
    let rk = rule_key.trim();
    let rt = rule_text.trim();
    if rk.is_empty() || rt.is_empty() {
        return Ok(());
    }
    let now = now_unix();
    let stmt = db.prepare(
        "INSERT INTO cognitive_rules (rule_key, rule_text, source, active, hit_count, updated_at)
         VALUES (?1, ?2, ?3, 1, 1, ?4)
         ON CONFLICT(rule_key) DO UPDATE SET
            rule_text = excluded.rule_text,
            hit_count = cognitive_rules.hit_count + 1,
            updated_at = excluded.updated_at",
    )?;
    db.bind_str(stmt, 1, rk);
    db.bind_str(stmt, 2, rt);
    db.bind_str(stmt, 3, if source.trim().is_empty() { "learned" } else { source.trim() });
    unsafe {
        (db.api.bind_int64)(stmt, 4, now);
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(())
}

fn upsert_entity_db(
    db: &MemoryDb,
    entity_key: &str,
    entity_type: &str,
    label: &str,
    uri_or_path: &str,
) {
    let now = now_unix();
    if let Ok(stmt) = db.prepare(
        "INSERT INTO recent_entities (entity_key, entity_type, label, uri_or_path, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(entity_key) DO UPDATE SET
            label = excluded.label,
            uri_or_path = excluded.uri_or_path,
            updated_at = excluded.updated_at",
    ) {
        db.bind_str(stmt, 1, entity_key);
        db.bind_str(stmt, 2, entity_type);
        db.bind_str(stmt, 3, label);
        db.bind_str(stmt, 4, uri_or_path);
        unsafe {
            (db.api.bind_int64)(stmt, 5, now);
            (db.api.step)(stmt);
            (db.api.finalize)(stmt);
        }
    }
}

fn read_all_facts(db: &MemoryDb) -> Vec<CognitiveFact> {
    let now = now_unix();
    let mut out = Vec::new();
    let Ok(stmt) = db.prepare(
        "SELECT key, value, category, importance, access_count, last_accessed_at, updated_at
         FROM cognitive_facts ORDER BY updated_at DESC LIMIT 200",
    ) else {
        return out;
    };
    unsafe {
        while (db.api.step)(stmt) == SQLITE_ROW {
            let imp = (db.api.column_int64)(stmt, 3);
            let cnt = (db.api.column_int64)(stmt, 4);
            let last_acc = (db.api.column_int64)(stmt, 5);
            out.push(CognitiveFact {
                key: db.col_str(stmt, 0),
                value: db.col_str(stmt, 1),
                category: db.col_str(stmt, 2),
                importance: imp,
                access_count: cnt,
                effective_score: compute_decay_score(imp, last_acc, cnt, now),
                last_accessed_at: last_acc,
                updated_at: (db.api.column_int64)(stmt, 6),
            });
        }
        (db.api.finalize)(stmt);
    }
    out
}

fn read_all_rules(db: &MemoryDb, only_active: bool) -> Vec<CognitiveRule> {
    let mut out = Vec::new();
    let sql = if only_active {
        "SELECT id, rule_key, rule_text, source, active, hit_count, updated_at
         FROM cognitive_rules WHERE active = 1 ORDER BY hit_count DESC, updated_at DESC LIMIT 40"
    } else {
        "SELECT id, rule_key, rule_text, source, active, hit_count, updated_at
         FROM cognitive_rules ORDER BY updated_at DESC LIMIT 80"
    };
    let Ok(stmt) = db.prepare(sql) else {
        return out;
    };
    unsafe {
        while (db.api.step)(stmt) == SQLITE_ROW {
            out.push(CognitiveRule {
                id: (db.api.column_int64)(stmt, 0),
                rule_key: db.col_str(stmt, 1),
                rule_text: db.col_str(stmt, 2),
                source: db.col_str(stmt, 3),
                active: (db.api.column_int64)(stmt, 4) != 0,
                hit_count: (db.api.column_int64)(stmt, 5),
                updated_at: (db.api.column_int64)(stmt, 6),
            });
        }
        (db.api.finalize)(stmt);
    }
    out
}

pub(crate) fn read_antipatterns_for_tools(db: &MemoryDb, tool_names: &[String]) -> Vec<ToolAntiPattern> {
    if tool_names.is_empty() {
        return Vec::new();
    }
    let wanted: HashSet<String> = tool_names.iter().map(|t| t.to_ascii_lowercase()).collect();
    let mut out = Vec::new();
    let Ok(stmt) = db.prepare(
        "SELECT tool_name, error_sig, lesson, occurrences, updated_at
         FROM tool_antipatterns ORDER BY occurrences DESC, updated_at DESC LIMIT 80",
    ) else {
        return out;
    };
    unsafe {
        while (db.api.step)(stmt) == SQLITE_ROW {
            let tname = db.col_str(stmt, 0);
            if wanted.contains(&tname.to_ascii_lowercase()) {
                out.push(ToolAntiPattern {
                    tool_name: tname,
                    error_sig: db.col_str(stmt, 1),
                    lesson: db.col_str(stmt, 2),
                    occurrences: (db.api.column_int64)(stmt, 3),
                    updated_at: (db.api.column_int64)(stmt, 4),
                });
            }
        }
        (db.api.finalize)(stmt);
    }
    out
}

pub(crate) fn read_all_playbooks(db: &MemoryDb) -> Vec<ToolPlaybook> {
    let mut out = Vec::new();
    let Ok(stmt) = db.prepare(
        "SELECT playbook_id, trigger_keywords, tools_csv, strategy_hint, success_count, updated_at
         FROM tool_playbooks ORDER BY success_count DESC, updated_at DESC LIMIT 60",
    ) else {
        return out;
    };
    unsafe {
        while (db.api.step)(stmt) == SQLITE_ROW {
            out.push(ToolPlaybook {
                playbook_id: db.col_str(stmt, 0),
                trigger_keywords: db.col_str(stmt, 1),
                tools_csv: db.col_str(stmt, 2),
                strategy_hint: db.col_str(stmt, 3),
                success_count: (db.api.column_int64)(stmt, 4),
                updated_at: (db.api.column_int64)(stmt, 5),
            });
        }
        (db.api.finalize)(stmt);
    }
    out
}

fn read_recent_entities(db: &MemoryDb, limit: usize) -> Vec<RecentEntity> {
    let mut out = Vec::new();
    let Ok(stmt) = db.prepare(
        "SELECT entity_key, entity_type, label, uri_or_path, updated_at
         FROM recent_entities ORDER BY updated_at DESC LIMIT ?1",
    ) else {
        return out;
    };
    unsafe {
        (db.api.bind_int64)(stmt, 1, limit.max(1) as i64);
        while (db.api.step)(stmt) == SQLITE_ROW {
            out.push(RecentEntity {
                entity_key: db.col_str(stmt, 0),
                entity_type: db.col_str(stmt, 1),
                label: db.col_str(stmt, 2),
                uri_or_path: db.col_str(stmt, 3),
                updated_at: (db.api.column_int64)(stmt, 4),
            });
        }
        (db.api.finalize)(stmt);
    }
    out
}

/// Zero-API Deterministic Profile & Implicit Contrastive Habit Miner (ported from proj11)
pub fn extract_and_learn_sync(
    db: &MemoryDb,
    user_prompt: &str,
    prev_user_prompt: &str,
    assistant_reply: &str,
    executed_tools: &[String],
) -> usize {
    let raw = user_prompt.trim();
    if raw.len() < 4 {
        return 0;
    }
    let norm = normalize_vi_ascii(raw);
    let mut learned = 0usize;

    // 1. Name extraction
    for pat in ["toi ten la ", "minh ten la ", "goi toi la ", "goi minh la ", "my name is "] {
        if let Some(pos) = norm.find(pat) {
            let after = &raw.chars().collect::<Vec<_>>();
            let start_chars = norm[..pos + pat.len()].chars().count();
            if start_chars < after.len() {
                let candidate: String = after[start_chars..]
                    .iter()
                    .take_while(|c| !matches!(c, '.' | ',' | '!' | '?' | ';' | '\n'))
                    .collect();
                let clean = candidate.trim();
                if clean.len() >= 2 && clean.len() <= 32 {
                    if upsert_fact_db(db, "user_name", clean, "profile", 200).is_ok() {
                        learned += 1;
                    }
                }
            }
        }
    }

    // 2. City extraction
    let cities = [
        ("ha noi", "Hà Nội"),
        ("hanoi", "Hà Nội"),
        ("da nang", "Đà Nẵng"),
        ("danang", "Đà Nẵng"),
        ("ho chi minh", "TP. Hồ Chí Minh"),
        ("tphcm", "TP. Hồ Chí Minh"),
        ("sai gon", "TP. Hồ Chí Minh"),
        ("hai phong", "Hải Phòng"),
        ("can tho", "Cần Thơ"),
        ("hue", "Huế"),
        ("nha trang", "Nha Trang"),
        ("da lat", "Đà Lạt"),
    ];
    if ["toi o ", "minh o ", "song o ", "dang o ", "nha o "]
        .iter()
        .any(|p| norm.contains(p))
    {
        for (kw, label) in cities {
            if norm.contains(kw) {
                if upsert_fact_db(db, "default_city", label, "location", 180).is_ok() {
                    learned += 1;
                }
                break;
            }
        }
    }

    // 3. Tech stack / domain
    if ["toi lam ", "minh lam ", "toi dung ", "minh dung "]
        .iter()
        .any(|p| norm.contains(p))
    {
        let stacks = [
            "python", "rust", "typescript", "fastapi", "mlflow", "tauri", "react", "next.js",
            "golang", "docker", "ai agent",
        ];
        let matched: Vec<&str> = stacks.into_iter().filter(|s| norm.contains(s)).collect();
        if !matched.is_empty() {
            if upsert_fact_db(db, "work_tech_stack", &matched.join(", "), "work", 160).is_ok() {
                learned += 1;
            }
        }
    }

    // 4. Explicit behavioral rule ("lan sau nho ...", "tu gio hay ...", "luon luon ...")
    for pat in ["lan sau nho ", "lan sau hay ", "tu gio nho ", "tu gio hay ", "luon luon "] {
        if norm.contains(pat) && raw.len() <= 160 {
            let slug: String = norm
                .chars()
                .filter(|c| c.is_ascii_alphanumeric() || *c == ' ')
                .take(28)
                .map(|c| if c == ' ' { '_' } else { c })
                .collect();
            if upsert_rule_db(db, &format!("rule_{slug}"), raw, "explicit").is_ok() {
                learned += 1;
            }
            break;
        }
    }

    // 5. Implicit Contrastive Habit Miner (0 API cost)
    if !prev_user_prompt.trim().is_empty() && raw.len() <= 160 {
        let implicit_patterns: &[(&[&str], &str, &str)] = &[
            (
                &["ve bang", "dang bang", "tao bang", "bang cho de nhin"],
                "rule_prefer_markdown_table",
                "Ưu tiên trình bày dữ liệu thống kê/danh sách dưới dạng Bảng Markdown gọn gàng.",
            ),
            (
                &["ve bieu do", "ve do thi", "ve chart"],
                "rule_prefer_visual_chart",
                "Khi phân tích thống kê hoặc so sánh số liệu, chủ động đề xuất hoặc vẽ biểu đồ trực quan.",
            ),
            (
                &["ngan gon hon", "tom tat lai", "dai qua", "bot dai dong"],
                "rule_prefer_concise_reply",
                "Trả lời súc tích, gạch đầu dòng trọng tâm, tránh giải thích dài dòng.",
            ),
            (
                &["tren google sheet", "tao google sheet", "vao google sheet"],
                "rule_prefer_google_sheets",
                "Khi tạo bảng tính online, ưu tiên dùng google_workspace_web tạo trực tiếp Google Sheet.",
            ),
            (
                &["chay an", "khong bat cua so", "dung bat tab"],
                "rule_prefer_headless_browser",
                "Ưu tiên chạy trình duyệt CDP ở chế độ nền ẩn sau khi đã đăng nhập.",
            ),
        ];
        for (triggers, rkey, rtext) in implicit_patterns {
            if triggers.iter().any(|t| norm.contains(t)) {
                if upsert_rule_db(db, rkey, rtext, "implicit_habit").is_ok() {
                    learned += 1;
                }
            }
        }
    }

    // 6. Entity extraction from assistant reply (Google Sheets/Docs URLs & output files)
    for token in assistant_reply.split_whitespace() {
        let clean = token.trim_matches(|c: char| matches!(c, '(' | ')' | '[' | ']' | '"' | '\'' | ',' | '.'));
        if clean.starts_with("https://docs.google.com/spreadsheets/") {
            upsert_entity_db(db, "latest_google_sheet", "google_sheet", "Google Sheet gần nhất", clean);
        } else if clean.starts_with("https://docs.google.com/document/") {
            upsert_entity_db(db, "latest_google_doc", "google_doc", "Google Doc gần nhất", clean);
        } else if (clean.contains(":\\") || clean.starts_with("outputs/"))
            && (clean.ends_with(".xlsx")
                || clean.ends_with(".csv")
                || clean.ends_with(".png")
                || clean.ends_with(".pdf"))
        {
            upsert_entity_db(db, "latest_output_file", "file", "File kết quả gần nhất", clean);
        }
    }

    // 7. Episodic log entry for Sleep Consolidation
    let now = now_unix();
    if let Ok(ep_stmt) = db.prepare(
        "INSERT INTO episodic_logs (event_type, summary, tool_csv, consolidated, created_at)
         VALUES (?1, ?2, ?3, 0, ?4)",
    ) {
        let ev_type = if executed_tools.is_empty() { "chat_turn" } else { "tool_turn" };
        let summary = format!(
            "Q: {} | A: {}",
            raw.chars().take(90).collect::<String>(),
            assistant_reply.trim().chars().take(110).collect::<String>()
        );
        db.bind_str(ep_stmt, 1, ev_type);
        db.bind_str(ep_stmt, 2, &summary);
        db.bind_str(ep_stmt, 3, &executed_tools.join(","));
        unsafe {
            (db.api.bind_int64)(ep_stmt, 4, now);
            (db.api.step)(ep_stmt);
            (db.api.finalize)(ep_stmt);
        }
    }

    learned
}

#[tauri::command]
pub fn cog_build_context(
    state: State<'_, MemoryState>,
    query: String,
) -> Result<CognitiveContextBundle, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;

    let q_tokens = tokenize_vi_set(&query);
    let all_facts = read_all_facts(db);

    // Score facts: always keep CORE_PROFILE_KEYS + top semantic/lexical relevance * effective_score
    let mut scored_facts: Vec<(f64, CognitiveFact)> = all_facts
        .into_iter()
        .map(|f| {
            let is_core = CORE_PROFILE_KEYS.contains(&f.key.as_str());
            let f_tokens = tokenize_vi_set(&format!("{} {} {}", f.key, f.value, f.category));
            let overlap = if q_tokens.is_empty() || f_tokens.is_empty() {
                0.0
            } else {
                let inter = q_tokens.intersection(&f_tokens).count() as f64;
                inter / (q_tokens.len().min(5).max(1) as f64)
            };
            let priority = if is_core {
                100.0 + f.effective_score
            } else {
                f.effective_score * (1.0 + 3.0 * overlap)
            };
            (priority, f)
        })
        .filter(|(prio, f)| CORE_PROFILE_KEYS.contains(&f.key.as_str()) || *prio >= 0.45)
        .collect();

    scored_facts.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    let matched_facts: Vec<CognitiveFact> = scored_facts.into_iter().take(10).map(|(_, f)| f).collect();

    let active_rules = read_all_rules(db, true);
    let playbooks = read_all_playbooks(db);
    let matched_playbooks: Vec<ToolPlaybook> = playbooks
        .into_iter()
        .filter(|pb| {
            if q_tokens.is_empty() {
                return false;
            }
            let pb_toks = tokenize_vi_set(&format!("{} {}", pb.trigger_keywords, pb.strategy_hint));
            q_tokens.intersection(&pb_toks).count() >= 2
        })
        .take(3)
        .collect();

    let recent_entities = read_recent_entities(db, 5);

    let mut lines = Vec::new();
    if !matched_facts.is_empty() {
        let kv: Vec<String> = matched_facts
            .iter()
            .map(|f| format!("{}={}", f.key, f.value))
            .collect();
        lines.push(format!("[COGNITIVE FACTS] {}", kv.join(" | ")));
    }
    if !active_rules.is_empty() {
        let r_txt: Vec<String> = active_rules
            .iter()
            .take(6)
            .map(|r| r.rule_text.clone())
            .collect();
        lines.push(format!("[USER HABIT RULES] {}", r_txt.join(" ; ")));
    }
    if !matched_playbooks.is_empty() {
        let pb_txt: Vec<String> = matched_playbooks
            .iter()
            .map(|p| format!("{} -> [{}]", p.strategy_hint, p.tools_csv))
            .collect();
        lines.push(format!("[VERIFIED PLAYBOOKS] {}", pb_txt.join(" | ")));
    }
    if !recent_entities.is_empty() {
        let ent_txt: Vec<String> = recent_entities
            .iter()
            .take(3)
            .map(|e| format!("{}: {}", e.label, e.uri_or_path))
            .collect();
        lines.push(format!("[RECENT RESOURCES] {}", ent_txt.join(" | ")));
    }

    Ok(CognitiveContextBundle {
        prompt_block: lines.join("\n"),
        matched_facts,
        active_rules,
        matched_playbooks,
        recent_entities,
    })
}

#[tauri::command]
pub fn cog_learn_from_turn(
    state: State<'_, MemoryState>,
    user_prompt: String,
    prev_user_prompt: String,
    assistant_reply: String,
    executed_tools: Vec<String>,
) -> Result<usize, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    Ok(extract_and_learn_sync(
        db,
        &user_prompt,
        &prev_user_prompt,
        &assistant_reply,
        &executed_tools,
    ))
}

#[tauri::command]
pub fn cog_upsert_fact(
    state: State<'_, MemoryState>,
    key: String,
    value: String,
    category: Option<String>,
    importance: Option<i64>,
) -> Result<Vec<CognitiveFact>, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    upsert_fact_db(
        db,
        &key,
        &value,
        category.as_deref().unwrap_or("profile"),
        importance.unwrap_or(120),
    )?;
    Ok(read_all_facts(db))
}

#[tauri::command]
pub fn cog_delete_fact(state: State<'_, MemoryState>, key: String) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let stmt = db.prepare("DELETE FROM cognitive_facts WHERE key = ?1")?;
    db.bind_str(stmt, 1, key.trim());
    unsafe {
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(())
}

#[tauri::command]
pub fn cog_list_fact_conflicts(state: State<'_, MemoryState>) -> Result<Vec<FactConflictRecord>, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let mut out = Vec::new();
    let stmt = db.prepare(
        "SELECT id, key, old_value, new_value, valid_from, valid_to
         FROM user_fact_history ORDER BY valid_to DESC LIMIT 30",
    )?;
    unsafe {
        while (db.api.step)(stmt) == SQLITE_ROW {
            out.push(FactConflictRecord {
                id: (db.api.column_int64)(stmt, 0),
                key: db.col_str(stmt, 1),
                old_value: db.col_str(stmt, 2),
                new_value: db.col_str(stmt, 3),
                valid_from: (db.api.column_int64)(stmt, 4),
                valid_to: (db.api.column_int64)(stmt, 5),
            });
        }
        (db.api.finalize)(stmt);
    }
    Ok(out)
}

#[tauri::command]
pub fn cog_upsert_rule(
    state: State<'_, MemoryState>,
    rule_key: String,
    rule_text: String,
    source: Option<String>,
) -> Result<Vec<CognitiveRule>, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let clean_key = if rule_key.trim().is_empty() {
        format!("rule_manual_{}", now_unix() % 100_000)
    } else {
        rule_key.trim().to_string()
    };
    upsert_rule_db(db, &clean_key, &rule_text, source.as_deref().unwrap_or("manual"))?;
    Ok(read_all_rules(db, false))
}

#[tauri::command]
pub fn cog_record_tool_outcome(
    state: State<'_, MemoryState>,
    tool_name: String,
    ok: bool,
    error_text: Option<String>,
    user_query: Option<String>,
) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let now = now_unix();
    let clean_tool = tool_name.trim();
    if clean_tool.is_empty() {
        return Ok(());
    }

    if !ok {
        let raw_err = error_text.unwrap_or_default();
        let sig = normalize_error_sig(&raw_err);
        let lesson = format!(
            "Tránh lặp lại lỗi trên `{clean_tool}`: kiểm tra kỹ tham số JSON schema trước khi gọi ({sig})."
        );
        let stmt = db.prepare(
            "INSERT INTO tool_antipatterns (tool_name, error_sig, lesson, occurrences, updated_at)
             VALUES (?1, ?2, ?3, 1, ?4)
             ON CONFLICT(tool_name, error_sig) DO UPDATE SET
                occurrences = tool_antipatterns.occurrences + 1,
                updated_at = excluded.updated_at",
        )?;
        db.bind_str(stmt, 1, clean_tool);
        db.bind_str(stmt, 2, &sig);
        db.bind_str(stmt, 3, &lesson);
        unsafe {
            (db.api.bind_int64)(stmt, 4, now);
            (db.api.step)(stmt);
            (db.api.finalize)(stmt);
        }
    } else if let Some(q) = user_query.filter(|s| s.trim().len() >= 8) {
        let toks: Vec<String> = tokenize_vi_set(&q).into_iter().take(6).collect();
        if toks.len() >= 2 {
            let pb_id = format!("pb_{}", clean_tool.to_ascii_lowercase());
            let kw = toks.join(" ");
            let hint = format!("Tác vụ '{}' đã chạy thành công bằng `{}`", q.trim().chars().take(60).collect::<String>(), clean_tool);
            let stmt = db.prepare(
                "INSERT INTO tool_playbooks (playbook_id, trigger_keywords, tools_csv, strategy_hint, success_count, updated_at)
                 VALUES (?1, ?2, ?3, ?4, 1, ?5)
                 ON CONFLICT(playbook_id) DO UPDATE SET
                    trigger_keywords = excluded.trigger_keywords,
                    strategy_hint = excluded.strategy_hint,
                    success_count = tool_playbooks.success_count + 1,
                    updated_at = excluded.updated_at",
            )?;
            db.bind_str(stmt, 1, &pb_id);
            db.bind_str(stmt, 2, &kw);
            db.bind_str(stmt, 3, clean_tool);
            db.bind_str(stmt, 4, &hint);
            unsafe {
                (db.api.bind_int64)(stmt, 5, now);
                (db.api.step)(stmt);
                (db.api.finalize)(stmt);
            }
        }
    }
    Ok(())
}

/// Sleep Cycle Consolidator: synthesizes episodic logs into durable playbooks & prunes logs > 14 days
#[tauri::command]
pub fn cog_consolidate_sleep(state: State<'_, MemoryState>) -> Result<SleepConsolidationResult, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let now = now_unix();

    let mut unconsolidated: Vec<(i64, String, String)> = Vec::new();
    if let Ok(stmt) = db.prepare(
        "SELECT id, summary, tool_csv FROM episodic_logs WHERE consolidated = 0 ORDER BY id ASC LIMIT 100",
    ) {
        unsafe {
            while (db.api.step)(stmt) == SQLITE_ROW {
                unconsolidated.push((
                    (db.api.column_int64)(stmt, 0),
                    db.col_str(stmt, 1),
                    db.col_str(stmt, 2),
                ));
            }
            (db.api.finalize)(stmt);
        }
    }

    let consolidated_events = unconsolidated.len();
    for (row_id, summary, tool_csv) in unconsolidated {
        if !tool_csv.trim().is_empty() {
            let pb_id = format!("sleep_{}", tool_csv.replace(',', "_").chars().take(36).collect::<String>());
            let kws: Vec<String> = tokenize_vi_set(&summary).into_iter().take(6).collect();
            if !kws.is_empty() {
                if let Ok(pb_stmt) = db.prepare(
                    "INSERT INTO tool_playbooks (playbook_id, trigger_keywords, tools_csv, strategy_hint, success_count, updated_at)
                     VALUES (?1, ?2, ?3, ?4, 1, ?5)
                     ON CONFLICT(playbook_id) DO UPDATE SET
                        success_count = tool_playbooks.success_count + 1,
                        updated_at = excluded.updated_at",
                ) {
                    db.bind_str(pb_stmt, 1, &pb_id);
                    db.bind_str(pb_stmt, 2, &kws.join(" "));
                    db.bind_str(pb_stmt, 3, &tool_csv);
                    db.bind_str(pb_stmt, 4, &summary.chars().take(120).collect::<String>());
                    unsafe {
                        (db.api.bind_int64)(pb_stmt, 5, now);
                        (db.api.step)(pb_stmt);
                        (db.api.finalize)(pb_stmt);
                    }
                }
            }
        }
        if let Ok(upd) = db.prepare("UPDATE episodic_logs SET consolidated = 1 WHERE id = ?1") {
            unsafe {
                (db.api.bind_int64)(upd, 1, row_id);
                (db.api.step)(upd);
                (db.api.finalize)(upd);
            }
        }
    }

    // Prune episodic logs older than 14 days
    let cutoff = now - 14 * 86_400;
    let mut pruned_old_logs = 0usize;
    if let Ok(cnt_stmt) = db.prepare("SELECT COUNT(*) FROM episodic_logs WHERE created_at < ?1") {
        unsafe {
            (db.api.bind_int64)(cnt_stmt, 1, cutoff);
            if (db.api.step)(cnt_stmt) == SQLITE_ROW {
                pruned_old_logs = (db.api.column_int64)(cnt_stmt, 0).max(0) as usize;
            }
            (db.api.finalize)(cnt_stmt);
        }
    }
    if pruned_old_logs > 0 {
        if let Ok(del_stmt) = db.prepare("DELETE FROM episodic_logs WHERE created_at < ?1") {
            unsafe {
                (db.api.bind_int64)(del_stmt, 1, cutoff);
                (db.api.step)(del_stmt);
                (db.api.finalize)(del_stmt);
            }
        }
    }

    let facts = read_all_facts(db);
    let rules = read_all_rules(db, true);
    let playbooks = read_all_playbooks(db);

    Ok(SleepConsolidationResult {
        consolidated_events,
        pruned_old_logs,
        active_facts: facts.len(),
        active_rules: rules.len(),
        playbooks_count: playbooks.len(),
    })
}

pub(crate) fn export_sync_bundle_db(state: &MemoryState) -> Result<CognitiveSyncBundle, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    Ok(CognitiveSyncBundle {
        facts: read_all_facts(db),
        rules: read_all_rules(db, false),
        playbooks: read_all_playbooks(db),
        exported_at_ms: now_unix() * 1000,
    })
}

pub(crate) fn import_sync_bundle_db(
    state: &MemoryState,
    bundle: &CognitiveSyncBundle,
) -> Result<usize, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let mut merged = 0usize;
    for f in &bundle.facts {
        if upsert_fact_db(db, &f.key, &f.value, &f.category, f.importance).is_ok() {
            merged += 1;
        }
    }
    for r in &bundle.rules {
        if upsert_rule_db(db, &r.rule_key, &r.rule_text, &r.source).is_ok() {
            merged += 1;
        }
    }
    let now = now_unix();
    for pb in &bundle.playbooks {
        if let Ok(stmt) = db.prepare(
            "INSERT INTO tool_playbooks (playbook_id, trigger_keywords, tools_csv, strategy_hint, success_count, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(playbook_id) DO UPDATE SET
                trigger_keywords = excluded.trigger_keywords,
                tools_csv = excluded.tools_csv,
                strategy_hint = excluded.strategy_hint,
                success_count = MAX(tool_playbooks.success_count, excluded.success_count),
                updated_at = excluded.updated_at",
        ) {
            db.bind_str(stmt, 1, &pb.playbook_id);
            db.bind_str(stmt, 2, &pb.trigger_keywords);
            db.bind_str(stmt, 3, &pb.tools_csv);
            db.bind_str(stmt, 4, &pb.strategy_hint);
            unsafe {
                (db.api.bind_int64)(stmt, 5, pb.success_count.max(1));
                (db.api.bind_int64)(stmt, 6, now);
                (db.api.step)(stmt);
                (db.api.finalize)(stmt);
            }
            merged += 1;
        }
    }
    Ok(merged)
}

// ============================================================================
// Multi-Session Rich Workspace Chat Storage (SQLite)
// ============================================================================

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WsChatSessionSummary {
    pub session_id: String,
    pub title: String,
    pub message_count: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WsChatMessageRecord {
    pub id: i64,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub meta_json: String,
    pub created_at: i64,
}

fn list_ws_sessions_db(db: &MemoryDb) -> Vec<WsChatSessionSummary> {
    let mut out = Vec::new();
    let Ok(stmt) = db.prepare(
        "SELECT s.session_id, s.title,
                (SELECT COUNT(*) FROM ws_chat_messages m WHERE m.session_id = s.session_id) AS msg_cnt,
                s.created_at, s.updated_at
         FROM ws_chat_sessions s
         ORDER BY s.updated_at DESC LIMIT 60",
    ) else {
        return out;
    };
    unsafe {
        while (db.api.step)(stmt) == SQLITE_ROW {
            out.push(WsChatSessionSummary {
                session_id: db.col_str(stmt, 0),
                title: db.col_str(stmt, 1),
                message_count: (db.api.column_int64)(stmt, 2),
                created_at: (db.api.column_int64)(stmt, 3),
                updated_at: (db.api.column_int64)(stmt, 4),
            });
        }
        (db.api.finalize)(stmt);
    }
    out
}

#[tauri::command]
pub fn ws_session_list(state: State<'_, MemoryState>) -> Result<Vec<WsChatSessionSummary>, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let mut list = list_ws_sessions_db(db);
    if list.is_empty() {
        let now = now_unix();
        let def_id = format!("sess_{now}");
        if let Ok(stmt) = db.prepare(
            "INSERT INTO ws_chat_sessions (session_id, title, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?3)",
        ) {
            db.bind_str(stmt, 1, &def_id);
            db.bind_str(stmt, 2, "Phiên làm việc mới");
            unsafe {
                (db.api.bind_int64)(stmt, 3, now);
                (db.api.step)(stmt);
                (db.api.finalize)(stmt);
            }
        }
        list = list_ws_sessions_db(db);
    }
    Ok(list)
}

#[tauri::command]
pub fn ws_session_create(
    state: State<'_, MemoryState>,
    title: Option<String>,
) -> Result<WsChatSessionSummary, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let now = now_unix();
    let sid = format!("sess_{}_{}", now, (now % 9973));
    let clean_title = title
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .unwrap_or("Phiên mới")
        .to_string();

    let stmt = db.prepare(
        "INSERT INTO ws_chat_sessions (session_id, title, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?3)",
    )?;
    db.bind_str(stmt, 1, &sid);
    db.bind_str(stmt, 2, &clean_title);
    unsafe {
        (db.api.bind_int64)(stmt, 3, now);
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }
    Ok(WsChatSessionSummary {
        session_id: sid,
        title: clean_title,
        message_count: 0,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub fn ws_session_load(
    state: State<'_, MemoryState>,
    session_id: String,
) -> Result<Vec<WsChatMessageRecord>, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let mut out = Vec::new();
    let stmt = db.prepare(
        "SELECT id, session_id, role, content, meta_json, created_at
         FROM ws_chat_messages WHERE session_id = ?1 ORDER BY id ASC LIMIT 300",
    )?;
    db.bind_str(stmt, 1, session_id.trim());
    unsafe {
        while (db.api.step)(stmt) == SQLITE_ROW {
            out.push(WsChatMessageRecord {
                id: (db.api.column_int64)(stmt, 0),
                session_id: db.col_str(stmt, 1),
                role: db.col_str(stmt, 2),
                content: db.col_str(stmt, 3),
                meta_json: db.col_str(stmt, 4),
                created_at: (db.api.column_int64)(stmt, 5),
            });
        }
        (db.api.finalize)(stmt);
    }
    Ok(out)
}

#[tauri::command]
pub fn ws_session_append(
    state: State<'_, MemoryState>,
    session_id: String,
    role: String,
    content: String,
    meta_json: Option<String>,
) -> Result<(), String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let sid = session_id.trim();
    if sid.is_empty() || content.trim().is_empty() {
        return Ok(());
    }
    let now = now_unix();

    // Ensure session exists
    if let Ok(ins_s) = db.prepare(
        "INSERT OR IGNORE INTO ws_chat_sessions (session_id, title, created_at, updated_at)
         VALUES (?1, 'Phiên mới', ?2, ?2)",
    ) {
        db.bind_str(ins_s, 1, sid);
        unsafe {
            (db.api.bind_int64)(ins_s, 2, now);
            (db.api.step)(ins_s);
            (db.api.finalize)(ins_s);
        }
    }

    let stmt = db.prepare(
        "INSERT INTO ws_chat_messages (session_id, role, content, meta_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
    )?;
    db.bind_str(stmt, 1, sid);
    db.bind_str(stmt, 2, role.trim());
    db.bind_str(stmt, 3, content.trim());
    db.bind_str(stmt, 4, meta_json.as_deref().unwrap_or("{}"));
    unsafe {
        (db.api.bind_int64)(stmt, 5, now);
        (db.api.step)(stmt);
        (db.api.finalize)(stmt);
    }

    // Auto-title session from first user prompt
    if role.trim() == "user" {
        let short_title: String = content
            .trim()
            .lines()
            .next()
            .unwrap_or("Hội thoại")
            .chars()
            .take(40)
            .collect();
        if let Ok(upd) = db.prepare(
            "UPDATE ws_chat_sessions
             SET title = CASE WHEN title IN ('Phiên mới', 'Phiên làm việc mới') THEN ?1 ELSE title END,
                 updated_at = ?2
             WHERE session_id = ?3",
        ) {
            db.bind_str(upd, 1, &short_title);
            unsafe {
                (db.api.bind_int64)(upd, 2, now);
            }
            db.bind_str(upd, 3, sid);
            unsafe {
                (db.api.step)(upd);
                (db.api.finalize)(upd);
            }
        }
    } else if let Ok(upd) = db.prepare("UPDATE ws_chat_sessions SET updated_at = ?1 WHERE session_id = ?2") {
        unsafe {
            (db.api.bind_int64)(upd, 1, now);
        }
        db.bind_str(upd, 2, sid);
        unsafe {
            (db.api.step)(upd);
            (db.api.finalize)(upd);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn ws_session_delete(
    state: State<'_, MemoryState>,
    session_id: String,
) -> Result<Vec<WsChatSessionSummary>, String> {
    let guard = state.inner.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("SQLite chưa sẵn sàng")?;
    let sid = session_id.trim();
    for sql in [
        "DELETE FROM ws_chat_messages WHERE session_id = ?1",
        "DELETE FROM ws_chat_sessions WHERE session_id = ?1",
    ] {
        if let Ok(stmt) = db.prepare(sql) {
            db.bind_str(stmt, 1, sid);
            unsafe {
                (db.api.step)(stmt);
                (db.api.finalize)(stmt);
            }
        }
    }
    drop(guard);
    ws_session_list(state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_time_decay_and_vi_normalization() {
        let now = 1_800_000_000;
        let fresh = compute_decay_score(100, now, 3, now);
        let stale = compute_decay_score(100, now - 30 * 86_400, 1, now);
        assert!(fresh > stale, "Freshly accessed fact must outrank 30-day stale fact");

        let norm = normalize_vi_ascii("Đọc hộp thư Gmail rồi vẽ biểu đồ cột ở Đà Nẵng");
        assert_eq!(norm, "doc hop thu gmail roi ve bieu do cot o da nang");
    }
}
