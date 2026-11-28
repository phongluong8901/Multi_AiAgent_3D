from pathlib import Path
import pytest
from unittest.mock import patch

from skill_chart_visualizer import ChartVisualizerClient


def test_render_chart_creates_png(tmp_path):
    client = ChartVisualizerClient(output_dir=str(tmp_path))
    res = client.render_chart(
        title="Top File Size",
        labels=["hiberfil.sys", "docker.iso", "report.rar"],
        values=[6466.19, 758.72, 444.1],
        chart_type="barh",
        unit="MB",
        filename="test_bar.png",
    )
    assert res["ok"] is True
    assert Path(res["image_path"]).exists()
    assert Path(res["image_path"]).stat().st_size > 1000


def test_render_chart_string_inputs_comma_separated(tmp_path):
    """Kiem tra kha nang xu ly dau vao dang chuoi phan tach bang dau phay (chong loi user nhap text)."""
    client = ChartVisualizerClient(output_dir=str(tmp_path))
    res = client.render_chart(
        title="Top Thu Muc",
        labels="C:\\Windows, C:\\Users\\AppData, C:\\Program Files",
        values="52, 40, 32",
        chart_type="barh",
        unit="GB",
        filename="test_comma.png",
    )
    assert res["ok"] is True
    assert res["points"] == 3
    assert Path(res["image_path"]).exists()


def test_render_chart_invalid_input(tmp_path):
    client = ChartVisualizerClient(output_dir=str(tmp_path))
    with pytest.raises(ValueError):
        client.render_chart(title="Bad", labels=["A"], values=[1, 2])


def test_render_chart_empty_input(tmp_path):
    client = ChartVisualizerClient(output_dir=str(tmp_path))
    with pytest.raises(ValueError):
        client.render_chart(title="Empty", labels="", values="")


@patch("psutil.disk_usage")
def test_get_disk_usage_chart(mock_disk_usage, tmp_path):
    class MockUsage:
        total = 100 * (1024**3)
        used = 40 * (1024**3)
        free = 60 * (1024**3)
        percent = 40.0

    mock_disk_usage.return_value = MockUsage()
    client = ChartVisualizerClient(output_dir=str(tmp_path))
    res = client.get_disk_usage_chart(paths=["C:\\"])
    assert res["ok"] is True
    assert Path(res["image_path"]).exists()
    assert len(res["disks"]) == 1
