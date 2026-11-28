import skill_disk_cleaner_analyzer as mod

def test_large_and_duplicates(tmp_path):
    (tmp_path / "a.bin").write_bytes(b"1234567890")
    (tmp_path / "b.bin").write_bytes(b"1234567890")
    r1 = mod.execute("find_large_files", root=str(tmp_path), min_mb=0)
    assert r1["ok"] is True and r1["count"] == 2
    r2 = mod.execute("find_duplicates", root=str(tmp_path))
    assert r2["ok"] is True and len(r2["duplicate_groups"]) == 1
    r3 = mod.execute("clean_temp_preview", temp_dir=str(tmp_path), dry_run=True)
    assert r3["ok"] is True and (tmp_path / "a.bin").exists()
