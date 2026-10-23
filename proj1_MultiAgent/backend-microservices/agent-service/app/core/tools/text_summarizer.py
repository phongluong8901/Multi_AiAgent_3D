import json
import re
from typing import Dict, Any
from .base_tool import BaseTool

def summarize_text_smart(text: str, max_length: int = 150) -> str:
    """Hàm tóm tắt văn bản thông minh (kết hợp phân tích trọng số câu và trích xuất ý chính)"""
    if not text or not str(text).strip():
        return json.dumps({"success": False, "error": "Văn bản đầu vào không được để trống."})

    cleaned = str(text).strip()
    sentences = re.split(r'(?<=[.!?\n])\s+', cleaned)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 10]

    if not sentences:
        return json.dumps({
            "success": True,
            "original_length": len(cleaned),
            "summary": cleaned[:max_length]
        }, ensure_ascii=False)

    if len(sentences) <= 2:
        return json.dumps({
            "success": True,
            "original_length": len(cleaned),
            "summary": " ".join(sentences)
        }, ensure_ascii=False)

    # Tính tần suất từ xuất hiện (Word frequency)
    words = re.findall(r'\b\w+\b', cleaned.lower())
    stop_words = {
        "và", "của", "là", "có", "trong", "cho", "được", "với", "các", "những",
        "này", "đó", "khi", "như", "đã", "sẽ", "đang", "để", "tại", "từ",
        "the", "and", "is", "of", "to", "in", "for", "with", "that", "this", "on", "at", "by"
    }
    freq: Dict[str, int] = {}
    for w in words:
        if w not in stop_words and len(w) > 1:
            freq[w] = freq.get(w, 0) + 1

    # Chấm điểm câu
    scored_sentences = []
    for i, s in enumerate(sentences):
        s_words = re.findall(r'\b\w+\b', s.lower())
        score = sum(freq.get(w, 0) for w in s_words)
        # Ưu tiên câu đầu và câu cuối bài viết
        if i == 0:
            score *= 1.3
        elif i == len(sentences) - 1:
            score *= 1.15
        scored_sentences.append((score, i, s))

    # Chọn 3 câu có điểm cao nhất giữ nguyên trật tự ban đầu
    scored_sentences.sort(key=lambda x: x[0], reverse=True)
    selected = sorted(scored_sentences[:3], key=lambda x: x[1])
    summary_text = " ".join(s for _, _, s in selected)

    if len(summary_text) > max_length * 2:
        summary_text = summary_text[:max_length * 2] + "..."

    return json.dumps({
        "success": True,
        "original_length": len(cleaned),
        "sentences_count": len(sentences),
        "summary": summary_text
    }, ensure_ascii=False)


class TextSummarizerTool(BaseTool):
    def __init__(self):
        self.name = "text_summarizer"
        self.description = "Tóm tắt các đoạn văn bản dài hoặc nội dung bài viết thành các ý chính ngắn gọn, súc tích."

    def execute(self, arguments: Dict[str, Any]) -> str:
        text = arguments.get("text") or arguments.get("input") or ""
        max_len = int(arguments.get("max_length", 150))
        return summarize_text_smart(text, max_len)