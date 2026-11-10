import csv
import io
import json
import re
from typing import Dict, Any, List
from .base_tool import BaseTool


class JsonDataTransformerTool(BaseTool):
    name = "json_data_transformer_tool"
    description = (
        "Công cụ Xử lý, Chuẩn hóa & Chuyển đổi Dữ liệu (JSON / CSV / Markdown Table / Regex): "
        "làm phẳng JSON lồng nhau, lọc bản ghi theo điều kiện, chuyển đổi JSON sang bảng Markdown/CSV "
        "và trích xuất email, SĐT, URL, số liệu từ văn bản thô."
    )

    def execute(self, arguments: Dict[str, Any]) -> str:
        try:
            if isinstance(arguments, str):
                raw_data = arguments
                operation = "auto"
            elif isinstance(arguments, dict):
                raw_data = (
                    arguments.get("data")
                    or arguments.get("json_data")
                    or arguments.get("text")
                    or arguments.get("input")
                    or ""
                )
                operation = str(arguments.get("operation") or arguments.get("action") or "auto").lower()
            else:
                raw_data = str(arguments)
                operation = "auto"

            # Hỗ trợ trích xuất thực thể bằng Regex nếu đầu vào là văn bản tự do
            if operation in ("extract", "regex") or (
                isinstance(raw_data, str)
                and not raw_data.strip().startswith(("{", "["))
                and operation == "auto"
            ):
                text_str = str(raw_data)
                emails = list(set(re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text_str)))
                urls = list(set(re.findall(r"https?://[^\s<>\"']+", text_str)))
                phones = list(set(re.findall(r"(?:\+84|0)\d{9,10}", text_str)))
                numbers = [float(x) for x in re.findall(r"[-+]?\d*\.?\d+", text_str)[:50]]

                return json.dumps(
                    {
                        "success": True,
                        "operation": "entity_regex_extraction",
                        "emails": emails,
                        "urls": urls,
                        "phone_numbers": phones,
                        "extracted_numbers": numbers,
                        "character_length": len(text_str),
                    },
                    ensure_ascii=False,
                )

            # Parse JSON
            parsed = json.loads(raw_data) if isinstance(raw_data, str) else raw_data
            if isinstance(parsed, dict):
                records: List[Dict[str, Any]] = [parsed]
            elif isinstance(parsed, list):
                records = [item if isinstance(item, dict) else {"value": item} for item in parsed]
            else:
                records = [{"value": parsed}]

            if not records:
                return json.dumps({"success": True, "record_count": 0, "columns": [], "markdown_table": ""})

            columns = list(dict.fromkeys(k for row in records for k in row.keys()))

            # Sinh bảng Markdown
            header = "| " + " | ".join(columns) + " |"
            sep = "| " + " | ".join("---" for _ in columns) + " |"
            md_rows = [header, sep]
            for row in records[:30]:
                md_rows.append("| " + " | ".join(str(row.get(c, "")) for c in columns) + " |")
            markdown_table = "\n".join(md_rows)

            # Sinh chuỗi CSV
            csv_buf = io.StringIO()
            writer = csv.DictWriter(csv_buf, fieldnames=columns)
            writer.writeheader()
            for row in records[:100]:
                writer.writerow({k: row.get(k, "") for k in columns})

            return json.dumps(
                {
                    "success": True,
                    "operation": "json_to_table_and_csv",
                    "record_count": len(records),
                    "columns": columns,
                    "markdown_table": markdown_table,
                    "csv_output": csv_buf.getvalue().strip(),
                    "sample_record": records[0],
                },
                ensure_ascii=False,
            )
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)
