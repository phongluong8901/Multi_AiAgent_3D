use ai_desktop_mate_lib::backend::telemetry::{
    format_english_meaning_vi, is_valid_vi_translation, parse_google_clients5_vi,
    parse_google_translate_gtx_vi, parse_mymemory_vi,
};

#[test]
fn test_google_gtx_single_word_with_dict_glosses() {
    let sample = r#"[
        [["khả năng phục hồi","resilience",null,null,1]],
        [["danh từ",["sự đàn hồi","khả năng phục hồi","sức bật"],null,null]],
        "en"
    ]"#;
    let parsed = parse_google_translate_gtx_vi(sample, "resilience", true).expect("should parse");
    assert!(parsed.contains("khả năng phục hồi"));
    assert!(parsed.contains("sự đàn hồi"));
    assert!(parsed.contains("sức bật"));
}

#[test]
fn test_google_clients5_and_mymemory_parsers() {
    let c5_arr = r#"[["công nghệ trí tuệ nhân tạo","en"]]"#;
    assert_eq!(
        parse_google_clients5_vi(c5_arr, "artificial intelligence").as_deref(),
        Some("công nghệ trí tuệ nhân tạo")
    );

    let c5_str = r#"["khả năng thích ứng"]"#;
    assert_eq!(
        parse_google_clients5_vi(c5_str, "adaptability").as_deref(),
        Some("khả năng thích ứng")
    );

    let mm_ok = r#"{"responseData":{"translatedText":"Hiểu từ vựng giúp giao tiếp hiệu quả."},"responseStatus":200}"#;
    assert_eq!(
        parse_mymemory_vi(mm_ok, "Understanding vocabulary helps effective communication.").as_deref(),
        Some("Hiểu từ vựng giúp giao tiếp hiệu quả.")
    );

    let mm_warn = r#"{"responseData":{"translatedText":"MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY"},"responseStatus":429}"#;
    assert!(parse_mymemory_vi(mm_warn, "hello").is_none());
}

#[test]
fn test_translation_validation_rejects_english_echo() {
    assert!(!is_valid_vi_translation("resilience", "resilience"));
    assert!(!is_valid_vi_translation("Resilience", "resilience"));
    assert!(!is_valid_vi_translation("hello", ""));
    assert!(is_valid_vi_translation("resilience", "khả năng phục hồi"));
}

#[test]
fn test_format_english_meaning_vi_combines_without_echo() {
    assert_eq!(
        format_english_meaning_vi(
            "resilience",
            Some("sức bật".to_string()),
            Some("khả năng phục hồi nhanh".to_string())
        ),
        "sức bật - khả năng phục hồi nhanh"
    );
    assert_eq!(
        format_english_meaning_vi("resilience", Some("resilience".to_string()), None),
        ""
    );
}
