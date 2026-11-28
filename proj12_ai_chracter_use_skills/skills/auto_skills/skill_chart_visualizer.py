"""Visual Chart Generator (matplotlib Agg -> dark-themed PNG saved into outputs/ for inline Web UI rendering)."""
from __future__ import annotations

import os
import re
import time
from pathlib import Path
from typing import Any, Union

import psutil


class ChartVisualizerClient:
    """Ve bieu do do hoa that (PNG bar, barh, pie, line) va luu vao outputs/ de hien thi truc tiep tren Web UI."""

    def __init__(self, output_dir: str = "outputs") -> None:
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _safe_filename(self, raw: str, prefix: str = "chart") -> Path:
        stem = (raw or "").strip()
        if stem.lower().endswith(".png"):
            stem = stem[:-4]
        clean = re.sub(r"[^a-zA-Z0-9_\-]+", "_", stem).strip("_")[:40]
        if not clean:
            clean = f"{prefix}_{int(time.time())}"
        return self.output_dir / f"{clean}.png"

    def _parse_input_list(self, data: Union[str, list, tuple, None]) -> list[Any]:
        """Chuyen doi linh hoat dau vao (list hoac chuoi phach dau phay) thanh list."""
        if data is None:
            return []
        if isinstance(data, (list, tuple)):
            return list(data)
        if isinstance(data, str):
            s = data.strip()
            if not s:
                return []
            # Tach theo dau phay
            parts = [p.strip() for p in s.split(",")]
            return [p for p in parts if p != ""]
        return [data]

    def render_chart(
        self,
        title: str,
        labels: Union[str, list[str]],
        values: Union[str, list[float], list[int], list[str]],
        chart_type: str = "barh",
        unit: str = "",
        filename: str = "",
    ) -> dict[str, Any]:
        """Ve bieu do cot/tron/duong bang matplotlib va luu file anh PNG vao outputs/ de hien thi truc tiep.

        Args:
            title: Tieu de bieu do.
            labels: Danh sach nhan hoac chuoi phan tach bang dau phay (vi du: 'A, B, C' hoac ['A', 'B', 'C']).
            values: Danh sach gia tri hoac chuoi so phan tach bang dau phay (vi du: '52, 40, 32' hoac [52, 40, 32]).
            chart_type: Kieu bieu do: 'barh' (cot ngang, mac dinh), 'bar' (cot doc), 'pie' (tron), 'line' (duong).
            unit: Don vi hien thi (vi du 'MB', 'GB', '%', 'VND').
            filename: Ten file .png tuy chon (tu dong sinh neu de trong).

        Returns:
            dict: Thong tin file anh PNG da luu trong outputs/.
        """
        # Tu dong parse flexible input (chuoi phach dau phay / list)
        parsed_labels = self._parse_input_list(labels)
        raw_values = self._parse_input_list(values)

        if not parsed_labels or not raw_values or len(parsed_labels) != len(raw_values):
            raise ValueError(
                f"labels va values khong duoc rong va phai co cung do dai. Nhan duoc labels={parsed_labels}, values={raw_values}"
            )

        # Chuyen values sang float an toan, xu ly chuoi co ky tu phu
        try:
            nums = [float(str(v).replace(",", "").strip()) for v in raw_values]
        except (ValueError, TypeError) as e:
            raise ValueError(f"Khong the chuyen doi values sang so thuc: {raw_values}. Loi: {e}")

        lbls = [str(x)[:36] for x in parsed_labels]
        ctype = (chart_type or "barh").strip().lower()
        out_path = self._safe_filename(filename or title, prefix="chart")

        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(9.2, max(4.2, 0.55 * len(lbls) + 1.8) if ctype == "barh" else 5.2), dpi=130)
        fig.patch.set_facecolor("#0f172a")
        ax.set_facecolor("#111827")

        palette = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"]
        colors = [palette[i % len(palette)] for i in range(len(lbls))]

        if ctype == "pie":
            wedges, texts, autotexts = ax.pie(
                nums,
                labels=lbls,
                autopct="%1.1f%%",
                colors=colors,
                textprops={"color": "#f1f5f9", "fontsize": 9.5},
                startangle=140,
            )
            for at in autotexts:
                at.set_color("#0f172a")
                at.set_fontweight("bold")
        elif ctype == "line":
            ax.plot(lbls, nums, marker="o", linewidth=2.2, color="#3b82f6")
            ax.fill_between(range(len(lbls)), nums, color="#3b82f6", alpha=0.18)
            for i, v in enumerate(nums):
                ax.text(i, v, f" {v:,.2f}{(' ' + unit) if unit else ''}", color="#e2e8f0", fontsize=8.5, va="bottom")
            ax.tick_params(axis="x", rotation=25, colors="#cbd5e1", labelsize=9)
            ax.tick_params(axis="y", colors="#cbd5e1", labelsize=9)
            ax.grid(color="#334155", linestyle="--", alpha=0.45)
        elif ctype == "bar":
            bars = ax.bar(lbls, nums, color=colors, edgecolor="#1e293b")
            for bar, v in zip(bars, nums):
                ax.text(
                    bar.get_x() + bar.get_width() / 2,
                    bar.get_height(),
                    f"{v:,.2f}{(' ' + unit) if unit else ''}",
                    ha="center",
                    va="bottom",
                    color="#f1f5f9",
                    fontsize=8.5,
                )
            ax.tick_params(axis="x", rotation=25, colors="#cbd5e1", labelsize=9)
            ax.tick_params(axis="y", colors="#cbd5e1", labelsize=9)
            ax.grid(axis="y", color="#334155", linestyle="--", alpha=0.45)
        else:
            # Horizontal bar (best for file paths / Vietnamese labels)
            y_pos = list(range(len(lbls)))[::-1]
            bars = ax.barh(y_pos, nums, color=colors, edgecolor="#1e293b", height=0.62)
            ax.set_yticks(y_pos)
            ax.set_yticklabels(lbls, color="#f1f5f9", fontsize=9.5)
            max_v = max(nums) if nums else 1.0
            ax.set_xlim(0, max_v * 1.24 if max_v > 0 else 1.0)
            for bar, v in zip(bars, nums):
                ax.text(
                    bar.get_width() + max_v * 0.015,
                    bar.get_y() + bar.get_height() / 2,
                    f"{v:,.2f}{(' ' + unit) if unit else ''}",
                    va="center",
                    color="#f1f5f9",
                    fontsize=9,
                )
            ax.tick_params(axis="x", colors="#cbd5e1", labelsize=9)
            ax.grid(axis="x", color="#334155", linestyle="--", alpha=0.45)

        if unit and ctype != "pie":
            if ctype == "barh":
                ax.set_xlabel(unit, color="#94a3b8", fontsize=9.5)
            else:
                ax.set_ylabel(unit, color="#94a3b8", fontsize=9.5)

        for spine in ax.spines.values():
            spine.set_color("#334155")

        ax.set_title(title, color="#f8fafc", fontsize=12.5, fontweight="bold", pad=12)
        plt.tight_layout()
        fig.savefig(out_path, facecolor=fig.get_facecolor(), bbox_inches="tight")
        plt.close(fig)

        return {
            "ok": True,
            "chart_type": ctype,
            "title": title,
            "image_path": str(out_path.resolve()),
            "filename": out_path.name,
            "points": len(lbls),
        }

    def get_disk_usage_chart(self, paths: list[str] | None = None) -> dict[str, Any]:
        """Do dung luong cac o dia (mac dinh C:, D:) va ve bieu do PNG truc quan luu vao outputs/."""
        targets = paths or [d for d in ("C:\\", "D:\\", "E:\\") if os.path.isdir(d)] or ["."]
        labels: list[str] = []
        used_vals: list[float] = []
        details: list[dict[str, Any]] = []
        for p in targets:
            try:
                u = psutil.disk_usage(p)
                tot = round(u.total / (1024**3), 2)
                used = round(u.used / (1024**3), 2)
                free = round(u.free / (1024**3), 2)
                labels.append(f"O {p} ({used}/{tot} GB - {u.percent}%)")
                used_vals.append(used)
                details.append({"path": p, "total_gb": tot, "used_gb": used, "free_gb": free, "percent": u.percent})
            except OSError:
                continue
        if not details:
            raise RuntimeError("Khong doc duoc dung luong o dia nao.")
        chart = self.render_chart(
            title="Dung luong da su dung theo o dia (GB)",
            labels=labels,
            values=used_vals,
            chart_type="barh",
            unit="GB",
            filename=f"disk_usage_{int(time.time())}.png",
        )
        return {**chart, "disks": details}
