import pytest
from unittest.mock import patch
from skill_huggingface_api_client import HuggingFaceApiClient

def test_search_models_happy_path():
    mock_response = {
        "models": [
            {"id": "model1", "name": "Model 1"},
            {"id": "model2", "name": "Model 2"}
        ]
    }
    with patch("httpx.get") as mock_get:
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = mock_response
        client = HuggingFaceApiClient()
        result = client.search_models(filter_task="text-classification", sort="downloads", direction="desc", limit=2)
        assert isinstance(result, list)
        assert len(result) == 2

def test_search_models_http_error():
    with patch("httpx.get") as mock_get:
        mock_get.return_value.status_code = 404
        client = HuggingFaceApiClient()
        with pytest.raises(Exception):
            client.search_models(filter_task="text-classification", sort="downloads", direction="desc", limit=2)

def test_search_models_empty_response():
    mock_response = {}
    with patch("httpx.get") as mock_get:
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = mock_response
        client = HuggingFaceApiClient()
        with pytest.raises(Exception):
            client.search_models(filter_task="text-classification", sort="downloads", direction="desc", limit=2)