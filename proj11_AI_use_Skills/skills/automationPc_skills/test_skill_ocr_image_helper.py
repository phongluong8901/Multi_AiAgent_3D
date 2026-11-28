import skill_ocr_image_helper as mod

def test_schema_and_missing():
    assert mod.TOOL_SCHEMA["name"] == "skill_ocr_image_helper"
    assert mod.execute("get_image_info", image_path="/no/such.png")["ok"] is False
    assert mod.execute("bad")["ok"] is False

def test_crop_validation(tmp_path):
    p = tmp_path / "a.png"
    p.write_bytes(b"fake")
    assert mod.execute("crop_image", image_path=str(p), box=[10, 10, 5, 5])["ok"] is False
