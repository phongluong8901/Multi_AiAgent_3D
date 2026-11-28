from skill_report_exporter import ReportExporterSkill


def test_export_json_csv_md(tmp_path):
    exp = ReportExporterSkill(output_dir=str(tmp_path))
    rows = [{"name": "alpha", "score": 10}, {"name": "beta", "score": 20}]

    r_json = exp.export_json(rows, "sample.json")
    assert r_json["ok"] is True
    assert r_json["data"]["format"] == "json"

    r_csv = exp.export_csv(rows, "sample.csv")
    assert r_csv["ok"] is True
    assert r_csv["data"]["rows"] == 2

    r_md = exp.export_markdown("Test Report", [{"heading": "Overview", "body": "All good."}], "sample.md")
    assert r_md["ok"] is True
    assert r_md["data"]["format"] == "md"


def test_export_csv_empty_rejected(tmp_path):
    exp = ReportExporterSkill(output_dir=str(tmp_path))
    r = exp.export_csv([], "empty.csv")
    assert r["ok"] is False
    assert r["error_kind"] == "validation"
