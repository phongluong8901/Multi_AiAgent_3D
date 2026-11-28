from __future__ import annotations

import csv
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any

_PARENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PARENT_DIR not in sys.path:
    sys.path.insert(0, _PARENT_DIR)

from skill_contract import make_envelope


DEFAULT_OUTPUT_DIR = "/content/drive/MyDrive/AutoEvolve_AI/outputs"


class ReportExporterSkill:
    """Xuất dữ liệu tổng hợp hoặc bảng kết quả ra file .xlsx, .csv, .json hoặc .md trên Drive."""

    def __init__(self, output_dir: str = DEFAULT_OUTPUT_DIR):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

    def _safe_path(self, filename: str, ext: str) -> str:
        base = os.path.basename((filename or "report").strip())
        if not base.lower().endswith(ext.lower()):
            base = f"{base}{ext}"
        return os.path.join(self.output_dir, base)

    def export_json(self, payload: Any, filename: str = "report.json") -> dict[str, Any]:
        out_path = self._safe_path(filename, ".json")
        try:
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2, default=str)
            return make_envelope(
                ok=True,
                data={"path": out_path, "format": "json", "size_bytes": os.path.getsize(out_path)},
                status="exported",
            )
        except Exception as exc:
            return make_envelope(ok=False, error=f"{type(exc).__name__}: {exc}", status="error")

    def export_csv(self, rows: list[dict[str, Any]], filename: str = "report.csv") -> dict[str, Any]:
        out_path = self._safe_path(filename, ".csv")
        try:
            if not isinstance(rows, list) or len(rows) == 0:
                return make_envelope(
                    ok=False,
                    error="rows must be a non-empty list of dicts",
                    error_kind="validation",
                    status="validation_error",
                )
            headers: list[str] = []
            for r in rows:
                if isinstance(r, dict):
                    for k in r.keys():
                        if k not in headers:
                            headers.append(k)
            with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=headers, extrasaction="ignore")
                writer.writeheader()
                for r in rows:
                    if isinstance(r, dict):
                        writer.writerow({k: (json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v) for k, v in r.items()})
            return make_envelope(
                ok=True,
                data={"path": out_path, "format": "csv", "rows": len(rows), "size_bytes": os.path.getsize(out_path)},
                status="exported",
            )
        except Exception as exc:
            return make_envelope(ok=False, error=f"{type(exc).__name__}: {exc}", status="error")

    def export_xlsx(self, rows: list[dict[str, Any]], filename: str = "report.xlsx", sheet_name: str = "Summary") -> dict[str, Any]:
        out_path = self._safe_path(filename, ".xlsx")
        try:
            import openpyxl
            from openpyxl.styles import Alignment, Font, PatternFill

            if not isinstance(rows, list) or len(rows) == 0:
                return make_envelope(
                    ok=False,
                    error="rows must be a non-empty list of dicts",
                    error_kind="validation",
                    status="validation_error",
                )

            headers: list[str] = []
            for r in rows:
                if isinstance(r, dict):
                    for k in r.keys():
                        if k not in headers:
                            headers.append(k)

            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = (sheet_name or "Summary")[:31]

            header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
            header_font = Font(color="FFFFFF", bold=True)

            ws.append(headers)
            for col_idx in range(1, len(headers) + 1):
                cell = ws.cell(row=1, column=col_idx)
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal="left", vertical="center")

            for r in rows:
                if isinstance(r, dict):
                    ws.append([
                        json.dumps(r.get(h), ensure_ascii=False) if isinstance(r.get(h), (dict, list)) else r.get(h)
                        for h in headers
                    ])

            for col in ws.columns:
                max_len = max(len(str(c.value or "")) for c in col)
                col_letter = col[0].column_letter
                ws.column_dimensions[col_letter].width = min(max(max_len + 4, 12), 55)

            wb.save(out_path)
            return make_envelope(
                ok=True,
                data={"path": out_path, "format": "xlsx", "rows": len(rows), "size_bytes": os.path.getsize(out_path)},
                status="exported",
            )
        except Exception as exc:
            return make_envelope(ok=False, error=f"{type(exc).__name__}: {exc}", status="error")

    def export_markdown(self, title: str, sections: list[dict[str, str]], filename: str = "report.md") -> dict[str, Any]:
        out_path = self._safe_path(filename, ".md")
        try:
            now_str = datetime.now(timezone.utc).isoformat()
            lines = [f"# {title or 'AutoEvolve Report'}", "", f"_Generated (UTC): {now_str}_", ""]
            for sec in sections or []:
                heading = sec.get("heading") or "Section"
                body = sec.get("body") or ""
                lines.append(f"## {heading}")
                lines.append("")
                lines.append(body)
                lines.append("")
            content = "\n".join(lines).strip() + "\n"
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(content)
            return make_envelope(
                ok=True,
                data={"path": out_path, "format": "md", "size_bytes": os.path.getsize(out_path)},
                status="exported",
            )
        except Exception as exc:
            return make_envelope(ok=False, error=f"{type(exc).__name__}: {exc}", status="error")
