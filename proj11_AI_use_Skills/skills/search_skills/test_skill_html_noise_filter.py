import pytest
from bs4 import BeautifulSoup
from skill_html_noise_filter import HTMLNoiseFilter

def test_filter_noise_happy_path():
    html_content = """
    <html>
        <head><title>Test Page</title></head>
        <body>
            <header>Header Content</header>
            <nav>Navigation Content</nav>
            <main>Main Content</main>
            <footer>Footer Content</footer>
            <script>console.log('script');</script>
        </body>
    </html>
    """
    expected_output = """
    <html>
        <head><title>Test Page</title></head>
        <body>
            <main>Main Content</main>
        </body>
    </html>
    """
    filter = HTMLNoiseFilter()
    result = filter.filter_noise(html_content)
    assert result.strip() == BeautifulSoup(expected_output, 'html.parser').prettify().strip()

def test_filter_noise_no_noise():
    html_content = """
    <html>
        <head><title>Test Page</title></head>
        <body>
            <main>Main Content</main>
        </body>
    </html>
    """
    expected_output = """
    <html>
        <head><title>Test Page</title></head>
        <body>
            <main>Main Content</main>
        </body>
    </html>
    """
    filter = HTMLNoiseFilter()
    result = filter.filter_noise(html_content)
    assert result.strip() == BeautifulSoup(expected_output, 'html.parser').prettify().strip()

def test_filter_noise_only_noise():
    html_content = """
    <html>
        <head><title>Test Page</title></head>
        <body>
            <header>Header Content</header>
            <nav>Navigation Content</nav>
            <footer>Footer Content</footer>
            <script>console.log('script');</script>
        </body>
    </html>
    """
    expected_output = """
    <html>
        <head><title>Test Page</title></head>
        <body>
        </body>
    </html>
    """
    filter = HTMLNoiseFilter()
    result = filter.filter_noise(html_content)
    assert result.strip() == BeautifulSoup(expected_output, 'html.parser').prettify().strip()

def test_filter_noise_empty_html():
    html_content = ""
    expected_output = ""
    filter = HTMLNoiseFilter()
    result = filter.filter_noise(html_content)
    assert result.strip() == expected_output

def test_filter_noise_invalid_html():
    html_content = "<html><body><main>Main Content</body></html>"
    expected_output = "<html><body><main>Main Content</main></body></html>"
    filter = HTMLNoiseFilter()
    result = filter.filter_noise(html_content)
    assert result.strip() == BeautifulSoup(expected_output, 'html.parser').prettify().strip()