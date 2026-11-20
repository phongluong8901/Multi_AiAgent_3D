use serde::{Deserialize, Serialize};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

use crate::backend::memory::{
    db_get_latest_tarot, db_insert_tarot_reading, db_list_tarot_history,
    db_update_tarot_ai_reading, MemoryState, TarotReadingRecord,
};
use crate::backend::telemetry::apply_no_window;

pub const TAROT_COOLDOWN_MS: i64 = 6 * 3600 * 1000;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TarotStatusResponse {
    pub can_draw: bool,
    pub remaining_ms: i64,
    pub cooldown_hours: u32,
    pub already_drawn_in_window: bool,
    pub current_reading: Option<TarotReadingRecord>,
    pub history: Vec<TarotReadingRecord>,
}

#[derive(Clone, Debug)]
pub struct TuViDayInfo {
    pub can_chi_day: String,
    pub ngu_hanh: String,
    pub lucky_color: String,
    pub gio_hoang_dao: String,
}

#[derive(Clone, Debug)]
pub struct CardViTranslation {
    pub name_en: String,
    pub name_vi: String,
    pub short_code: String,
    pub arcana_type: String,
    pub polarity: i32,
    pub base_up_vi: String,
    pub base_rev_vi: String,
}

struct MajorArcanaDef {
    short: &'static str,
    name_en: &'static str,
    name_vi: &'static str,
    polarity: i32,
    up_vi: &'static str,
    rev_vi: &'static str,
}

