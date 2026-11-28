import pytest
from skill_simhash_deduplicator import SimHashProcessor

def test_compute_hash_empty_text():
    processor = SimHashProcessor()
    assert processor.compute_hash("") == 0

def test_compute_hash_whitespace_text():
    processor = SimHashProcessor()
    assert processor.compute_hash("   ") == 0

def test_compute_hash_identical_texts():
    processor = SimHashProcessor()
    hash1 = processor.compute_hash("This is a test text.")
    hash2 = processor.compute_hash("This is a test text.")
    assert hash1 == hash2

def test_compute_hash_similar_texts():
    processor = SimHashProcessor()
    hash1 = processor.compute_hash("This is a test text.")
    hash2 = processor.compute_hash("This is a test text with some additional words.")
    assert hash1 != hash2

def test_similarity_identical_hashes():
    processor = SimHashProcessor()
    hash1 = processor.compute_hash("This is a test text.")
    hash2 = processor.compute_hash("This is a test text.")
    assert processor.similarity(hash1, hash2) == 1.0

def test_similarity_different_hashes():
    processor = SimHashProcessor()
    hash1 = processor.compute_hash("This is a test text.")
    hash2 = processor.compute_hash("Completely different text.")
    assert processor.similarity(hash1, hash2) < 0.5

def test_is_duplicate_identical_texts():
    processor = SimHashProcessor()
    assert processor.is_duplicate("This is a test text.", "This is a test text.")

def test_is_duplicate_similar_texts():
    processor = SimHashProcessor()
    assert processor.is_duplicate("This is a test text.", "This is a test text with some additional words.", threshold=0.5)

def test_is_duplicate_different_texts():
    processor = SimHashProcessor()
    assert not processor.is_duplicate("This is a test text.", "Completely different text.")

def test_is_duplicate_short_texts():
    processor = SimHashProcessor(shingle_size=3)
    assert processor.is_duplicate("abc", "abc")
    assert not processor.is_duplicate("abc", "def")
