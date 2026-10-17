# import json
# from typing import Dict, Any
# from transformers import pipeline
# from .base_tool import BaseTool

# class SentimentTool(BaseTool):
#     def __init__(self):
#         # Đặt tên và mô tả cho tool để agent nhận biết
#         self.name = "sentiment_analysis"
#         self.description = "Phân tích và dự đoán cảm xúc (joy, sadness, anger, v.v.) từ văn bản đầu vào."
        
#         # Tải mô hình Hugging Face
#         self.analyzer = pipeline(
#             "text-classification", 
#             model="bhadresh-savani/distilbert-base-uncased-emotion", 
#             return_all_scores=True
#         )

#     def execute(self, arguments: Dict[str, Any]) -> str:
#         text = arguments.get("text", "")
#         if not text or not text.strip():
#             return json.dumps({"success": False, "error": "Văn bản đầu vào không được để trống."})

#         try:
#             results = self.analyzer(text)[0]
#             sorted_results = sorted(results, key=lambda x: x['score'], reverse=True)
#             top_emotion = sorted_results[0]
            
#             response = {
#                 "success": True,
#                 "text": text,
#                 "top_emotion": top_emotion["label"],
#                 "confidence": round(top_emotion["score"], 4),
#                 "all_scores": [
#                     {"label": item["label"], "score": round(item["score"], 4)} 
#                     for item in sorted_results
#                 ]
#             }
#             return json.dumps(response, ensure_ascii=False)
#         except Exception as e:
#             return json.dumps({"success": False, "error": str(e)})


# # {
# #   "tool_id": "sentiment_analysis",
# #   "arguments": {
# #     "text": "I am so excited and happy to build this amazing AI system!"
# #   }
# # }