const MAJOR_ARCANA: &[MajorArcanaDef] = &[
    MajorArcanaDef {
        short: "ar00",
        name_en: "The Fool",
        name_vi: "Kẻ Khờ Mộng Mơ",
        polarity: 1,
        up_vi: "Khởi đầu mới đầy tự do, vận may bất ngờ khi dám bước ra khỏi vùng an toàn.",
        rev_vi: "Dễ vội vàng thiếu tính toán; cần kiểm tra kỹ hợp đồng và chi tiết trước khi quyết.",
    },
    MajorArcanaDef {
        short: "ar01",
        name_en: "The Magician",
        name_vi: "Pháp Sư Quyền Năng",
        polarity: 2,
        up_vi: "Năng lực sáng tạo và tài xoay xở đạt đỉnh cao, biến ý tưởng thành kết quả thực tế.",
        rev_vi: "Phân tâm hoặc gặp lời hứa suông; tránh ôm đồm quá nhiều việc cùng lúc.",
    },
    MajorArcanaDef {
        short: "ar02",
        name_en: "The High Priestess",
        name_vi: "Nữ Tư Tế Huyền Bí",
        polarity: 1,
        up_vi: "Trực giác sắc bén dẫn lối; giữ kín kế hoạch và quan sát thêm sẽ nhìn thấu chân tướng.",
        rev_vi: "Dễ bỏ qua linh cảm đúng hoặc vướng tin đồn nhiễu loạn.",
    },
    MajorArcanaDef {
        short: "ar03",
        name_en: "The Empress",
        name_vi: "Nữ Hoàng Trù Phú",
        polarity: 2,
        up_vi: "Tài lộc nảy nở, nhân duyên hòa hợp, môi trường xung quanh ấm áp và nhiều sinh khí.",
        rev_vi: "Năng lượng chăm sóc bản thân bị cạn; nên giảm bớt kỳ vọng lên người khác.",
    },
    MajorArcanaDef {
        short: "ar04",
        name_en: "The Emperor",
        name_vi: "Hoàng Đế Kỷ Luật",
        polarity: 1,
        up_vi: "Vững vàng, có quý nhân quyền uy nâng đỡ hoặc nắm thế chủ động trong công việc.",
        rev_vi: "Cứng nhắc quá mức dễ gây căng thẳng với cấp trên hoặc đồng đội.",
    },
    MajorArcanaDef {
        short: "ar05",
        name_en: "The Hierophant",
        name_vi: "Giáo Hoàng Trí Tuệ",
        polarity: 1,
        up_vi: "Được người đi trước chỉ dẫn, thuận lợi cho học thuật, thi cử và ký kết bài bản.",
        rev_vi: "Lối mòn cũ đang kìm hãm bạn; hãy linh hoạt thử phương pháp thực tế hơn.",
    },
    MajorArcanaDef {
        short: "ar06",
        name_en: "The Lovers",
        name_vi: "Tình Nhân Hòa Hợp",
        polarity: 2,
        up_vi: "Hợp tác ăn ý, tình cảm gắn kết sâu sắc và đứng trước lựa chọn đúng đắn theo con tim.",
        rev_vi: "Lưỡng lự trước hai ngã rẽ hoặc bất đồng quan điểm nhỏ cần trò chuyện thẳng thắn.",
    },
    MajorArcanaDef {
        short: "ar07",
        name_en: "The Chariot",
        name_vi: "Chiến Xa Xung Trận",
        polarity: 2,
        up_vi: "Tiến bước mạnh mẽ, vượt trở ngại nhanh gọn và gặt hái thắng lợi nhờ quyết tâm.",
        rev_vi: "Chạy quá nhanh dễ mất lái; nên rà soát lại phanh và mục tiêu trước khi tăng tốc.",
    },
    MajorArcanaDef {
        short: "ar08",
        name_en: "Strength",
        name_vi: "Sức Mạnh Nội Tâm",
        polarity: 1,
        up_vi: "Lấy nhu thắng cương, giữ bình tĩnh sẽ cảm hóa được tình huống khó khăn nhất.",
        rev_vi: "Tâm lý hơi mệt mỏi và tự nghi ngờ; một khoảng nghỉ ngắn sẽ hồi phục dũng khí.",
    },
    MajorArcanaDef {
        short: "ar09",
        name_en: "The Hermit",
        name_vi: "Ẩn Sĩ Soi Đuốc",
        polarity: 0,
        up_vi: "Thời điểm vàng để tĩnh tâm nghiên cứu sâu, tự tìm thấy câu trả lời chuẩn xác nhất.",
        rev_vi: "Thu mình quá lâu khiến bỏ lỡ tín hiệu hỗ trợ từ bên ngoài.",
    },
    MajorArcanaDef {
        short: "ar10",
        name_en: "Wheel of Fortune",
        name_vi: "Bánh Xe Vận Mệnh",
        polarity: 2,
        up_vi: "Vận thế xoay chuyển theo hướng đại lợi, cơ hội bất ngờ tự gõ cửa.",
        rev_vi: "Biến động ngắn hạn ngoài dự kiến; giữ thế thủ và không tất tay lúc này.",
    },
    MajorArcanaDef {
        short: "ar11",
        name_en: "Justice",
        name_vi: "Công Lý Cân Bằng",
        polarity: 1,
        up_vi: "Nhân quả minh bạch, nỗ lực bao nhiêu thu về xứng đáng bấy nhiêu, lợi giấy tờ pháp lý.",
        rev_vi: "Cán cân tạm thời nghiêng nhẹ do thiếu thông tin khách quan.",
    },
    MajorArcanaDef {
        short: "ar12",
        name_en: "The Hanged Man",
        name_vi: "Người Treo Ngược Tĩnh Lặng",
        polarity: 0,
        up_vi: "Tạm chậm lại một nhịp để đổi góc nhìn mới; lùi một bước để tiến ba bước.",
        rev_vi: "Cố chấp trì hoãn vô ích; cần dứt khoát buông việc không còn giá trị.",
    },
    MajorArcanaDef {
        short: "ar13",
        name_en: "Death",
        name_vi: "Chuyển Hóa Tái Sinh",
        polarity: -1,
        up_vi: "Khép lại chu kỳ cũ để nhường chỗ cho khởi đầu mới mạnh mẽ hơn.",
        rev_vi: "Sợ thay đổi khiến vướng bận dai dẳng với chuyện đã qua.",
    },
    MajorArcanaDef {
        short: "ar14",
        name_en: "Temperance",
        name_vi: "Điều Độ Hòa Hợp",
        polarity: 1,
        up_vi: "Tâm bình khí hòa, cân bằng xuất sắc giữa công việc, tài chính và sức khỏe.",
        rev_vi: "Nhịp sinh hoạt dễ bị lệch pha; tránh tiêu xài hoặc thức khuya theo cảm hứng.",
    },
    MajorArcanaDef {
        short: "ar15",
        name_en: "The Devil",
        name_vi: "Xiềng Xích Cám Dỗ",
        polarity: -2,
        up_vi: "Cảnh báo áp lực tham vọng, chi tiêu bốc đồng hoặc sự ràng buộc gây hao tâm tổn sức.",
        rev_vi: "Khoảnh khắc tỉnh thức cắt đứt thói quen xấu và giành lại quyền tự chủ.",
    },
    MajorArcanaDef {
        short: "ar16",
        name_en: "The Tower",
        name_vi: "Tòa Tháp Biến Động",
        polarity: -2,
        up_vi: "Sự cố bất ngờ làm rung chuyển kế hoạch cũ; cần sao lưu dữ liệu và đề phòng rủi ro.",
        rev_vi: "Thoát hiểm trong gang tấc hoặc giảm nhẹ được chấn động nếu xử lý sớm.",
    },
    MajorArcanaDef {
        short: "ar17",
        name_en: "The Star",
        name_vi: "Ngôi Sao Hy Vọng",
        polarity: 2,
        up_vi: "Ánh sáng dẫn đường cực vượng, chữa lành mệt mỏi và mang tới tin vui đường dài.",
        rev_vi: "Hụt hơi nhẹ vì đặt kỳ vọng quá xa; hãy ăn mừng từng bước tiến nhỏ hôm nay.",
    },
    MajorArcanaDef {
        short: "ar18",
        name_en: "The Moon",
        name_vi: "Ánh Trăng Ảo Ảnh",
        polarity: -1,
        up_vi: "Mọi thứ còn ẩn trong sương mù, dễ hiểu nhầm lời nói hoặc chi tiết ẩn chưa lộ rõ.",
        rev_vi: "Màn sương bắt đầu tan, bí mật hoặc vướng mắc dần được làm sáng tỏ.",
    },
    MajorArcanaDef {
        short: "ar19",
        name_en: "The Sun",
        name_vi: "Mặt Trời Rực Rỡ",
        polarity: 2,
        up_vi: "Vận khí sáng chói, hanh thông mọi bề, danh tiếng và niềm vui tỏa sáng rạng rỡ.",
        rev_vi: "Thành công đến muộn hơn một chút hoặc có chút mệt do làm việc dưới áp lực.",
    },
    MajorArcanaDef {
        short: "ar20",
        name_en: "Judgement",
        name_vi: "Tiếng Gọi Thức Tỉnh",
        polarity: 1,
        up_vi: "Thành quả quá khứ nay được ghi nhận xứng đáng, mở ra bước ngoặt nâng tầm.",
        rev_vi: "Tự trách bản thân quá lâu khiến chần chừ trước cơ hội sửa sai.",
    },
    MajorArcanaDef {
        short: "ar21",
        name_en: "The World",
        name_vi: "Thế Giới Viên Mãn",
        polarity: 2,
        up_vi: "Hoàn thành mỹ mãn một chặng đường lớn, vạn sự viên mãn và mở rộng tầm vóc.",
        rev_vi: "Còn thiếu đúng một mảnh ghép cuối cùng; kiên nhẫn chốt nốt khâu hoàn thiện.",
    },
];

