import pytest
from skill_universal_ingestor import UniversalIngestor

def test_detect_types():
    ing = UniversalIngestor()
    assert ing.detect_source_type("https://youtu.be/dQw4w9WgXcQ") == "youtube"
    assert ing.detect_source_type("report.pdf") == "pdf"
    assert ing.detect_source_type("slides.pptx") == "office"
    assert ing.detect_source_type("chart.png") == "image"

def test_youtube_id_extraction():
    assert UniversalIngestor.extract_youtube_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s") == "dQw4w9WgXcQ"
    assert UniversalIngestor.extract_youtube_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert UniversalIngestor.extract_youtube_id("https://www.youtube.com/shorts/dQw4w9WgXcQ") == "dQw4w9WgXcQ"

def test_ingest_html_and_missing_file(tmp_path):
    ing = UniversalIngestor()
    res = ing.ingest_html("<html><head><title>Test</title></head><body><article><p>Hello world content.</p></article></body></html>")
    assert res["title"] == "Test"
    assert "Hello world" in res["markdown"]
    with pytest.raises(FileNotFoundError):
        ing.ingest_file(str(tmp_path / "nope.pdf"))
    p = tmp_path / "note.md"
    p.write_text("# Hi\nBody", encoding="utf-8")
    assert "Body" in ing.ingest_file(str(p))["markdown"]
