import pytest
from skill_circular_buffer import CircularBuffer

def test_circular_buffer_initialization():
    cb = CircularBuffer(3)
    assert cb.is_empty() == True
    assert cb.is_full() == False

def test_circular_buffer_add():
    cb = CircularBuffer(3)
    cb.add(1)
    assert cb.is_empty() == False
    assert cb.is_full() == False
    cb.add(2)
    cb.add(3)
    assert cb.is_full() == True

def test_circular_buffer_get():
    cb = CircularBuffer(3)
    cb.add(1)
    cb.add(2)
    cb.add(3)
    assert cb.get() == 1
    assert cb.get() == 2
    assert cb.get() == 3
    with pytest.raises(IndexError):
        cb.get()

def test_circular_buffer_overwrite():
    cb = CircularBuffer(3)
    cb.add(1)
    cb.add(2)
    cb.add(3)
    cb.add(4)
    assert cb.get() == 2
    assert cb.get() == 3
    assert cb.get() == 4
    with pytest.raises(IndexError):
        cb.get()

def test_circular_buffer_edge_cases():
    cb = CircularBuffer(1)
    cb.add(1)
    assert cb.get() == 1
    with pytest.raises(IndexError):
        cb.get()
    cb.add(2)
    assert cb.get() == 2
    with pytest.raises(IndexError):
        cb.get()

def test_circular_buffer_invalid_capacity():
    with pytest.raises(ValueError):
        CircularBuffer(0)
    with pytest.raises(ValueError):
        CircularBuffer(-1)

def test_circular_buffer_performance():
    cb = CircularBuffer(1000)
    for i in range(1000):
        cb.add(i)
    for i in range(1000):
        assert cb.get() == i
    with pytest.raises(IndexError):
        cb.get()
    for i in range(1000, 2000):
        cb.add(i)
    for i in range(1000, 2000):
        assert cb.get() == i
    with pytest.raises(IndexError):
        cb.get()