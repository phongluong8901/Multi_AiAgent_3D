from unittest.mock import MagicMock, patch
import pandas as pd
import pytest
from skill_document_analyzer import DocumentAnalyzerClient


def test_analyze_csv_and_excel(tmp_path):
    df = pd.DataFrame({"product": ["A", "B", "C"], "revenue": [100, 250, 150]})
    csv_path = tmp_path / "sales.csv"
    xlsx_path = tmp_path / "sales.xlsx"
    df.to_csv(csv_path, index=False)
    df.to_excel(xlsx_path, index=False)

    client = DocumentAnalyzerClient()
    res_csv = client.analyze_tabular(str(csv_path), sample_rows=2)
    assert res_csv["rows"] == 3
    assert res_csv["cols"] == 2
    assert "revenue" in res_csv["summary_stats"]
    assert len(res_csv["sample"]) == 2

    res_xlsx = client.analyze_tabular(str(xlsx_path), sample_rows=2)
    assert res_xlsx["rows"] == 3
    assert res_xlsx["columns"] == ["product", "revenue"]


def test_read_pdf_from_url():
    fake_page = MagicMock()
    fake_page.extract_text.return_value = "Self-Evolving AI Agents PDF Content"
    fake_reader = MagicMock(pages=[fake_page])
    mock_resp = MagicMock(status_code=200, content=b"%PDF-1.4 fake")

    with patch("httpx.get", return_value=mock_resp), patch(
        "skill_document_analyzer.PdfReader", return_value=fake_reader
    ):
        client = DocumentAnalyzerClient()
        res = client.read_pdf("https://arxiv.org/pdf/2508.07407.pdf", max_pages=3)
        assert res["total_pages"] == 1
        assert "Self-Evolving AI Agents" in res["text"]


def test_missing_file_raises_error():
    client = DocumentAnalyzerClient()
    with pytest.raises(Exception):
        client.analyze_tabular("/nonexistent/path/data.csv")