fn now_unix_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn compute_tu_vi_for_unix_secs(unix_secs: i64) -> TuViDayInfo {
    let cans = [
        "Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ", "Canh", "Tân", "Nhâm", "Quý",
    ];
    let chis = [
        "Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi",
    ];
    let gio_list = [
        "Tý (23h-01h) & Thìn (07h-09h)",
        "Sửu (01h-03h) & Mùi (13h-15h)",
        "Dần (03h-05h) & Ngọ (11h-13h)",
        "Mão (05h-07h) & Thân (15h-17h)",
        "Thìn (07h-09h) & Dậu (17h-19h)",
        "Tỵ (09h-11h) & Hợi (21h-23h)",
    ];

    let local_secs = unix_secs + 7 * 3600;
    let days_since_epoch = local_secs.div_euclid(86_400);
    let jdn = days_since_epoch + 2_440_588;

    let can_idx = (jdn + 9).rem_euclid(10) as usize;
    let chi_idx = (jdn + 1).rem_euclid(12) as usize;

    let (ngu_hanh, lucky_color) = match can_idx {
        0 | 1 => ("Mộc (Cây Sinh Khí)", "Xanh ngọc / Lam đậm"),
        2 | 3 => ("Hỏa (Dương Quang)", "Đỏ san hô / Tím trầm"),
        4 | 5 => ("Thổ (Trung Dung)", "Vàng hổ phách / Nâu đất"),
        6 | 7 => ("Kim (Kiên Định)", "Trắng bạc / Vàng kim"),
        _ => ("Thủy (Trí Tuệ)", "Xanh biển sâu / Đen tuyền"),
    };

    TuViDayInfo {
        can_chi_day: format!("Ngày {} {}", cans[can_idx], chis[chi_idx]),
        ngu_hanh: ngu_hanh.to_string(),
        lucky_color: lucky_color.to_string(),
        gio_hoang_dao: gio_list[chi_idx % gio_list.len()].to_string(),
    }
}

