import json
import re
from typing import Dict, Any, List
from .base_tool import BaseTool

class DataVisualizationTool(BaseTool):
    name = "data_visualization_tool"
    description = (
        "Công cụ trực quan hóa dữ liệu và biểu đồ: sinh biểu đồ đường (line), cột (bar), tròn (pie/doughnut), diện tích (area). "
        "Nhận tiêu đề (title), loại biểu đồ (chart_type), nhãn trục X (labels), tập dữ liệu (datasets hoặc data), đơn vị (unit) và tóm tắt xu hướng (summary)."
    )

    PALETTE = [
        {"border": "#eab308", "bg": "rgba(234, 179, 8, 0.2)"},    # Gold / Amber
        {"border": "#38bdf8", "bg": "rgba(56, 189, 248, 0.2)"},   # Sky Blue
        {"border": "#10b981", "bg": "rgba(16, 185, 129, 0.2)"},   # Emerald Green
        {"border": "#ec4899", "bg": "rgba(236, 72, 153, 0.2)"},   # Pink
        {"border": "#a855f7", "bg": "rgba(168, 85, 247, 0.2)"},   # Purple
        {"border": "#f97316", "bg": "rgba(249, 115, 22, 0.2)"},   # Orange
    ]

    def execute(self, arguments: Dict[str, Any]) -> str:
        try:
            # 1. Trích xuất tham số
            title = arguments.get("title") or "Biểu đồ Phân tích & Trực quan hóa Dữ liệu"
            chart_type = (arguments.get("chart_type") or arguments.get("type") or "line").lower().strip()
            if chart_type not in ["line", "bar", "pie", "doughnut", "area"]:
                chart_type = "line"

            unit = arguments.get("unit") or ""
            summary = arguments.get("summary") or arguments.get("insight") or ""

            raw_labels = arguments.get("labels") or []
            if isinstance(raw_labels, str):
                try:
                    raw_labels = json.loads(raw_labels)
                except Exception:
                    raw_labels = [l.strip() for l in raw_labels.split(",") if l.strip()]

            # 2. Chuẩn hóa Datasets
            raw_datasets = arguments.get("datasets")
            raw_data = arguments.get("data") or arguments.get("values") or arguments.get("series")

            datasets: List[Dict[str, Any]] = []

            if isinstance(raw_datasets, str):
                try:
                    raw_datasets = json.loads(raw_datasets)
                except Exception:
                    raw_datasets = None

            if isinstance(raw_datasets, list) and len(raw_datasets) > 0 and isinstance(raw_datasets[0], dict):
                for idx, ds in enumerate(raw_datasets):
                    color_cfg = self.PALETTE[idx % len(self.PALETTE)]
                    ds_data = ds.get("data", [])
                    if isinstance(ds_data, str):
                        try:
                            ds_data = json.loads(ds_data)
                        except Exception:
                            ds_data = [float(x) for x in re.findall(r"[-+]?\d*\.?\d+", ds_data)]
                    ds_data = [float(x) for x in ds_data if isinstance(x, (int, float))]
                    datasets.append({
                        "label": ds.get("label") or f"Series {idx + 1}",
                        "data": ds_data,
                        "borderColor": ds.get("borderColor") or ds.get("color") or color_cfg["border"],
                        "backgroundColor": ds.get("backgroundColor") or color_cfg["bg"],
                    })
            elif raw_data:
                # Nếu chỉ truyền mảng data đơn giản
                if isinstance(raw_data, str):
                    try:
                        parsed = json.loads(raw_data)
                        if isinstance(parsed, list):
                            raw_data = parsed
                    except Exception:
                        raw_data = [float(x) for x in re.findall(r"[-+]?\d*\.?\d+", raw_data)]

                if isinstance(raw_data, list):
                    cleaned_data = []
                    for item in raw_data:
                        try:
                            cleaned_data.append(float(item))
                        except (ValueError, TypeError):
                            continue
                    
                    datasets.append({
                        "label": arguments.get("series_name") or arguments.get("label") or "Dữ liệu",
                        "data": cleaned_data,
                        "borderColor": self.PALETTE[0]["border"],
                        "backgroundColor": self.PALETTE[0]["bg"],
                    })

            # Tự động sinh nhãn nếu thiếu
            max_points = max([len(ds["data"]) for ds in datasets]) if datasets else 0
            labels = [str(lbl) for lbl in raw_labels]
            if len(labels) < max_points:
                labels.extend([f"Điểm {i + 1}" for i in range(len(labels), max_points)])
            elif len(labels) > max_points and max_points > 0:
                labels = labels[:max_points]

            if not datasets or max_points == 0:
                return json.dumps({
                    "success": False,
                    "error": "Không có dữ liệu số hợp lệ để dựng biểu đồ. Hãy cung cấp 'labels' và 'datasets' hoặc mảng 'data'."
                }, ensure_ascii=False)

            # 3. Tạo bảng Markdown để hỗ trợ xem dữ liệu dạng văn bản
            table_lines = []
            header = ["Thời điểm / Nhãn" if chart_type == "line" else "Hạng mục"]
            for ds in datasets:
                ds_title = ds["label"] + (f" ({unit})" if unit else "")
                header.append(ds_title)
            table_lines.append("| " + " | ".join(header) + " |")
            table_lines.append("| " + " | ".join(["---"] * len(header)) + " |")

            for i, lbl in enumerate(labels):
                row = [lbl]
                for ds in datasets:
                    val = ds["data"][i] if i < len(ds["data"]) else "-"
                    row.append(str(val))
                table_lines.append("| " + " | ".join(row) + " |")
            markdown_table = "\n".join(table_lines)

            chart_payload = {
                "title": title,
                "chart_type": chart_type,
                "unit": unit,
                "labels": labels,
                "datasets": datasets,
                "summary": summary,
            }

            # Khối thẻ đặc biệt để Frontend nhận diện và render biểu đồ
            chart_embed = f"```chart_json\n{json.dumps(chart_payload, ensure_ascii=False, indent=2)}\n```"

            display_output = (
                f"### 📊 {title}\n\n"
                f"{chart_embed}\n\n"
                f"**Bảng số liệu chi tiết:**\n{markdown_table}\n\n"
                f"{'**Nhận định xu hướng:** ' + summary if summary else ''}"
            )

            return json.dumps({
                "success": True,
                "type": "chart_visualization",
                "chart": chart_payload,
                "markdown_table": markdown_table,
                "display": display_output,
            }, ensure_ascii=False)

        except Exception as e:
            return json.dumps({
                "success": False,
                "error": f"Lỗi xử lý công cụ biểu đồ: {str(e)}"
            }, ensure_ascii=False)
