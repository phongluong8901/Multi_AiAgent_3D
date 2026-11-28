import heapq
from datetime import datetime

class EventQueue:
    def __init__(self):
        self._queue = []

    def add_event(self, event_time, event_data):
        if isinstance(event_time, datetime):
            event_time = event_time.timestamp()
        heapq.heappush(self._queue, (event_time, event_data))

    def get_next_event(self):
        if self._queue:
            event_time, event_data = heapq.heappop(self._queue)
            return (datetime.fromtimestamp(event_time), event_data)
        return None

    def peek_next_event(self):
        if self._queue:
            event_time, event_data = self._queue[0]
            return (datetime.fromtimestamp(event_time), event_data)
        return None

    def remove_event(self, event_time):
        if isinstance(event_time, datetime):
            event_time = event_time.timestamp()
        self._queue = [event for event in self._queue if event[0] != event_time]
        heapq.heapify(self._queue)