pub fn translate_tarot_card_vi(
    name_short: &str,
    name_en: &str,
    arcana_type: &str,
) -> CardViTranslation {
    let low_short = name_short.trim().to_ascii_lowercase();
    for m in MAJOR_ARCANA {
        if m.short == low_short || m.name_en.eq_ignore_ascii_case(name_en.trim()) {
            return CardViTranslation {
                name_en: m.name_en.to_string(),
                name_vi: m.name_vi.to_string(),
                short_code: m.short.to_string(),
                arcana_type: "Bộ Ẩn Chính (Major Arcana)".to_string(),
                polarity: m.polarity,
                base_up_vi: m.up_vi.to_string(),
                base_rev_vi: m.rev_vi.to_string(),
            };
        }
    }

    let suit_prefix = if low_short.len() >= 2 {
        &low_short[..2]
    } else {
        ""
    };
    let rank_suffix = if low_short.len() >= 4 {
        &low_short[2..4]
    } else {
        ""
    };

    let (suit_vi, suit_up, suit_rev) = match suit_prefix {
        "wa" => (
            "Gậy (Hỏa)",
            "Nhiệt huyết hành động mạnh, công việc bứt phá đầy năng lượng.",
            "Cẩn thận nóng vội hoặc hao sức vì chạy nhiều hướng.",
        ),
        "cu" => (
            "Cốc (Thủy)",
            "Cảm xúc dồi dào, quý nhân hiền hòa và tin vui tình cảm.",
            "Dễ nhạy cảm quá mức hoặc cất giữ tâm sự chưa nói.",
        ),
        "sw" => (
            "Kiếm (Khí)",
            "Tư duy sắc bén, quyết định rành mạch và cắt bỏ vướng mắc.",
            "Cẩn trọng lời nói sắc cạnh hoặc suy nghĩ quá nhiều gây mất ngủ.",
        ),
        "pe" => (
            "Tiền (Đất)",
            "Tài lộc thực tế, tiền bạc chắc chắn và thành quả bền vững.",
            "Chậm nhịp thu hồi vốn hoặc cần siết chặt chi tiêu nhỏ.",
        ),
        _ => (
            "Ẩn Phụ",
            "Nhịp vận chuyển biến rõ nét nếu nắm bắt kịp thời.",
            "Nên thận trọng bước đi và kiểm chứng lại thông tin.",
        ),
    };

    let (rank_vi, rank_pol) = match rank_suffix {
        "ac" => ("Át", 2),
        "02" => ("Hai", 1),
        "03" => ("Ba", 1),
        "04" => ("Bốn", 0),
        "05" => ("Năm", -1),
        "06" => ("Sáu", 1),
        "07" => ("Bảy", 0),
        "08" => ("Tám", 0),
        "09" => ("Chín", 1),
        "10" => ("Mười", 1),
        "pa" => ("Tiểu Đồng", 1),
        "kn" => ("Hiệp Sĩ", 1),
        "qu" => ("Hoàng Hậu", 2),
        "ki" => ("Quốc Vương", 2),
        _ => ("Lá", 0),
    };

    let minor_polarity = if suit_prefix == "sw" && matches!(rank_suffix, "03" | "05" | "09" | "10")
    {
        -2
    } else if matches!(rank_suffix, "05" | "07" | "08") && suit_prefix != "pe" {
        -1
    } else if matches!(rank_suffix, "04" | "06" | "09" | "10" | "ac" | "qu" | "ki")
        && suit_prefix == "pe"
    {
        2
    } else {
        rank_pol
    };

    let clean_en = if name_en.trim().is_empty() {
        "Tarot Minor Card".to_string()
    } else {
        name_en.trim().to_string()
    };
    let clean_vi = if suit_prefix == "wa" || suit_prefix == "cu" || suit_prefix == "sw" || suit_prefix == "pe"
    {
        format!("{rank_vi} {suit_vi}")
    } else {
        clean_en.clone()
    };

    CardViTranslation {
        name_en: clean_en,
        name_vi: clean_vi,
        short_code: low_short,
        arcana_type: if arcana_type.trim().is_empty() {
            "Bộ Ẩn Phụ (Minor Arcana)".to_string()
        } else {
            "Bộ Ẩn Phụ (Minor Arcana)".to_string()
        },
        polarity: minor_polarity,
        base_up_vi: suit_up.to_string(),
        base_rev_vi: suit_rev.to_string(),
    }
}

