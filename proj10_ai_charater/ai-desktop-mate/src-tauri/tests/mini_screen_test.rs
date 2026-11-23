use ai_desktop_mate_lib::backend::mini_screen::{
    build_bgr24_bmp, encode_base64, normalize_mini_screen_url, sanitize_batch_hwnds,
    MiniScreenState,
};

#[test]
fn test_base64_and_bmp_encoding() {
    assert_eq!(encode_base64(b"Duck"), "RHVjaw==");
    assert_eq!(encode_base64(b"A"), "QQ==");

    let w = 4u32;
    let h = 2u32;
    // row stride for 4px 24bpp = 12 bytes, 2 rows = 24 bytes
    let raw = vec![0x44u8; 24];
    let bmp = build_bgr24_bmp(w, h, &raw);
    assert_eq!(&bmp[0..2], b"BM");
    assert_eq!(bmp.len(), 54 + 24);
    assert_eq!(i32::from_le_bytes(bmp[18..22].try_into().unwrap()), 4);
    assert_eq!(i32::from_le_bytes(bmp[22..26].try_into().unwrap()), 2);
    assert_eq!(u16::from_le_bytes(bmp[28..30].try_into().unwrap()), 24);
}

#[test]
fn test_normalize_mini_screen_url() {
    let (yt_url, yt_title) = normalize_mini_screen_url("youtube").unwrap();
    assert_eq!(yt_url, "https://www.youtube.com/");
    assert!(yt_title.contains("YouTube"));

    let (short_url, _) = normalize_mini_screen_url("youtu.be/dQw4w9WgXcQ").unwrap();
    assert_eq!(short_url, "https://youtu.be/dQw4w9WgXcQ");

    let (search_url, _) = normalize_mini_screen_url("lofi chill study").unwrap();
    assert_eq!(
        search_url,
        "https://www.youtube.com/results?search_query=lofi+chill+study"
    );

    assert!(normalize_mini_screen_url("javascript:alert(1)").is_err());
    assert!(normalize_mini_screen_url("file:///C:/Windows").is_err());
}

#[test]
fn test_stealth_state_empty_restore_safe() {
    let st = MiniScreenState::new();
    assert!(!st.is_stealth(12345));
    assert_eq!(st.restore_all(), 0);
}

#[test]
fn test_sanitize_batch_hwnds_dedups_and_caps_at_four() {
    assert_eq!(
        sanitize_batch_hwnds(&[0, 10, 20, 10, 30, 40, 50, 0]),
        vec![10, 20, 30, 40]
    );
    assert!(sanitize_batch_hwnds(&[0, 0]).is_empty());
}
