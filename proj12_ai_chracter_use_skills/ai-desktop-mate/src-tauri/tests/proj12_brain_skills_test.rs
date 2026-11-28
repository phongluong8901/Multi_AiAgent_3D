use ai_desktop_mate_lib::backend::cognitive_memory::{
    compute_decay_score, extract_and_learn_sync, normalize_vi_ascii,
};
use ai_desktop_mate_lib::backend::llm_router::{
    dpapi_decrypt, dpapi_encrypt, mask_api_key, RouterState,
};
use ai_desktop_mate_lib::backend::memory::init_memory_state;
use ai_desktop_mate_lib::backend::skill_evolver_bridge::{
    evolver_get_skill_source, evolver_list_skills, workspace_read_image_data_url,
};
use ai_desktop_mate_lib::backend::skill_pack_adapter::{
    execute_single_pack_tool_sync, SkillPackState,
};

#[test]
fn test_dpapi_vault_and_9router_pool() {
    let raw_secret = "AIzaSy_Proj12_DPAPI_Secret_99887766_ViệtNam";
    let encrypted = dpapi_encrypt(raw_secret).expect("Windows DPAPI encrypt must succeed");
    assert!(encrypted.starts_with("dpapi:"));
    assert!(!encrypted.contains("AIzaSy"));

    let decrypted = dpapi_decrypt(&encrypted).expect("Windows DPAPI decrypt must succeed");
    assert_eq!(decrypted, raw_secret);
    assert_eq!(mask_api_key("AIzaSy1234567890ABCD"), "AIzaSy...ABCD");

    let tmp_dir = std::env::temp_dir().join("duck_proj12_router_test");
    let _ = std::fs::create_dir_all(&tmp_dir);
    let router = RouterState::new(Some(tmp_dir));
    let cands = router.select_candidates(None, Some("AIzaSyOverrideKey123456"));
    assert!(!cands.is_empty(), "Router must include override/env candidates");
}

#[test]
fn test_cognitive_memory_os_decay_conflict_and_habit_miner() {
    let tmp_dir = std::env::temp_dir().join(format!("duck_proj12_cog_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&tmp_dir);
    let _ = std::fs::create_dir_all(&tmp_dir);

    let mem = init_memory_state(Some(tmp_dir.clone()));
    {
        let guard = mem.inner.lock().unwrap();
        let db = guard.as_ref().expect("winsqlite3 DB must initialize");

        // Learn profile + location + stack with 0 API calls
        let learned1 = extract_and_learn_sync(
            db,
            "Mình tên là Phong, mình ở Hà Nội và mình dùng Rust, Python, FastAPI",
            "",
            "Chào Phong! Đã lưu thông tin.",
            &[],
        );
        assert!(learned1 >= 3, "Expected name + city + stack learned, got {learned1}");

        // Update city -> triggers Conflict Resolution archival in user_fact_history + Implicit Habit rule
        let learned2 = extract_and_learn_sync(
            db,
            "Mình đang ở Đà Nẵng nhé, vẽ bảng cho dễ nhìn",
            "Thống kê dung lượng ổ đĩa",
            "Đã tạo https://docs.google.com/spreadsheets/d/abc123/edit",
            &["google_workspace_web__execute".to_string()],
        );
        assert!(learned2 >= 2, "Expected conflict update + implicit table rule learned");
    }

    let now = 1_800_000_000;
    assert!(compute_decay_score(120, now, 4, now) > compute_decay_score(120, now - 20 * 86_400, 1, now));
    assert_eq!(normalize_vi_ascii("Tạo Google Sheet Báo Cáo"), "tao google sheet bao cao");
    let _ = std::fs::remove_dir_all(&tmp_dir);
}

#[test]
fn test_proj11_209_skills_adapter_bm25_and_live_execution() {
    let tmp_dir = std::env::temp_dir().join(format!("duck_proj12_packs_{}", std::process::id()));
    let _ = std::fs::create_dir_all(&tmp_dir);

    let pack_state = SkillPackState::new(Some(tmp_dir));

    // Execute a deterministic Python skill from proj12/skills/new_skills (calculator)
    let exec_res = execute_single_pack_tool_sync(
        &pack_state,
        "calculator__evaluate",
        r#"{"expression": "(125 * 4) + 50"}"#,
        Some("$mem_calc"),
    )
    .expect("Python skill execution wrapper should succeed");

    assert!(
        exec_res.ok,
        "Expected calculator__evaluate from proj12/skills to pass: {:?}",
        exec_res
    );
    assert_eq!(exec_res.mem_ref, "$mem_calc");
    assert!(exec_res.data_json.contains("550"));
}

#[test]
fn test_skill_evolver_bridge_and_image_data_url() {
    let list = evolver_list_skills().expect("Should list editable skills across proj12 packs");
    assert!(list.len() >= 100, "Expected >= 100 skill_*.py modules, got {}", list.len());

    let src = evolver_get_skill_source(
        "new_skills".to_string(),
        "skill_calculator".to_string(),
        None,
    )
    .expect("Should read skill_calculator source");
    assert!(src.skill_code.contains("class SafeCalculatorClient"));

    // Verify 1x1 PNG Base64 data URL reader for inline Workspace Chat & Lightbox
    let tmp_png = std::env::temp_dir().join(format!("duck_test_chart_{}.png", std::process::id()));
    let png_1x1: [u8; 67] = [
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44,
        0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F,
        0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00,
        0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ];
    std::fs::write(&tmp_png, png_1x1).unwrap();
    let durl = workspace_read_image_data_url(tmp_png.to_string_lossy().to_string())
        .expect("Should encode PNG into data URL");
    assert!(durl.starts_with("data:image/png;base64,"));
    let _ = std::fs::remove_file(&tmp_png);
}
