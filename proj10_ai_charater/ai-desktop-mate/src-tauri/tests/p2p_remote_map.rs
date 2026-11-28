use ai_desktop_mate_lib::backend::p2p::{
    capture_desktop_frame_bmp_b64, is_extended_vk, P2pWirePacket,
};

#[test]
fn wire_packet_roundtrip_remote_frame_and_map() {
    let pkt = P2pWirePacket {
        kind: "remote_frame".to_string(),
        frame_b64: Some("Qk0=".to_string()),
        frame_w: Some(640),
        frame_h: Some(360),
        frame_seq: Some(42),
        wheel_delta: Some(-120),
        windows_json: Some("[{\"x\":0.1,\"y\":0.3,\"w\":0.4,\"h\":0.4,\"title\":\"Code\"}]".to_string()),
        ..Default::default()
    };
    let raw = serde_json::to_string(&pkt).expect("serialize wire packet");
    let parsed: P2pWirePacket = serde_json::from_str(&raw).expect("deserialize wire packet");
    assert_eq!(parsed.kind, "remote_frame");
    assert_eq!(parsed.frame_w, Some(640));
    assert_eq!(parsed.frame_h, Some(360));
    assert_eq!(parsed.frame_seq, Some(42));
    assert_eq!(parsed.wheel_delta, Some(-120));
    assert!(parsed.windows_json.unwrap().contains("Code"));
}

#[cfg(windows)]
#[test]
fn desktop_frame_capture_produces_valid_bmp_base64() {
    let (b64, w, h, cx, cy) = capture_desktop_frame_bmp_b64(480).expect("capture desktop frame");
    assert!(w >= 320 && w <= 480);
    assert!(h >= 180);
    // "BM" = 0x42, 0x4D -> first 2 base64 chars are always "Qk", 3rd char is one of '0'..'3'
    assert!(
        b64.starts_with("Qk0")
            || b64.starts_with("Qk1")
            || b64.starts_with("Qk2")
            || b64.starts_with("Qk3")
    );
    assert!((0.0..=1.0).contains(&cx));
    assert!((0.0..=1.0).contains(&cy));
    assert!(is_extended_vk(0x25));
    assert!(!is_extended_vk(0x41));
}
