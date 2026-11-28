import skill_dev_tool_router_builder as mod
import pytest
from pathlib import Path
import json

def test_tool_schema():
    schema = mod.TOOL_SCHEMA
    assert schema["name"] == "skill_dev_tool_router_builder"
    assert schema["risk_level"] == "safe"
    assert "rank_skills_for_query" in schema["parameters"]["properties"]["action"]["enum"]
    assert "build_router_index" in schema["parameters"]["properties"]["action"]["enum"]
    assert "generate_router_module" in schema["parameters"]["properties"]["action"]["enum"]

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_rank_skills_for_query(tmp_path):
    catalog = [
        {"name": "Skill A", "description": "Description of skill A"},
        {"name": "Skill B", "description": "Description of skill B"},
        {"name": "Skill C", "description": "Description of skill C"},
    ]
    result = mod.execute("rank_skills_for_query", query="skill A", catalog=catalog, top_k=2)
    assert result["ok"]
    assert len(result["result"]) == 2
    assert result["result"][0]["name"] == "Skill A"

def test_build_router_index(tmp_path):
    catalog = [
        {"name": "Skill A", "description": "Description of skill A"},
        {"name": "Skill B", "description": "Description of skill B"},
    ]
    result = mod.execute("build_router_index", catalog=catalog)
    assert result["ok"]
    assert "skill" in result["result"]
    assert "description" in result["result"]

def test_generate_router_module(tmp_path, monkeypatch):
    catalog_path = tmp_path / "catalog.json"
    catalog_path.write_text(json.dumps([
        {"name": "Skill A", "description": "Description of skill A"},
        {"name": "Skill B", "description": "Description of skill B"},
    ]))
    output_path = tmp_path / "skill_router.py"
    result = mod.execute("generate_router_module", catalog_path=str(catalog_path), output_path=str(output_path))
    assert result["ok"]
    assert result["result"] == "Router module generated"
    assert output_path.exists()
