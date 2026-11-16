pub mod backend;
pub mod core;

use tauri::Manager;

use crate::backend::llm::{ask_gemini, ask_ollama, embed_ollama};
use crate::backend::memory::{
    init_memory_state, long_memory_delete, long_memory_list, long_memory_toggle,
    long_memory_upsert, memory_clear_all, memory_delete_profile, memory_get_daily_summary,
    memory_get_insights, memory_get_recent_chats, memory_log_activity, memory_record_feedback,
    memory_save_chat, memory_save_daily_summary, memory_save_embedding, memory_save_profile,
    memory_scan_browser_history, memory_search_similar,
};
use crate::backend::pc_control::{
    control_media, hardware_action, lock_pc_screen, ocr_latest_screenshot, open_latest_screenshot,
    open_web_or_app, take_screenshot, trigger_app_hotkey,
};
use crate::backend::telemetry::{check_bitcoin, check_hardware, check_network, check_weather};
use crate::backend::window_control::{
    get_desktop_state, get_open_windows, interact_window, scan_window_frames,
    set_manual_interactive, update_character_hitbox,
};
use crate::core::hitbox::{spawn_cursor_tracker, HitboxState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let hitbox = HitboxState::new();
    let hitbox_thread = hitbox.clone();

    tauri::Builder::default()
        .manage(hitbox)
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            let data_dir = app.path().app_data_dir().ok();
            app.manage(init_memory_state(data_dir));
            if let Some(window) = app.get_webview_window("main") {
                spawn_cursor_tracker(window, hitbox_thread);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            update_character_hitbox,
            set_manual_interactive,
            get_open_windows,
            get_desktop_state,
            interact_window,
            scan_window_frames,
            check_hardware,
            check_network,
            check_weather,
            check_bitcoin,
            ask_ollama,
            ask_gemini,
            embed_ollama,
            open_web_or_app,
            control_media,
            take_screenshot,
            ocr_latest_screenshot,
            open_latest_screenshot,
            hardware_action,
            trigger_app_hotkey,
            lock_pc_screen,
            memory_save_profile,
            memory_delete_profile,
            memory_save_chat,
            memory_get_recent_chats,
            memory_log_activity,
            memory_record_feedback,
            memory_get_insights,
            memory_save_embedding,
            memory_search_similar,
            memory_save_daily_summary,
            memory_get_daily_summary,
            memory_scan_browser_history,
            long_memory_list,
            long_memory_upsert,
            long_memory_toggle,
            long_memory_delete,
            memory_clear_all
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
