import skill_ssh_remote_helper as mod

def test_ssh_config_and_scp(tmp_path):
    cfg = tmp_path / "config"
    cfg.write_text("Host orangepi\n  HostName 192.168.1.50\n  User root\n", encoding="utf-8")
    r1 = mod.execute("list_ssh_hosts", config_path=str(cfg))
    assert r1["ok"] is True and r1["hosts"][0]["alias"] == "orangepi"
    r2 = mod.execute("build_scp_cmd", local_path="a.py", remote_target="root@192.168.1.50:/root/")
    assert r2["ok"] is True and "scp" in r2["command"]