pub fn classify_fortune(
    base_polarity: i32,
    is_reversed: bool,
    entropy: u64,
) -> (&'static str, &'static str, i32) {
    let jitter = ((entropy % 17) as i32) - 8; // -8..+8
    let mut score = 60 + base_polarity * 14 + jitter;
    if is_reversed {
        score = if base_polarity >= 1 {
            score - 22
        } else {
            score - 12
        };
    }
    score = score.clamp(12, 98);

    let (code, label) = if score >= 82 {
        ("dai_cat", "ĐẠI CÁT")
    } else if score >= 64 {
        ("tieu_cat", "TIỂU CÁT")
    } else if score >= 44 {
        ("binh_hoa", "BÌNH HÒA")
    } else if score >= 26 {
        ("tieu_hung", "TIỂU HUNG")
    } else {
        ("dai_hung", "ĐẠI HUNG")
    };
    (code, label, score)
}

#[derive(Clone, Debug)]
struct FetchedRawCard {
    name_en: String,
    name_short: String,
    arcana_type: String,
    meaning_up_en: String,
    meaning_rev_en: String,
    api_source: String,
}

fn fetch_tarotapi_random_card(entropy: u64) -> FetchedRawCard {
    let mut cmd = Command::new("curl.exe");
    cmd.args([
        "-s",
        "-L",
        "-m",
        "7",
        "https://tarotapi.dev/api/v1/cards/random?n=1",
    ]);
    apply_no_window(&mut cmd);

    if let Ok(out) = cmd.output() {
        if out.status.success() {
            let text = String::from_utf8_lossy(&out.stdout);
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(text.trim()) {
                if let Some(card) = v["cards"].as_array().and_then(|arr| arr.first()) {
                    let name_en = card["name"].as_str().unwrap_or("").trim().to_string();
                    let name_short = card["name_short"].as_str().unwrap_or("").trim().to_string();
                    let arcana_type = card["type"].as_str().unwrap_or("major").trim().to_string();
                    let meaning_up_en = card["meaning_up"].as_str().unwrap_or("").trim().to_string();
                    let meaning_rev_en = card["meaning_rev"].as_str().unwrap_or("").trim().to_string();
                    if !name_en.is_empty() && !name_short.is_empty() {
                        return FetchedRawCard {
                            name_en,
                            name_short,
                            arcana_type,
                            meaning_up_en,
                            meaning_rev_en,
                            api_source: "tarotapi.dev + Tử Vi Can Chi".to_string(),
                        };
                    }
                }
            }
        }
    }

    let idx = (entropy as usize) % MAJOR_ARCANA.len();
    let fallback = &MAJOR_ARCANA[idx];
    FetchedRawCard {
        name_en: fallback.name_en.to_string(),
        name_short: fallback.short.to_string(),
        arcana_type: "major".to_string(),
        meaning_up_en: fallback.up_vi.to_string(),
        meaning_rev_en: fallback.rev_vi.to_string(),
        api_source: "Offline Major Arcana + Tử Vi".to_string(),
    }
}

