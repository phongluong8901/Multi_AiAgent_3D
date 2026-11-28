import json
import re
from typing import Dict, Any, List
from .base_tool import BaseTool


class SentimentTool(BaseTool):
    name = "sentiment_analysis_tool"
    description = (
        "Công cụ phân tích cảm xúc (Sentiment & Emotion Analysis) đa ngôn ngữ Việt - Anh: "
        "xác định sắc thái Tích cực/Tiêu cực/Trung lập, điểm số cảm xúc (-1.0 đến +1.0), "
        "cảm xúc chủ đạo (joy, trust, urgency, frustration, risk) và từ khóa cảm xúc."
    )

    POSITIVE_LEXICON = {
        # Tiếng Việt
        "tuyệt vời": 2.0, "xuất sắc": 2.0, "hoàn hảo": 2.0, "hài lòng": 1.6,
        "tốt": 1.2, "nhanh": 1.0, "hiệu quả": 1.4, "tối ưu": 1.4, "thành công": 1.6,
        "tăng trưởng": 1.5, "lợi nhuận": 1.4, "ổn định": 1.2, "uy tín": 1.5,
        "chất lượng": 1.4, "đáng tin cậy": 1.5, "tiện lợi": 1.2, "thích": 1.2,
        "yêu thích": 1.6, "cải thiện": 1.2, "vượt trội": 1.7, "an toàn": 1.3,
        # Tiếng Anh
        "excellent": 2.0, "amazing": 2.0, "outstanding": 2.0, "great": 1.5,
        "good": 1.2, "fast": 1.0, "efficient": 1.4, "optimal": 1.4, "success": 1.6,
        "profitable": 1.5, "growth": 1.4, "stable": 1.2, "reliable": 1.5,
        "happy": 1.5, "satisfied": 1.5, "love": 1.6, "bullish": 1.5, "positive": 1.3,
    }

    NEGATIVE_LEXICON = {
        # Tiếng Việt
        "tệ": -1.6, "kém": -1.3, "chậm": -1.1, "lỗi": -1.5, "hỏng": -1.6,
        "thất vọng": -1.8, "lừa đảo": -2.2, "rủi ro": -1.3, "thua lỗ": -1.8,
        "sụt giảm": -1.5, "đắt": -1.0, "khó khăn": -1.1, "nguy hiểm": -1.6,
        "bực mình": -1.7, "quá tải": -1.3, "gián đoạn": -1.4, "vi phạm": -1.6,
        "thất bại": -1.8, "khủng hoảng": -2.0, "yếu kém": -1.5,
        # Tiếng Anh
        "bad": -1.4, "poor": -1.3, "slow": -1.1, "bug": -1.4, "error": -1.4,
        "broken": -1.6, "disappointed": -1.8, "scam": -2.2, "risk": -1.2,
        "loss": -1.6, "crash": -1.8, "decline": -1.4, "expensive": -1.0,
        "angry": -1.7, "frustrated": -1.6, "bearish": -1.5, "negative": -1.3,
        "fail": -1.7, "failure": -1.8, "vulnerability": -1.6,
    }

    NEGATION_WORDS = {"không", "chẳng", "chưa", "đừng", "not", "no", "never", "hardly", "without"}
    INTENSIFIERS = {"rất": 1.4, "cực kỳ": 1.7, "vô cùng": 1.7, "quá": 1.3, "very": 1.4, "extremely": 1.7, "highly": 1.5}

    def execute(self, arguments: Dict[str, Any]) -> str:
        try:
            if isinstance(arguments, str):
                text = arguments
            elif isinstance(arguments, dict):
                text = (
                    arguments.get("text")
                    or arguments.get("content")
                    or arguments.get("input")
                    or ""
                )
            else:
                text = str(arguments or "")

            text = text.strip()
            if not text:
                return json.dumps(
                    {"success": False, "error": "Văn bản đầu vào không được để trống."},
                    ensure_ascii=False,
                )

            text_lower = text.lower()
            sentences = [s.strip() for s in re.split(r"[.!?\n]+", text) if s.strip()]

            pos_hits: List[str] = []
            neg_hits: List[str] = []
            raw_score = 0.0

            # Quét các cụm từ và từ đơn
            words = re.findall(r"\w+", text_lower)
            for phrase, weight in self.POSITIVE_LEXICON.items():
                if phrase in text_lower:
                    # Kiểm tra từ phủ định đứng ngay trước cụm từ
                    negated = any(f"{neg} {phrase}" in text_lower for neg in self.NEGATION_WORDS)
                    if negated:
                        raw_score -= weight * 0.9
                        neg_hits.append(f"phủ định({phrase})")
                    else:
                        boost = 1.3 if any(f"{inten} {phrase}" in text_lower for inten in self.INTENSIFIERS) else 1.0
                        raw_score += weight * boost
                        pos_hits.append(phrase)

            for phrase, weight in self.NEGATIVE_LEXICON.items():
                if phrase in text_lower:
                    negated = any(f"{neg} {phrase}" in text_lower for neg in self.NEGATION_WORDS)
                    if negated:
                        raw_score += abs(weight) * 0.6
                        pos_hits.append(f"không {phrase}")
                    else:
                        boost = 1.3 if any(f"{inten} {phrase}" in text_lower for inten in self.INTENSIFIERS) else 1.0
                        raw_score += weight * boost
                        neg_hits.append(phrase)

            # Chuẩn hóa điểm trong khoảng [-1.0, 1.0]
            norm_divisor = max(3.5, (len(pos_hits) + len(neg_hits)) * 1.35)
            polarity = max(-1.0, min(1.0, round(raw_score / norm_divisor, 4)))

            if polarity >= 0.2:
                sentiment_label = "POSITIVE (Tích cực)"
                dominant_emotion = "joy / trust" if polarity >= 0.5 else "optimism"
            elif polarity <= -0.2:
                sentiment_label = "NEGATIVE (Tiêu cực)"
                dominant_emotion = "frustration / alarm" if polarity <= -0.5 else "concern / risk"
            else:
                sentiment_label = "NEUTRAL (Trung lập / Khách quan)"
                dominant_emotion = "analytical / neutral"

            confidence = round(min(0.98, 0.55 + abs(polarity) * 0.43), 4)

            return json.dumps(
                {
                    "success": True,
                    "sentiment": sentiment_label,
                    "polarity_score": polarity,
                    "confidence": confidence,
                    "dominant_emotion": dominant_emotion,
                    "positive_signals": pos_hits[:10],
                    "negative_signals": neg_hits[:10],
                    "sentence_count": len(sentences),
                    "word_count": len(words),
                    "recommendation": (
                        "Tín hiệu phản hồi rất tích cực, có thể duy trì chiến lược hiện tại."
                        if polarity >= 0.2
                        else (
                            "Phát hiện tín hiệu tiêu cực/rủi ro cần ưu tiên xử lý và khắc phục ngay."
                            if polarity <= -0.2
                            else "Nội dung mang tính thông tin trung lập, khách quan."
                        )
                    ),
                },
                ensure_ascii=False,
            )
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)
