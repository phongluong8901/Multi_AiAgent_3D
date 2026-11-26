"""Zero-cost deterministic Auto-Profile Extractor (learns user preferences into pending approval queue)."""
from __future__ import annotations

import re
from typing import Any

from agent_runtime.skill_router import normalize_text

_KNOWN_CITIES: dict[str, str] = {
    "ha noi": "Hà Nội",
    "hanoi": "Hà Nội",
    "da nang": "Đà Nẵng",
    "danang": "Đà Nẵng",
    "ho chi minh": "TP. Hồ Chí Minh",
    "tp hcm": "TP. Hồ Chí Minh",
    "tphcm": "TP. Hồ Chí Minh",
    "sai gon": "TP. Hồ Chí Minh",
    "saigon": "TP. Hồ Chí Minh",
    "hai phong": "Hải Phòng",
    "can tho": "Cần Thơ",
    "hue": "Huế",
    "nha trang": "Nha Trang",
    "da lat": "Đà Lạt",
    "tokyo": "Tokyo",
    "singapore": "Singapore",
}


def extract_profile_candidates(user_message: str) -> list[dict[str, str]]:
    """Extract durable personal facts/rules from a user message for human-approved learning (0 API calls)."""
    raw = (user_message or "").strip()
    if not raw or len(raw) < 6:
        return []

    norm = normalize_text(raw)
    candidates: list[dict[str, str]] = []

    # 1. Name / preferred addressing
    m_name = re.search(r"(?:toi ten la|minh ten la|goi toi la|goi minh la|my name is)\s+([a-zA-Z0-9\s]{2,30})", norm)
    if m_name:
        val = m_name.group(1).strip().title()
        if val:
            candidates.append(
                {"key": "user_name", "value": val, "category": "profile", "evidence": raw[:120]}
            )

    # 2. Home / default city
    if any(p in norm for p in ("toi o ", "minh o ", "song o ", "dang o ", "mac dinh o ", "nha o ")):
        for k_city, display_city in _KNOWN_CITIES.items():
            if k_city in norm:
                candidates.append(
                    {
                        "key": "default_city",
                        "value": display_city,
                        "category": "location",
                        "evidence": raw[:120],
                    }
                )
                break

    # 3. Tech stack / work domain
    m_work = re.search(
        r"(?:toi lam |minh lam |toi dang lam |minh dang lam |toi dung |minh dung )"
        r"((?:python|fastapi|mlflow|ai agent|machine learning|data|backend|frontend|devops|go|rust|next\.js|electron)[^.,;!?]{0,50})",
        norm,
    )
    if m_work:
        val = m_work.group(1).strip()
        if len(val) >= 3:
            candidates.append(
                {"key": "work_tech_stack", "value": val, "category": "work", "evidence": raw[:120]}
            )

    # 4. Explicit style / behavioral preference ("lan sau nho ...", "toi thich ...", "luon ...")
    m_rule = re.search(
        r"(?:lan sau (?:nho |hay )?|tu gio (?:nho |hay )?|luon luon |toi thich tra loi |minh thich tra loi )([^.!?\n]{8,120})",
        norm,
    )
    if m_rule:
        # Preserve original accented phrasing from raw text around match
        rule_text = raw.strip()
        if len(rule_text) <= 140:
            key_slug = "rule_" + re.sub(r"[^a-z0-9]+", "_", m_rule.group(1)[:24]).strip("_")
            candidates.append(
                {
                    "key": key_slug,
                    "value": rule_text,
                    "category": "rule",
                    "evidence": raw[:120],
                }
            )

    return candidates