fn build_advice_for_fortune(
    fortune_code: &str,
    card_vi: &CardViTranslation,
    is_reversed: bool,
    tu_vi: &TuViDayInfo,
) -> (String, String, String, String, String) {
    let base_desc = if is_reversed {
        &card_vi.base_rev_vi
    } else {
        &card_vi.base_up_vi
    };

    let (work, wealth, love, remedy) = match fortune_code {
        "dai_cat" => (
            format!("Mở rộng kế hoạch, chốt việc quan trọng hoặc trình bày ý tưởng vào giờ Hoàng đạo {}.", tu_vi.gio_hoang_dao),
            "Tài khí vượng, thuận lợi cho thu hoạch thành quả hoặc cơ hội hợp tác mới.".to_string(),
            "Nhân duyên hòa thuận, dễ nhận tin vui hoặc lời khen chân thành.".to_string(),
            format!("Phát huy màu hợp mệnh ({}) và giữ tâm thế cởi mở đón vận may.", tu_vi.lucky_color),
        ),
        "tieu_cat" => (
            "Tiến độ ổn định, xử lý dứt điểm các đầu việc dang dở sẽ có kết quả tốt.".to_string(),
            "Tài chính cân bằng, có khoản thu nhỏ hoặc tiết kiệm hợp lý.".to_string(),
            "Giao tiếp nhẹ nhàng giúp mối quan hệ thêm gắn kết.".to_string(),
            format!("Ưu tiên làm việc chính theo khung giờ {} để tăng độ suôn sẻ.", tu_vi.gio_hoang_dao),
        ),
        "binh_hoa" => (
            "Giữ nhịp làm việc đều đặn, quan sát kỹ dữ liệu trước khi thay đổi lớn.".to_string(),
            "Thu chi ngang bằng, tránh mua sắm theo cảm xúc nhất thời.".to_string(),
            "Bình tĩnh lắng nghe để thấu hiểu góc nhìn của đối phương.".to_string(),
            "Nghỉ ngơi đúng giờ, uống đủ nước và sắp xếp lại bàn làm việc gọn gàng.".to_string(),
        ),
        "tieu_hung" => (
            "Dễ gặp trục trặc nhỏ hoặc trễ hẹn; nên chừa thời gian dự phòng và kiểm tra kỹ 2 lần.".to_string(),
            "Không nên đầu tư mạo hiểm hay cho vay nóng trong khung 6 giờ tới.".to_string(),
            "Tránh tranh luận căng thẳng lúc mệt mỏi, lùi một nhịp để giữ hòa khí.".to_string(),
            format!("Giảm bớt xung khắc bằng gam màu {}, sao lưu file quan trọng trước khi thao tác.", tu_vi.lucky_color),
        ),
        _ => (
            "Tạm hoãn quyết định lớn hoặc ký kết quan trọng; ưu tiên phòng thủ và kiểm soát rủi ro.".to_string(),
            "Giữ chặt ngân sách, tuyệt đối tránh giao dịch tài chính theo tin đồn.".to_string(),
            "Giữ khoảng bình lặng cho bản thân, tránh hiểu lầm bộc phát.".to_string(),
            format!("Lấy tĩnh chế động, hít thở sâu, mang sắc màu {} và chờ qua chu kỳ 6 giờ.", tu_vi.lucky_color),
        ),
    };

    let summary = format!(
        "{} ({}) — {} {}",
        card_vi.name_vi,
        if is_reversed {
            "Ngược Chiều"
        } else {
            "Thuận Chiều"
        },
        base_desc,
        format!("Tử Vi {} mang hành {}.", tu_vi.can_chi_day, tu_vi.ngu_hanh)
    );

    (summary, work, wealth, love, remedy)
}

