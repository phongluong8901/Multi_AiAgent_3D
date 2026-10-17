# import json
# from typing import Dict, Any
# from transformers import pipeline
# from .base_tool import BaseTool

# class TextSummarizerTool(BaseTool):
#     def __init__(self):
#         # Đặt tên và mô tả cho tool
#         self.name = "text_summarizer"
#         self.description = "Tóm tắt các đoạn văn bản dài hoặc nội dung bài báo thành các ý chính ngắn gọn bằng AI."
        
#         # Khởi tạo pipeline tóm tắt sử dụng mô hình tối ưu, chạy nhanh và nhẹ
#         self.summarizer = pipeline(
#             "summarization", 
#             model="sshleifer/distilbart-cnn-12-6"
#         )

#     def execute(self, arguments: Dict[str, Any]) -> str:
#         text = arguments.get("text", "")
#         if not text or not text.strip():
#             return json.dumps({"success": False, "error": "Văn bản đầu vào không được để trống."})

#         try:
#             # Lấy độ dài tùy chọn hoặc dùng mặc định
#             max_len = arguments.get("max_length", 130)
#             min_len = arguments.get("min_length", 30)
            
#             # Thực hiện tóm tắt văn bản
#             summary_result = self.summarizer(
#                 text, 
#                 max_length=max_len, 
#                 min_length=min_len, 
#                 do_sample=False
#             )
            
#             summarized_text = summary_result[0]["summary_text"]
            
#             response = {
#                 "success": True,
#                 "original_length": len(text),
#                 "summary": summarized_text
#             }
#             return json.dumps(response, ensure_ascii=False)
            
#         except Exception as e:
#             return json.dumps({"success": False, "error": str(e)})