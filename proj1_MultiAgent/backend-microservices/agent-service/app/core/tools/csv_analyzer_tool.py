import os
import io
import csv
import json
import logging
import urllib.request
from typing import Dict, Any, List, Optional
from .base_tool import BaseTool

logger = logging.getLogger(__name__)

class CSVAnalyzerTool(BaseTool):
    name = "csv_analyzer_tool"
    description = (
        "Công cụ phân tích cấu trúc và dữ liệu file CSV chuyên sâu: "
        "Tự động tính toán số dòng/cột, tỷ lệ giá trị rỗng (missing values), "
        "thống kê mô tả (mean, median, min, max, std), phân phối giá trị các trường và rút ra insights dữ liệu."
    )

    def execute(self, arguments: Dict[str, Any]) -> str:
        try:
            csv_content = arguments.get("csv_content") or arguments.get("data") or arguments.get("content")
            file_path = arguments.get("file_path") or arguments.get("path")
            file_url = arguments.get("file_url") or arguments.get("url")
            analysis_focus = arguments.get("query") or arguments.get("focus") or ""

            raw_text = ""

            # 1. Đọc nội dung CSV
            if file_url:
                try:
                    req = urllib.request.Request(
                        file_url,
                        headers={"User-Agent": "Mozilla/5.0"}
                    )
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        raw_text = resp.read().decode("utf-8", errors="ignore")
                except Exception as e:
                    return json.dumps({
                        "success": False,
                        "error": f"Không thể tải file CSV từ URL: {str(e)}"
                    }, ensure_ascii=False)

            elif file_path and os.path.exists(file_path):
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        raw_text = f.read()
                except Exception as e:
                    return json.dumps({
                        "success": False,
                        "error": f"Không thể đọc file CSV từ đường dẫn: {str(e)}"
                    }, ensure_ascii=False)

            elif csv_content:
                raw_text = str(csv_content).strip()

            if not raw_text:
                return json.dumps({
                    "success": False,
                    "error": "Vui lòng cung cấp nội dung CSV qua csv_content, file_url hoặc file_path."
                }, ensure_ascii=False)

            # 2. Xử lý qua Pandas nếu có, hoặc dùng module csv chuẩn
            try:
                import pandas as pd
                df = pd.read_csv(io.StringIO(raw_text))

                total_rows = len(df)
                total_cols = len(df.columns)
                columns = list(df.columns)

                # Kiểm tra missing values
                null_counts = df.isnull().sum().to_dict()
                missing_report = {
                    col: {
                        "missing_count": int(count),
                        "missing_percentage": round((count / total_rows) * 100, 2)
                    }
                    for col, count in null_counts.items() if count > 0
                }

                # Thống kê mô tả các cột số
                numeric_df = df.select_dtypes(include=["number"])
                numeric_stats = {}
                for col in numeric_df.columns:
                    series = numeric_df[col].dropna()
                    if not series.empty:
                        numeric_stats[col] = {
                            "count": int(series.count()),
                            "mean": round(float(series.mean()), 2),
                            "std": round(float(series.std()), 2) if len(series) > 1 else 0.0,
                            "min": round(float(series.min()), 2),
                            "25%": round(float(series.quantile(0.25)), 2),
                            "50% (median)": round(float(series.median()), 2),
                            "75%": round(float(series.quantile(0.75)), 2),
                            "max": round(float(series.max()), 2),
                        }

                # Thống kê các cột phân loại (Categorical)
                categorical_df = df.select_dtypes(include=["object", "category", "bool"])
                cat_stats = {}
                for col in categorical_df.columns:
                    series = categorical_df[col].dropna()
                    if not series.empty:
                        val_counts = series.value_counts().head(5).to_dict()
                        cat_stats[col] = {
                            "unique_count": int(series.nunique()),
                            "top_values": {str(k): int(v) for k, v in val_counts.items()}
                        }

                # Xem trước 5 dòng đầu
                preview_data = df.head(5).to_dict(orient="records")

                # Rút ra các phát hiện nổi bật (Insights)
                insights = []
                if missing_report:
                    high_missing = [c for c, d in missing_report.items() if d["missing_percentage"] > 20]
                    if high_missing:
                        insights.append(f"Cảnh báo: Các cột có tỷ lệ thiếu dữ liệu > 20%: {', '.join(high_missing)}")
                
                if numeric_stats:
                    insights.append(f"Tập dữ liệu chứa {len(numeric_stats)} trường số học có thể vẽ biểu đồ hoặc dự báo ML.")

                result = {
                    "success": True,
                    "dataset_overview": {
                        "total_rows": total_rows,
                        "total_columns": total_cols,
                        "column_names": columns,
                    },
                    "missing_values_report": missing_report if missing_report else "Dữ liệu hoàn chỉnh 100%, không có giá trị rỗng",
                    "numeric_statistics": numeric_stats,
                    "categorical_breakdown": cat_stats,
                    "preview_rows": preview_data,
                    "insights": insights
                }
                return json.dumps(result, ensure_ascii=False)

            except Exception as pd_err:
                # Fallback dùng python csv module nếu không có pandas
                logger.warning(f"[CSVAnalyzerTool] Pandas processing failed, falling back to standard csv: {pd_err}")
                reader = csv.reader(io.StringIO(raw_text))
                rows = list(reader)
                if not rows:
                    return json.dumps({"success": False, "error": "File CSV rỗng"}, ensure_ascii=False)

                headers = rows[0]
                data_rows = rows[1:]
                return json.dumps({
                    "success": True,
                    "dataset_overview": {
                        "total_rows": len(data_rows),
                        "total_columns": len(headers),
                        "column_names": headers,
                    },
                    "preview_rows": [dict(zip(headers, r)) for r in data_rows[:5]],
                    "note": "Xử lý thành công qua Standard CSV Parser"
                }, ensure_ascii=False)

        except Exception as e:
            logger.error(f"[CSVAnalyzerTool] Error: {str(e)}")
            return json.dumps({
                "success": False,
                "error": str(e)
            }, ensure_ascii=False)