fn build_tarot_status(
    mem_state: &MemoryState,
    now_ms: i64,
    already_drawn_in_window: bool,
) -> TarotStatusResponse {
    let history = db_list_tarot_history(mem_state, 12);
    let latest = history.first().cloned().or_else(|| db_get_latest_tarot(mem_state));

    let (can_draw, remaining_ms) = match &latest {
        Some(rec) if now_ms < rec.next_draw_at_ms => (false, rec.next_draw_at_ms - now_ms),
        _ => (true, 0),
    };

    TarotStatusResponse {
        can_draw,
        remaining_ms: remaining_ms.max(0),
        cooldown_hours: 6,
        already_drawn_in_window,
        current_reading: latest,
        history,
    }
}

#[tauri::command]
pub async fn tarot_get_status(
    mem_state: State<'_, MemoryState>,
) -> Result<TarotStatusResponse, String> {
    let now_ms = now_unix_ms();
    Ok(build_tarot_status(&mem_state, now_ms, false))
}

#[tauri::command]
pub async fn tarot_draw_card(
    mem_state: State<'_, MemoryState>,
) -> Result<TarotStatusResponse, String> {
    let now_ms = now_unix_ms();
    if let Some(latest) = db_get_latest_tarot(&mem_state) {
        if now_ms < latest.next_draw_at_ms {
            return Ok(build_tarot_status(&mem_state, now_ms, true));
        }
    }

    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(1);
    let entropy = nanos
        .wrapping_mul(6364136223846793005)
        .wrapping_add((std::process::id() as u64) ^ 0x9e37_79b9_7f4a_7c15);

    let raw = tauri::async_runtime::spawn_blocking(move || fetch_tarotapi_random_card(entropy))
        .await
        .map_err(|e| format!("Lỗi tác vụ bốc Tarot: {e}"))?;

    let tu_vi = compute_tu_vi_for_unix_secs(now_ms / 1000);
    let card_vi = translate_tarot_card_vi(&raw.name_short, &raw.name_en, &raw.arcana_type);
    let is_reversed = ((entropy >> 7) % 100) < 28;
    let (fortune_code, fortune_label, luck_score) =
        classify_fortune(card_vi.polarity, is_reversed, entropy >> 13);

    let (summary_vi, work_advice, wealth_advice, love_advice, remedy_advice) =
        build_advice_for_fortune(fortune_code, &card_vi, is_reversed, &tu_vi);

    let n1 = ((entropy >> 19) % 45) + 1;
    let mut n2 = ((entropy >> 27) % 45) + 1;
    if n2 == n1 {
        n2 = (n2 % 45) + 1;
    }
    let lucky_numbers = format!("{n1:02} - {n2:02}");

    let meaning_en = if is_reversed {
        raw.meaning_rev_en
    } else {
        raw.meaning_up_en
    };

    let draft = TarotReadingRecord {
        id: 0,
        drawn_at_ms: now_ms,
        next_draw_at_ms: now_ms + TAROT_COOLDOWN_MS,
        card_name: card_vi.name_en,
        card_name_vi: card_vi.name_vi,
        card_short: card_vi.short_code,
        arcana_type: card_vi.arcana_type,
        is_reversed,
        fortune_code: fortune_code.to_string(),
        fortune_label: fortune_label.to_string(),
        luck_score,
        can_chi_day: tu_vi.can_chi_day,
        ngu_hanh: tu_vi.ngu_hanh,
        lucky_color: tu_vi.lucky_color,
        lucky_numbers,
        summary_vi,
        work_advice,
        wealth_advice,
        love_advice,
        remedy_advice,
        meaning_en,
        api_source: raw.api_source,
        ai_deep_reading: String::new(),
    };

    let saved = db_insert_tarot_reading(&mem_state, &draft)?;
    let history = db_list_tarot_history(&mem_state, 12);

    Ok(TarotStatusResponse {
        can_draw: false,
        remaining_ms: TAROT_COOLDOWN_MS,
        cooldown_hours: 6,
        already_drawn_in_window: false,
        current_reading: Some(saved),
        history,
    })
}

#[tauri::command]
pub async fn tarot_save_ai_reading(
    mem_state: State<'_, MemoryState>,
    id: i64,
    ai_reading: String,
) -> Result<bool, String> {
    db_update_tarot_ai_reading(&mem_state, id, ai_reading.trim())?;
    Ok(true)
}
