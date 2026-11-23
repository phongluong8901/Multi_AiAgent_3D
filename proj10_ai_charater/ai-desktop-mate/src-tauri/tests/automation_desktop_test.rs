use ai_desktop_mate_lib::backend::automation_desktop::{
    auto_uia_snapshot, decode_ws_server_frame, draw_som_box_on_bgra, encode_ws_client_text_frame,
    is_installer_or_uninstaller_name, parse_cdp_tabs_json, parse_hotkey_vkeys, uia_control_type_name,
};

#[test]
fn test_parse_hotkey_vkeys_combinations() {
    let (mods, main_k) = parse_hotkey_vkeys("ctrl+shift+s").expect("Should parse ctrl+shift+s");
    assert_eq!(mods, vec![0x11, 0x10]);
    assert_eq!(main_k, b'S' as u16);

    let (mods2, main2) = parse_hotkey_vkeys("alt+tab").expect("Should parse alt+tab");
    assert_eq!(mods2, vec![0x12]);
    assert_eq!(main2, 0x09);

    assert!(parse_hotkey_vkeys("invalid_key_xyz").is_err());
}

#[test]
fn test_ws_frame_encode_decode_and_cdp_tabs_parser() {
    let encoded = encode_ws_client_text_frame(r#"{"id":1,"method":"Runtime.evaluate"}"#);
    assert_eq!(encoded[0], 0x81);
    let (opcode, text, consumed) = decode_ws_server_frame(&encoded).expect("Should decode WS frame");
    assert_eq!(opcode, 1);
    assert_eq!(consumed, encoded.len());
    assert!(text.contains("Runtime.evaluate"));

    let raw_tabs = r#"[
        {"id":"TAB1","type":"page","title":"Google","url":"https://www.google.com","webSocketDebuggerUrl":"ws://127.0.0.1:9222/devtools/page/TAB1"},
        {"id":"BG1","type":"background_page","title":"Ext","url":"chrome-extension://x"}
    ]"#;
    let tabs = parse_cdp_tabs_json(raw_tabs).expect("Should parse page tabs");
    assert_eq!(tabs.len(), 1);
    assert_eq!(tabs[0].id, "TAB1");
    assert_eq!(tabs[0].title, "Google");
}

#[test]
fn test_draw_som_box_on_bgra_marks_pixels() {
    let mut buf = vec![0u8; 64 * 64 * 4];
    draw_som_box_on_bgra(&mut buf, 64, 64, 10, 10, 24, 20, 3);
    // Border pixel at (10, 10) or badge pixel should be non-zero
    let idx = (10 * 64 + 10) * 4;
    assert_eq!(buf[idx + 3], 255);
}

#[test]
fn test_uia_control_type_mapping_and_native_com_init() {
    assert_eq!(uia_control_type_name(50000), Some("Button"));
    assert_eq!(uia_control_type_name(50004), Some("Edit"));
    assert_eq!(uia_control_type_name(99999), None);
    assert!(is_installer_or_uninstaller_name("Uninstall Zalo"));
    assert!(!is_installer_or_uninstaller_name("Zalo"));

    let items = tauri::async_runtime::block_on(auto_uia_snapshot(Some(0), Some(10)))
        .expect("auto_uia_snapshot with hwnd=0 should return Ok");
    assert!(items.is_empty());
}
