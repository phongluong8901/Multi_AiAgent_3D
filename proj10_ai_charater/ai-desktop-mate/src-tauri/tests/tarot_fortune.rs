use ai_desktop_mate_lib::backend::tarot::{
    classify_fortune, compute_tu_vi_for_unix_secs, translate_tarot_card_vi, TAROT_COOLDOWN_MS,
};

#[test]
fn test_can_chi_and_ngu_hanh_computation() {
    assert_eq!(TAROT_COOLDOWN_MS, 6 * 3600 * 1000);
    // 2026-11-19 10:00:00 UTC -> 17:00 VN
    let info = compute_tu_vi_for_unix_secs(1795082400);
    assert!(info.can_chi_day.starts_with("Ngày "));
    assert!(!info.ngu_hanh.is_empty());
    assert!(!info.lucky_color.is_empty());
    assert!(!info.gio_hoang_dao.is_empty());
}

#[test]
fn test_five_tier_fortune_classification() {
    let (code_dc, lbl_dc, s_dc) = classify_fortune(2, false, 8);
    assert_eq!(code_dc, "dai_cat");
    assert_eq!(lbl_dc, "ĐẠI CÁT");
    assert!(s_dc >= 82 && s_dc <= 98);

    let (code_tc, lbl_tc, s_tc) = classify_fortune(1, false, 8);
    assert_eq!(code_tc, "tieu_cat");
    assert_eq!(lbl_tc, "TIỂU CÁT");
    assert!((64..=81).contains(&s_tc));

    let (code_bh, lbl_bh, s_bh) = classify_fortune(0, false, 8);
    assert_eq!(code_bh, "binh_hoa");
    assert_eq!(lbl_bh, "BÌNH HÒA");
    assert!((44..=63).contains(&s_bh));

    let (code_th, lbl_th, s_th) = classify_fortune(-2, false, 8);
    assert_eq!(code_th, "tieu_hung");
    assert_eq!(lbl_th, "TIỂU HUNG");
    assert!((26..=43).contains(&s_th));

    let (code_dh, lbl_dh, s_dh) = classify_fortune(-2, true, 0);
    assert_eq!(code_dh, "dai_hung");
    assert_eq!(lbl_dh, "ĐẠI HUNG");
    assert!(s_dh >= 12 && s_dh <= 25);
}

#[test]
fn test_card_vi_translation_major_and_minor() {
    let sun = translate_tarot_card_vi("ar19", "The Sun", "major");
    assert_eq!(sun.name_vi, "Mặt Trời Rực Rỡ");
    assert_eq!(sun.polarity, 2);

    let ace_pents = translate_tarot_card_vi("peac", "Ace of Pentacles", "minor");
    assert_eq!(ace_pents.name_vi, "Át Tiền (Đất)");
    assert_eq!(ace_pents.polarity, 2);
}
