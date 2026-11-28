import re
import json
import math
from difflib import SequenceMatcher

TOOL_SCHEMA = {
    "name": "skill_dev_tool_router_builder",
    "description": "Xây dựng bộ định tuyến chọn skill Top-K router cho Gemini 3.5 Flash Qwen, chấm điểm từ khóa tiếng Việt tiếng Anh lọc 5-8 skill liên quan nhất từ nhiều kho. Build a pure-stdlib Top-K skill router across multiple AutoEvolve catalogs: tokenize Vietnamese/English queries, rank skills by keyword/name/description overlap score, and generate a standalone `skill_router.py` module for Gemini/Qwen function calling.",
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["rank_skills_for_query", "build_router_index", "generate_router_module"]},
        },
        "required": ["action"],
    },
}

def _tokenize(text):
    return re.findall(r'\b\w+\b', text.lower())

def _overlap_score(query_tokens, skill_tokens):
    query_set = set(query_tokens)
    skill_set = set(skill_tokens)
    return len(query_set.intersection(skill_set)) / len(query_set.union(skill_set))

def rank_skills_for_query(query, catalog, top_k=6):
    query_tokens = _tokenize(query)
    ranked_skills = sorted(
        catalog,
        key=lambda skill: (
            _overlap_score(query_tokens, _tokenize(skill.get('name', ''))),
            _overlap_score(query_tokens, _tokenize(skill.get('description', ''))),
        ),
        reverse=True
    )
    return ranked_skills[:top_k]

def build_router_index(catalog):
    index = {}
    for skill in catalog:
        name_tokens = _tokenize(skill.get('name', ''))
        desc_tokens = _tokenize(skill.get('description', ''))
        for token in set(name_tokens + desc_tokens):
            if token not in index:
                index[token] = []
            index[token].append(skill)
    return index

def generate_router_module(catalog_path='catalog.json', output_path='skill_router.py', top_k=6):
    with open(catalog_path, 'r') as f:
        catalog = json.load(f)
    router_index = build_router_index(catalog)
    router_code = f"ROUTER_INDEX = {json.dumps(router_index, indent=4)}"
    with open(output_path, 'w') as f:
        f.write(router_code)

def execute(action, **kwargs):
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    
    if action == "rank_skills_for_query":
        query = kwargs.get('query')
        catalog = kwargs.get('catalog')
        top_k = kwargs.get('top_k', 6)
        return {"ok": True, "result": rank_skills_for_query(query, catalog, top_k)}
    
    if action == "build_router_index":
        catalog = kwargs.get('catalog')
        return {"ok": True, "result": build_router_index(catalog)}
    
    if action == "generate_router_module":
        catalog_path = kwargs.get('catalog_path', 'catalog.json')
        output_path = kwargs.get('output_path', 'skill_router.py')
        generate_router_module(catalog_path, output_path, top_k=kwargs.get('top_k', 6))
        return {"ok": True, "result": "Router module generated"}
    
    return {"ok": False, "error": "Invalid action parameters"}
