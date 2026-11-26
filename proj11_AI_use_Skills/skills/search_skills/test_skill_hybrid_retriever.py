from skill_hybrid_retriever import HybridRetriever

def test_cosine_edge_cases():
    assert HybridRetriever.cosine_similarity([0.0, 0.0], [1.0, 0.0]) == 0.0
    assert abs(HybridRetriever.cosine_similarity([1.0, 0.0], [1.0, 0.0]) - 1.0) < 1e-6

def test_bm25_vietnamese():
    docs = [
        {"id": 1, "text": "Hướng dẫn cấu hình Ollama chạy Qwen trên GPU A100"},
        {"id": 2, "text": "Công thức nấu phở bò Hà Nội truyền thống"},
    ]
    res = HybridRetriever().retrieve("chạy Ollama trên A100", docs, top_k=2, use_dense=False)
    assert res[0]["id"] == 1
    assert res[0]["bm25_score"] > res[1]["bm25_score"]

def test_hybrid_with_precomputed_embeddings(monkeypatch):
    r = HybridRetriever()
    monkeypatch.setattr(r, "embed_texts", lambda texts: [[1.0, 0.0] for _ in texts])
    docs = [{"id": "a", "text": "unrelated"}, {"id": "b", "text": "target keyword"}]
    res = r.retrieve("target", docs, top_k=2, use_dense=True, precomputed_embeddings=[[0.0, 1.0], [1.0, 0.0]])
    assert res[0]["id"] == "b"
    assert res[0]["retrieval_mode"] == "hybrid_bge_bm25"

def test_score_links_filters_noise():
    links = [
        {"url": "https://site.com/login", "anchor": "Login"},
        {"url": "https://site.com/logo.png", "anchor": "Logo"},
        {"url": "https://site.com/docs/ollama-gpu", "anchor": "Ollama GPU Guide"},
    ]
    ranked = HybridRetriever().score_links_for_crawl("ollama gpu", links, top_n=5)
    assert len(ranked) == 1
    assert ranked[0]["url"] == "https://site.com/docs/ollama-gpu"
