import skill_text_log_grep as mod

def test_grep_and_tail(tmp_path):
    f = tmp_path / "app.log"
    f.write_text("line1\nERROR timeout\nline3\n", encoding="utf-8")
    r1 = mod.execute("grep_text", query="ERROR", root=str(tmp_path), glob_pattern="*.log")
    assert r1["ok"] is True and r1["count"] == 1 and r1["hits"][0]["line"] == 2
    r2 = mod.execute("tail_file", file_path=str(f), lines=2)
    assert r2["ok"] is True and "line3" in r2["content"]
