from skill_query_decomposer import QueryDecomposer

def test_empty():
    r = QueryDecomposer().decompose("   ")
    assert r["sub_queries"] == []

def test_vietnamese_comparison_and_freshness():
    r = QueryDecomposer().decompose("So sánh A100 và L4 cho Ollama năm 2026 mới nhất?")
    assert r["language"] == "vi"
    assert r["freshness_needed"] is True
    assert len(r["sub_queries"]) >= 2

def test_market_intent():
    r = QueryDecomposer().decompose("Giá Bitcoin BTC trên Binance hôm nay")
    assert r["intent"] == "market"
    assert r["freshness_needed"] is True

def test_code_intent():
    r = QueryDecomposer().decompose("How to fix FastAPI Python traceback error on GitHub")
    assert r["language"] == "en"
    assert r["intent"] == "code"
