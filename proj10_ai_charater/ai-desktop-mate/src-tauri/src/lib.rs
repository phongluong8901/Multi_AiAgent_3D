pub mod backend;
pub mod core;

use tauri::Manager;

use crate::backend::desktop_icons::{
    begin_desktop_icon_drag, end_desktop_icon_drag, list_desktop_icons, move_desktop_icon,
    place_desktop_icon,
};
use crate::backend::llm::{
    ask_gemini, ask_gemini_vision, ask_ollama, ask_ollama_stream, embed_ollama,
    list_ollama_models, save_gemini_api_key_env,
};
use crate::backend::memory::{
    clipboard_history_add, clipboard_history_clear, clipboard_history_list,
    get_avatar_studio_config, init_memory_state, long_memory_delete, long_memory_list,
    long_memory_toggle, long_memory_upsert, macro_delete, macro_list, macro_upsert,
    memory_clear_all, memory_clear_chat_history, memory_delete_profile,
    memory_get_daily_summary, memory_get_insights, memory_get_recent_chats, memory_log_activity,
    memory_record_feedback, memory_save_chat, memory_save_daily_summary, memory_save_embedding,
    memory_save_profile, memory_scan_browser_history, memory_search_similar,
    save_avatar_studio_config, schedule_note_add, schedule_note_clear_all, schedule_note_delete,
    schedule_note_list, schedule_note_mark_triggered, schedule_note_toggle_done,
    vocab_delete_word, vocab_list_words, vocab_save_word,
};
use crate::backend::notification::{
    clear_notification_history, get_notification_history, get_notification_settings,
    post_notification, save_notification_settings, scan_active_windows_apps, test_notification,
    NotificationState,
};
use crate::backend::p2p::{
    p2p_disconnect, p2p_emergency_release, p2p_get_status, p2p_open_firewall_port,
    p2p_regenerate_room, p2p_request_handshake, p2p_respond_handshake, p2p_scan_local_peers,
    p2p_send_packet, p2p_send_remote_command, p2p_start_sim_peer, P2pState,
};
use crate::backend::pc_control::{
    analyze_ingested_file, capture_and_encode_screenshot, check_git_status, control_media,
    deep_system_control, get_clipboard_text, hardware_action, inspect_dropped_file,
    lock_pc_screen, manage_ports, manage_processes, ocr_latest_screenshot, ocr_screen_region,
    open_latest_screenshot, open_local_file_or_search, open_web_or_app,
    save_sticky_note_to_desktop, set_clipboard_text, take_screenshot, translate_text_quick,
    trigger_app_hotkey,
};
use crate::backend::telemetry::{
    check_bitcoin, check_hardware, check_network, check_weather, fetch_live_news,
    fetch_real_english_lesson, fetch_vietnamese_tts_audio, get_app_process_metrics,
};
use crate::backend::window_control::{
    arrange_desktop_windows, get_desktop_state, get_open_windows, interact_window,
    nudge_cursor_pos, scan_window_frames, set_manual_interactive, update_character_hitbox,
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
            app.manage(init_memory_state(data_dir.clone()));
            let notif_state = NotificationState::new(app.handle().clone(), data_dir);
            app.manage(notif_state);
            let p2p_state = P2pState::new(app.handle().clone());
            app.manage(p2p_state);
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
            nudge_cursor_pos,
            interact_window,
            arrange_desktop_windows,
            scan_window_frames,
            list_desktop_icons,
            move_desktop_icon,
            place_desktop_icon,
            begin_desktop_icon_drag,
            end_desktop_icon_drag,
            check_hardware,
            get_app_process_metrics,
            check_network,
            check_weather,
            check_bitcoin,
            fetch_live_news,
            fetch_real_english_lesson,
            fetch_vietnamese_tts_audio,
            ask_ollama,
            ask_ollama_stream,
            list_ollama_models,
            ask_gemini,
            ask_gemini_vision,
            save_gemini_api_key_env,
            embed_ollama,
            open_web_or_app,
            open_local_file_or_search,
            control_media,
            take_screenshot,
            capture_and_encode_screenshot,
            get_clipboard_text,
            set_clipboard_text,
            manage_processes,
            save_sticky_note_to_desktop,
            deep_system_control,
            manage_ports,
            check_git_status,
            inspect_dropped_file,
            analyze_ingested_file,
            ocr_latest_screenshot,
            ocr_screen_region,
            open_latest_screenshot,
            translate_text_quick,
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
            memory_clear_all,
            memory_clear_chat_history,
            schedule_note_list,
            schedule_note_add,
            schedule_note_toggle_done,
            schedule_note_mark_triggered,
            schedule_note_delete,
            schedule_note_clear_all,
            clipboard_history_add,
            clipboard_history_list,
            clipboard_history_clear,
            macro_list,
            macro_upsert,
            macro_delete,
            vocab_save_word,
            vocab_list_words,
            vocab_delete_word,
            get_avatar_studio_config,
            save_avatar_studio_config,
            get_notification_settings,
            save_notification_settings,
            get_notification_history,
            clear_notification_history,
            post_notification,
            test_notification,
            scan_active_windows_apps,
            p2p_get_status,
            p2p_open_firewall_port,
            p2p_regenerate_room,
            p2p_scan_local_peers,
            p2p_request_handshake,
            p2p_respond_handshake,
            p2p_send_packet,
            p2p_send_remote_command,
            p2p_start_sim_peer,
            p2p_disconnect,
            p2p_emergency_release
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}