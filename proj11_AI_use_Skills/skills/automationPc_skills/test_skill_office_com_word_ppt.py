import sys, types
import skill_office_com_word_ppt as mod

def test_schema_and_missing():
    assert mod.TOOL_SCHEMA["name"] == "skill_office_com_word_ppt"
    assert mod.execute("read_docx", file_path="/nope.docx")["ok"] is False
    assert mod.execute("bad")["ok"] is False

def test_create_docx_mocked(tmp_path, monkeypatch):
    class FakeDoc:
        def add_heading(self, *a, **k): pass
        def add_paragraph(self, *a, **k): pass
        def save(self, p): open(p, "wb").write(b"docx")
    monkeypatch.setitem(sys.modules, "docx", types.SimpleNamespace(Document=FakeDoc))
    out = tmp_path / "r.docx"
    r = mod.execute("create_docx", file_path=str(out), title="T", sections=[{"heading": "H", "body": "B"}])
    assert r["ok"] is True and out.exists()
