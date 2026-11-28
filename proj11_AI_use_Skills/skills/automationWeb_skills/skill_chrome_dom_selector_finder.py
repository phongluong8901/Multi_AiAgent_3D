import re
from bs4 import BeautifulSoup
from typing import List, Dict, Optional

TOOL_SCHEMA = {
    "name": "skill_chrome_dom_selector_finder",
    "description": "Parse HTML snippets or DOM dumps to rank and generate stable CSS selectors for interactive elements matching a human query.",
    "risk_level": "safe",
    "parameters": {
        "action": "extract_interactive_elements, find_best_selector, build_css_selector",
        "html": "HTML snippet or DOM dump as a string",
        "query": "Human query to match interactive elements",
        "tag_filter": "Optional tag filter for find_best_selector"
    }
}

def execute(action: str = "extract_interactive_elements", **kwargs) -> dict:
    try:
        if action == "extract_interactive_elements":
            return extract_interactive_elements(kwargs.get("html", ""))
        elif action == "find_best_selector":
            return find_best_selector(kwargs.get("html", ""), kwargs.get("query", ""), kwargs.get("tag_filter", ""))
        elif action == "build_css_selector":
            return build_css_selector(kwargs.get("attrs", {}), kwargs.get("tag", "button"))
        else:
            return {"ok": False, "error": "Unknown action"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def extract_interactive_elements(html: str) -> dict:
    try:
        soup = BeautifulSoup(html, 'html.parser')
        elements = soup.find_all(['button', 'input', 'a', 'select', 'textarea'])
        interactive_elements = [
            {
                "tag": element.name,
                "attrs": element.attrs,
                "text": element.get_text(strip=True)
            } for element in elements
        ]
        return {"ok": True, "elements": interactive_elements}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def find_best_selector(html: str, query: str, tag_filter: str = '') -> dict:
    try:
        elements = extract_interactive_elements(html)
        if not elements["ok"]:
            return elements
        interactive_elements = elements["elements"]
        ranked_selectors = []
        for element in interactive_elements:
            if tag_filter and element["tag"] != tag_filter:
                continue
            selector = build_css_selector(element["attrs"], element["tag"])
            if selector["ok"]:
                ranked_selectors.append({
                    "selector": selector["selector"],
                    "match_score": _calculate_match_score(element, query)
                })
        ranked_selectors.sort(key=lambda x: x["match_score"], reverse=True)
        return {"ok": True, "best_selector": ranked_selectors[0]["selector"] if ranked_selectors else None}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def build_css_selector(attrs: Dict[str, str], tag: str = 'button') -> dict:
    try:
        priority_attrs = ['id', 'data-testid', 'aria-label', 'name', 'placeholder']
        for attr in priority_attrs:
            if attr in attrs:
                return {"ok": True, "selector": f"{tag}[{attr}='{attrs[attr]}']"}
        if tag == 'button' and 'text' in attrs:
            return {"ok": True, "selector": f"{tag}:contains('{attrs['text']}')"}
        return {"ok": False, "error": "No suitable attribute found for selector"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _calculate_match_score(element: Dict[str, str], query: str) -> int:
    score = 0
    for attr in element["attrs"].values():
        if query.lower() in attr.lower():
            score += 1
    if query.lower() in element["text"].lower():
        score += 2
    return score
