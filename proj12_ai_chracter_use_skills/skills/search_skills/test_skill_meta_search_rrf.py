from skill_meta_search_rrf import MetaSearchRRF

def test_canonicalize_url_strips_utm():
    u = MetaSearchRRF.canonicalize_url("https://Example.com/post/?utm_source=fb&id=5#top")
    assert u == "https://example.com/post?id=5"

def test_rrf_fusion_boosts_multi_provider_hit():
    m = MetaSearchRRF(k=60)
    fused = m.fuse_rankings({
        "ddg": [{"title": "A", "url": "https://a.com/1"}, {"title": "B", "url": "https://b.com/2"}],
        "gnews": [{"title": "B", "url": "https://b.com/2/?utm_medium=rss"}, {"title": "C", "url": "https://c.com/3"}],
    }, top_k=5)
    assert fused[0]["url"] == "https://b.com/2"
    assert set(fused[0]["providers"]) == {"ddg", "gnews"}

def test_parse_google_news_rss_and_reddit():
    m = MetaSearchRRF()
    xml = "<rss><channel><item><title>Tin A</title><link>https://a.vn/1</link><pubDate>Thu, 26 Nov 2026</pubDate></item></channel></rss>"
    assert m.parse_google_news_rss(xml)[0]["title"] == "Tin A"
    rd = {"data": {"children": [{"data": {"title": "Post", "permalink": "/r/LocalLLaMA/1", "selftext": "Body"}}]}}
    assert m.parse_reddit_json(rd)[0]["url"].startswith("https://www.reddit.com/r/LocalLLaMA")
