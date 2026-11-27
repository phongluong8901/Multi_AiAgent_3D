import pytest
from unittest.mock import patch
from skill_mouse_controller import MouseControllerClient


@pytest.fixture
def mock_pyautogui():
    with patch("skill_mouse_controller.pyautogui") as mock_pg:
        mock_pg.size.return_value = (1920, 1080)
        mock_pg.position.return_value = (500, 500)
        yield mock_pg


def test_init_missing_pyautogui():
    with patch("skill_mouse_controller.pyautogui", None):
        with pytest.raises(RuntimeError, match="Missing package pyautogui"):
            MouseControllerClient()


def test_get_screen_size(mock_pyautogui):
    client = MouseControllerClient()
    size = client.get_screen_size()
    assert size == {"width": 1920, "height": 1080}
    mock_pyautogui.size.assert_called_once()


def test_get_current_position(mock_pyautogui):
    client = MouseControllerClient()
    pos = client.get_current_position()
    assert pos == {"x": 500, "y": 500}
    mock_pyautogui.position.assert_called_once()


def test_click_at(mock_pyautogui):
    client = MouseControllerClient()
    result = client.click_at(100, 200, button="left", clicks=2)
    assert result["status"] == "success"
    mock_pyautogui.click.assert_called_once_with(x=100, y=200, clicks=2, interval=0.0, button="left")


def test_click_at_invalid_button(mock_pyautogui):
    client = MouseControllerClient()
    with pytest.raises(ValueError, match="Button must be one of"):
        client.click_at(100, 200, button="invalid")


def test_move_to(mock_pyautogui):
    client = MouseControllerClient()
    result = client.move_to(300, 400, duration=0.5)
    assert result["status"] == "success"
    mock_pyautogui.moveTo.assert_called_once_with(300, 400, duration=0.5)


def test_draw_circle(mock_pyautogui):
    client = MouseControllerClient()
    result = client.draw_circle(500, 500, radius=50, duration=0.1, steps=8)
    assert result["status"] == "success"
    assert mock_pyautogui.moveTo.call_count >= 9


def test_draw_circle_invalid_steps(mock_pyautogui):
    client = MouseControllerClient()
    with pytest.raises(ValueError, match="Steps must be at least 4"):
        client.draw_circle(500, 500, steps=2)


def test_draw_zigzag(mock_pyautogui):
    client = MouseControllerClient()
    result = client.draw_zigzag(100, 100, width=200, height=50, num_waves=3, duration=0.1)
    assert result["status"] == "success"
    assert mock_pyautogui.moveTo.call_count >= 7


def test_draw_zigzag_invalid_waves(mock_pyautogui):
    client = MouseControllerClient()
    with pytest.raises(ValueError, match="Number of waves must be at least 1"):
        client.draw_zigzag(100, 100, num_waves=0)
