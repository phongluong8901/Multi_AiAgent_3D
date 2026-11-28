import queue
from typing import List, Callable, Any

def process_events(event_queue: queue.Queue, processors: List[Callable[[Any], Any]]) -> List[Any]:
    """Lấy các sự kiện từ event_queue, xử lý chúng bằng các hàm trong processors và trả về kết quả."""
    if not isinstance(event_queue, queue.Queue):
        raise TypeError("event_queue must be an instance of queue.Queue")
    if not isinstance(processors, list) or not all(callable(proc) for proc in processors):
        raise TypeError("processors must be a list of callable functions")

    results = []
    while not event_queue.empty():
        event = event_queue.get()
        for processor in processors:
            event = processor(event)
        results.append(event)
    return results