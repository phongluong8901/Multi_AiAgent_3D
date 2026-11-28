import ast
import skill_dev_fullstack_feature_pack as mod

def test_tool_schema_valid():
    sc = mod.TOOL_SCHEMA
    assert sc["name"] == "skill_dev_fullstack_feature_pack"
    enum = sc["parameters"]["properties"]["action"]["enum"]
    assert set(enum) == {
        "generate_ttl_cache_module",
        "generate_sse_stream_helper",
        "generate_auth_settings_module",
        "generate_csv_json_exporter",
    }

def test_unknown_action():
    res = mod.execute(action="invalid_op")
    assert res["ok"] is False

def test_generate_ttl_cache_module():
    res = mod.execute(action="generate_ttl_cache_module", default_ttl_sec=120)
    assert res["ok"] is True
    ast.parse(res["code"])
    assert "120" in res["code"]

def test_generate_sse_and_auth_and_exporter():
    r1 = mod.execute(action="generate_sse_stream_helper", channel_name="weather")
    r2 = mod.execute(action="generate_auth_settings_module", pin_env_var="MY_PIN", db_path="app.db")
    r3 = mod.execute(action="generate_csv_json_exporter")
    for r in (r1, r2, r3):
        assert r["ok"] is True
        ast.parse(r["code"])
