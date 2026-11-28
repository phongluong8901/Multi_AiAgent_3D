import pytest
from skill_url_normalizer import URLNormalizer

def test_normalize_happy_path():
    url_normalizer = URLNormalizer()
    assert url_normalizer.normalize("https://www.example.com") == "https://www.example.com"

def test_normalize_with_trailing_slash():
    url_normalizer = URLNormalizer()
    assert url_normalizer.normalize("https://www.example.com/") == "https://www.example.com"

def test_normalize_with_query_params():
    url_normalizer = URLNormalizer()
    assert url_normalizer.normalize("https://www.example.com?param1=value1&param2=value2") == "https://www.example.com?param1=value1&param2=value2"

def test_normalize_invalid_url():
    url_normalizer = URLNormalizer()
    with pytest.raises(ValueError):
        url_normalizer.normalize("invalid-url")

def test_normalize_empty_string():
    url_normalizer = URLNormalizer()
    with pytest.raises(ValueError):
        url_normalizer.normalize("")

def test_normalize_with_fragment():
    url_normalizer = URLNormalizer()
    assert url_normalizer.normalize("https://www.example.com#section1") == "https://www.example.com#section1"