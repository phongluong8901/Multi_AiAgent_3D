import json
import math
from typing import Dict, Any, List
from .base_tool import BaseTool

class MLEvaluatorTool(BaseTool):
    name = "ml_evaluator_tool"
    description = "Công cụ đánh giá mô hình Machine Learning: tính toán Accuracy, Precision, Recall, F1-Score, MSE, RMSE, MAE và gợi ý kiến trúc mô hình học máy tối ưu."

    def execute(self, arguments: Dict[str, Any]) -> str:
        try:
            task_type = arguments.get("task_type", "classification").lower()

            # 1. Đánh giá bài toán phân loại (Classification)
            if "class" in task_type or "f1" in task_type or "accuracy" in task_type:
                tp = float(arguments.get("tp", 0))
                fp = float(arguments.get("fp", 0))
                tn = float(arguments.get("tn", 0))
                fn = float(arguments.get("fn", 0))

                # Nếu truyền mảng y_true và y_pred
                y_true = arguments.get("y_true")
                y_pred = arguments.get("y_pred")
                if isinstance(y_true, list) and isinstance(y_pred, list) and len(y_true) == len(y_pred) and len(y_true) > 0:
                    tp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 1)
                    fp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 1)
                    tn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 0)
                    fn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 0)

                total = tp + fp + tn + fn
                if total == 0:
                    # Trả về công thức và cấu trúc mẫu nếu không có số liệu
                    return json.dumps({
                        "success": True,
                        "task": "classification_guide",
                        "formula": "Accuracy = (TP + TN) / Total | Precision = TP / (TP + FP) | Recall = TP / (TP + FN) | F1 = 2 * (P * R) / (P + R)",
                        "message": "Vui lòng cung cấp {tp, fp, tn, fn} hoặc mảng {y_true, y_pred} để tính toán chỉ số chi tiết."
                    }, ensure_ascii=False)

                accuracy = (tp + tn) / total if total > 0 else 0.0
                precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
                recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
                f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

                return json.dumps({
                    "success": True,
                    "task": "classification",
                    "total_samples": int(total),
                    "confusion_matrix": {"TP": int(tp), "FP": int(fp), "TN": int(tn), "FN": int(fn)},
                    "metrics": {
                        "accuracy": round(accuracy, 4),
                        "precision": round(precision, 4),
                        "recall": round(recall, 4),
                        "f1_score": round(f1_score, 4),
                    },
                    "assessment": "Mô hình cân bằng tốt (F1 cao)" if f1_score >= 0.85 else "Cần tinh chỉnh hyperparameter hoặc xử lý mất cân bằng dữ liệu."
                }, ensure_ascii=False)

            # 2. Đánh giá bài toán hồi quy (Regression)
            elif "reg" in task_type or "mse" in task_type:
                y_true = arguments.get("y_true", [])
                y_pred = arguments.get("y_pred", [])
                if isinstance(y_true, list) and isinstance(y_pred, list) and len(y_true) == len(y_pred) and len(y_true) > 0:
                    n = len(y_true)
                    mae = sum(abs(yt - yp) for yt, yp in zip(y_true, y_pred)) / n
                    mse = sum((yt - yp) ** 2 for yt, yp in zip(y_true, y_pred)) / n
                    rmse = math.sqrt(mse)
                    return json.dumps({
                        "success": True,
                        "task": "regression",
                        "samples": n,
                        "metrics": {
                            "mae": round(mae, 4),
                            "mse": round(mse, 4),
                            "rmse": round(rmse, 4),
                        }
                    }, ensure_ascii=False)

            # 3. Gợi ý thuật toán / Kiến trúc ML (Model Recommendation)
            data_type = arguments.get("data_type", "tabular").lower()
            dataset_size = arguments.get("dataset_size", "medium").lower()

            recommendations = {
                "tabular": [
                    "LightGBM / XGBoost: Hiệu năng cao nhất cho dữ liệu bảng có cấu trúc.",
                    "Random Forest: Ổn định, ít bị overfitting.",
                    "CatBoost: Tốt nhất khi có nhiều đặc trưng phân loại (categorical features)."
                ],
                "nlp": [
                    "BERT / RoBERTa: Tốt cho phân loại văn bản, NER, Sentiment.",
                    "Gemini 2.5 Flash / GPT-4o: Tốt nhất cho tóm tắt, sinh văn bản, Agentic workflows.",
                    "TF-IDF + Logistic Regression: Baseline siêu nhanh và nhẹ."
                ],
                "time_series": [
                    "Prophet / ARIMA: Phù hợp dữ liệu có chu kỳ, mùa vụ rõ ràng.",
                    "Temporal Fusion Transformer (TFT): Dự báo đa biến phức tạp."
                ]
            }

            matched = recommendations.get(data_type, recommendations["tabular"])
            return json.dumps({
                "success": True,
                "task": "model_recommendation",
                "data_type": data_type,
                "dataset_size": dataset_size,
                "suggested_algorithms": matched,
            }, ensure_ascii=False)

        except Exception as e:
            return json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)
