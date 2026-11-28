from skill_text_chunker import SmartTextChunker

def test_empty_text():
    assert SmartTextChunker().chunk("") == []

def test_short_text_with_metadata():
    res = SmartTextChunker(chunk_size=500, overlap=50).chunk("Hello world.", {"url": "https://a.com"})
    assert len(res) == 1
    assert res[0]["url"] == "https://a.com"

def test_markdown_sections_and_code():
    md = "# Intro\nHello sentence one. Sentence two.\n\n## Code\n```python\nx = 1\n```\nEnd."
    res = SmartTextChunker(chunk_size=120, overlap=20).chunk(md)
    assert len(res) >= 2
    assert any("x = 1" in c["text"] for c in res)

def test_huge_unpunctuated_string():
    big = "a" * 2000
    res = SmartTextChunker(chunk_size=400, overlap=50).chunk(big)
    assert len(res) >= 5
    assert all(len(c["text"]) <= 400 for c in res)
