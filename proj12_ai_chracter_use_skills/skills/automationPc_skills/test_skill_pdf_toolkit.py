import sys, types
import skill_pdf_toolkit as mod

def test_schema_and_missing():
    assert mod.TOOL_SCHEMA["name"] == "skill_pdf_toolkit"
    assert mod.execute("get_pdf_info", file_path="/nope.pdf")["ok"] is False
    assert mod.execute("bad")["ok"] is False

def test_extract_text_mocked(tmp_path, monkeypatch):
    p = tmp_path / "a.pdf"
    p.write_bytes(b"%PDF")
    class FakePage:
        def extract_text(self): return "Hello PDF"
    class FakeReader:
        def __init__(self, _): self.pages = [FakePage()]; self.metadata = {"/Title": "Doc"}
    monkeypatch.setitem(sys.modules, "pypdf", types.SimpleNamespace(PdfReader=FakeReader))
    r = mod.execute("extract_text", file_path=str(p), start_page=1, end_page=1)
    assert r["ok"] is True and "Hello PDF" in r["text"]
