import pytest
from datetime import datetime, timedelta
from skill_event_queue import EventQueue

# Happy path tests
def test_add_and_get_next_event():
    eq = EventQueue()
    eq.add_event(datetime(2023, 10, 1, 12, 0), "Event 1")
    eq.add_event(datetime(2023, 10, 1, 13, 0), "Event 2")
    assert eq.get_next_event() == (datetime(2023, 10, 1, 12, 0), "Event 1")
    assert eq.get_next_event() == (datetime(2023, 10, 1, 13, 0), "Event 2")
    assert eq.get_next_event() is None

def test_add_and_peek_next_event():
    eq = EventQueue()
    eq.add_event(datetime(2023, 10, 1, 12, 0), "Event 1")
    eq.add_event(datetime(2023, 10, 1, 13, 0), "Event 2")
    assert eq.peek_next_event() == (datetime(2023, 10, 1, 12, 0), "Event 1")
    assert eq.peek_next_event() == (datetime(2023, 10, 1, 12, 0), "Event 1")
    eq.get_next_event()
    assert eq.peek_next_event() == (datetime(2023, 10, 1, 13, 0), "Event 2")

def test_remove_event():
    eq = EventQueue()
    eq.add_event(datetime(2023, 10, 1, 12, 0), "Event 1")
    eq.add_event(datetime(2023, 10, 1, 13, 0), "Event 2")
    eq.remove_event(datetime(2023, 10, 1, 12, 0))
    assert eq.get_next_event() == (datetime(2023, 10, 1, 13, 0), "Event 2")

# Edge cases
def test_add_multiple_events_same_time():
    eq = EventQueue()
    eq.add_event(datetime(2023, 10, 1, 12, 0), "Event 1")
    eq.add_event(datetime(2023, 10, 1, 12, 0), "Event 2")
    assert eq.get_next_event() == (datetime(2023, 10, 1, 12, 0), "Event 1")
    assert eq.get_next_event() == (datetime(2023, 10, 1, 12, 0), "Event 2")

def test_get_next_event_empty_queue():
    eq = EventQueue()
    assert eq.get_next_event() is None

def test_peek_next_event_empty_queue():
    eq = EventQueue()
    assert eq.peek_next_event() is None

def test_remove_event_not_found():
    eq = EventQueue()
    eq.add_event(datetime(2023, 10, 1, 12, 0), "Event 1")
    eq.remove_event(datetime(2023, 10, 1, 13, 0))
    assert eq.get_next_event() == (datetime(2023, 10, 1, 12, 0), "Event 1")

# Performance test
def test_large_number_of_events():
    eq = EventQueue()
    start_time = datetime(2023, 10, 1, 12, 0)
    for i in range(10000):
        eq.add_event(start_time + timedelta(seconds=i), f"Event {i}")
    for i in range(10000):
        assert eq.get_next_event() == (start_time + timedelta(seconds=i), f"Event {i}")
    assert eq.get_next_event() is None