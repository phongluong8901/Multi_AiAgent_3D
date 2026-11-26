"""Document analyzer for PDF, Excel (.xlsx/.xls), and CSV files from local paths or URLs."""
import io
import os
import re
import json
import httpx
import pandas as pd
from pypdf import PdfReader


class DocumentAnalyzerClient:
    """Read and summarize PDF, Excel, and CSV documents from local storage or HTTP URLs."""

    def __init__(self, timeout: float = 25.0):
        self.timeout = timeout
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
            )
        }

    def _load_bytes(self, source: str) -> bytes:
        if not source or not source.strip():
            raise ValueError("Source path/URL khong duoc rong")
        if source.startswith(("http://", "https://")):
            r = httpx.get(
                source,
                headers=self.headers,
                timeout=self.timeout,
                follow_redirects=True,
            )
            if r.status_code != 200:
                raise RuntimeError(f"HTTP {r.status_code} khi tai tai lieu {source}")
            return r.content
        if not os.path.exists(source):
            raise FileNotFoundError(f"Khong tim thay file: {source}")
        with open(source, "rb") as f:
            return f.read()

    def read_pdf(self, source: str, max_pages: int = 10, max_chars: int = 6000) -> dict:
        """Return dict keys: source, total_pages, pages_read, text."""
        raw_bytes = self._load_bytes(source)
        reader = PdfReader(io.BytesIO(raw_bytes))
        total_pages = len(reader.pages)
        if total_pages == 0:
            raise RuntimeError(f"File PDF rong: {source}")

        pages_to_read = min(total_pages, max_pages)
        chunks = []
        for idx in range(pages_to_read):
            page_text = (reader.pages[idx].extract_text() or "").strip()
            if page_text:
                chunks.append(f"[Page {idx + 1}]\n{page_text}")

        full_text = re.sub(r"\n{3,}", "\n\n", "\n\n".join(chunks)).strip()
        if not full_text:
            raise RuntimeError(f"PDF khong co lop text (co the la file scan anh): {source}")

        return {
            "source": source,
            "total_pages": total_pages,
            "pages_read": pages_to_read,
            "text": full_text[:max_chars],
        }

    def analyze_tabular(
        self,
        source: str,
        sheet_name: str | int = 0,
        sample_rows: int = 5,
    ) -> dict:
        """Return dict keys: source, rows, cols, columns, dtypes, null_counts, summary_stats, sample."""
        raw_bytes = self._load_bytes(source)
        lower_src = source.lower().split("?")[0]
        buf = io.BytesIO(raw_bytes)

        if lower_src.endswith((".xlsx", ".xls")):
            df = pd.read_excel(buf, sheet_name=sheet_name)
        else:
            try:
                df = pd.read_csv(buf)
            except UnicodeDecodeError:
                buf.seek(0)
                df = pd.read_csv(buf, encoding="latin-1")

        if df.empty and len(df.columns) == 0:
            raise RuntimeError(f"Bang du lieu rong: {source}")

        num_df = df.select_dtypes(include="number")
        summary_stats = {}
        if not num_df.empty:
            desc = num_df.describe().round(4)
            summary_stats = json.loads(desc.to_json())

        sample = json.loads(df.head(sample_rows).to_json(orient="records", date_format="iso"))
        return {
            "source": source,
            "rows": int(df.shape[0]),
            "cols": int(df.shape[1]),
            "columns": [str(c) for c in df.columns],
            "dtypes": {str(k): str(v) for k, v in df.dtypes.items()},
            "null_counts": {str(k): int(v) for k, v in df.isna().sum().items()},
            "summary_stats": summary_stats,
            "sample": sample,
        }
