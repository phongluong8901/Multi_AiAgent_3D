import skill_screen_capture_annotator as mod

def test_schema_and_unknown():
    assert mod.TOOL_SCHEMA["name"] == "skill_screen_capture_annotator"
    assert mod.execute("bad_action")["ok"] is False

def test_normalized_to_pixel():
    r = mod.execute("normalized_to_pixel", norm_x=500, norm_y=250, width=1920, height=1080)
    assert r["ok"] is True and r["x"] == 960 and r["y"] == 270
