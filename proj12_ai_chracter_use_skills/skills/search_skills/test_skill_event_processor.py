import queue
import pytest
from typing import List, Callable, Any
from skill_event_processor import process_events

# Happy path
def test_process_events_happy_path():
    event_queue = queue.Queue()
    event_queue.put({'type': 'user_login', 'data': {'user_id': 1}})
    event_queue.put({'type': 'user_logout', 'data': {'user_id': 1}})
    processors = [
        lambda event: print(f'Processing {event}') or event,
        lambda event: {'processed': True, **event}
    ]
    result = process_events(event_queue, processors)
    assert result == [{'processed': True, 'type': 'user_login', 'data': {'user_id': 1}}, {'processed': True, 'type': 'user_logout', 'data': {'user_id': 1}}]

# Edge case: Empty event queue
def test_process_events_empty_queue():
    event_queue = queue.Queue()
    processors = [
        lambda event: print(f'Processing {event}') or event,
        lambda event: {'processed': True, **event}
    ]
    result = process_events(event_queue, processors)
    assert result == []

# Edge case: No processors
def test_process_events_no_processors():
    event_queue = queue.Queue()
    event_queue.put({'type': 'user_login', 'data': {'user_id': 1}})
    processors = []
    result = process_events(event_queue, processors)
    assert result == [{'type': 'user_login', 'data': {'user_id': 1}}]

# Edge case: Single event in queue
def test_process_events_single_event():
    event_queue = queue.Queue()
    event_queue.put({'type': 'user_login', 'data': {'user_id': 1}})
    processors = [
        lambda event: {'processed': True, **event}
    ]
    result = process_events(event_queue, processors)
    assert result == [{'processed': True, 'type': 'user_login', 'data': {'user_id': 1}}]

# Error case: Invalid event_queue type
def test_process_events_invalid_event_queue_type():
    with pytest.raises(TypeError):
        process_events([], [])

# Error case: Invalid processors type
def test_process_events_invalid_processors_type():
    event_queue = queue.Queue()
    event_queue.put({'type': 'user_login', 'data': {'user_id': 1}})
    with pytest.raises(TypeError):
        process_events(event_queue, {})

# Error case: Invalid processor type in processors list
def test_process_events_invalid_processor_type():
    event_queue = queue.Queue()
    event_queue.put({'type': 'user_login', 'data': {'user_id': 1}})
    processors = [
        lambda event: {'processed': True, **event},
        "not a callable"
    ]
    with pytest.raises(TypeError):
        process_events(event_queue, processors)

# Performance test: Large number of events
def test_process_events_large_number_of_events():
    event_queue = queue.Queue()
    for i in range(1000):
        event_queue.put({'type': 'user_login', 'data': {'user_id': i}})
    processors = [
        lambda event: {'processed': True, **event}
    ]
    result = process_events(event_queue, processors)
    assert len(result) == 1000
    for i, event in enumerate(result):
        assert event == {'processed': True, 'type': 'user_login', 'data': {'user_id': i}}