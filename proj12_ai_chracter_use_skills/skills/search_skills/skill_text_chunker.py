"""Smart Markdown and sentence-aware text chunker with overlap."""
import re
from typing import Any


class SmartTextChunker:
    """Split long documents into retrieval-ready overlapping chunks."""

    def __init__(self, chunk_size: int = 900, overlap: int = 150):
        if chunk_size <= 0:
            raise ValueError("chunk_size must be > 0")
        if overlap < 0 or overlap >= chunk_size:
            overlap = max(0, min(overlap, chunk_size // 3))
        self.chunk_size = chunk_size
        self.overlap = overlap

    def _split_sections(self, text: str) -> list[tuple[str, str]]:
        lines = text.splitlines()
        sections: list[tuple[str, str]] = []
        current_heading = ""
        buf: list[str] = []
        in_code = False

        for line in lines:
            stripped = line.strip()
            if stripped.startswith("```"):
                in_code = not in_code
                buf.append(line)
                continue
            if not in_code and re.match(r"^#{1,6}\s+.+", stripped):
                if buf:
                    sections.append((current_heading, "\n".join(buf).strip()))
                    buf = []
                current_heading = stripped
            else:
                buf.append(line)
        if buf:
            sections.append((current_heading, "\n".join(buf).strip()))
        return [(h, b) for h, b in sections if b]

    def _split_units(self, text: str) -> list[str]:
        # Giu nguyen fenced code blocks, tach doan van ban theo cau
        parts = re.split(r"(```[\s\S]*?```)", text)
        units: list[str] = []
        for part in parts:
            if not part or not part.strip():
                continue
            if part.startswith("```"):
                units.append(part.strip())
            else:
                paras = [p.strip() for p in re.split(r"\n{2,}", part) if p.strip()]
                for p in paras:
                    if len(p) <= self.chunk_size:
                        units.append(p)
                    else:
                        sents = [s.strip() for s in re.split(r"(?<=[\.\!\?\n])\s+", p) if s.strip()]
                        units.extend(sents)
        return units

    def _hard_slice(self, text: str) -> list[str]:
        step = max(1, self.chunk_size - self.overlap)
        out = []
        for i in range(0, len(text), step):
            piece = text[i : i + self.chunk_size].strip()
            if piece:
                out.append(piece)
            if i + self.chunk_size >= len(text):
                break
        return out

    def chunk(self, text: str, metadata: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        clean = (text or "").strip()
        if not clean:
            return []
        meta = dict(metadata or {})
        chunks: list[dict[str, Any]] = []

        for heading, body in self._split_sections(clean):
            prefix = f"{heading}\n" if heading else ""
            units = self._split_units(body)
            cur = prefix

            for u in units:
                if len(u) > self.chunk_size:
                    if cur.strip() and cur.strip() != heading:
                        chunks.append({"text": cur.strip(), "heading": heading, **meta})
                    for piece in self._hard_slice(u):
                        chunks.append({"text": f"{prefix}{piece}".strip(), "heading": heading, **meta})
                    cur = prefix
                    continue

                sep = "\n" if cur and not cur.endswith("\n") else ""
                if len(cur) + len(sep) + len(u) <= self.chunk_size:
                    cur = f"{cur}{sep}{u}"
                else:
                    if cur.strip():
                        chunks.append({"text": cur.strip(), "heading": heading, **meta})
                    tail = cur[-self.overlap :].strip() if self.overlap > 0 else ""
                    cur = f"{prefix}{tail}\n{u}".strip() if tail and tail != heading else f"{prefix}{u}".strip()

            if cur.strip() and cur.strip() != heading:
                chunks.append({"text": cur.strip(), "heading": heading, **meta})

        for idx, ch in enumerate(chunks):
            ch["chunk_id"] = idx
        return chunks
