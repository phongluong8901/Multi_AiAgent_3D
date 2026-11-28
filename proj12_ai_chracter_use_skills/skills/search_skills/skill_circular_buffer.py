class CircularBuffer:
    def __init__(self, capacity: int) -> None:
        """Khởi tạo bộ đệm với kích thước tối đa là capacity."""
        if capacity <= 0:
            raise ValueError("Capacity must be a positive integer.")
        self._buffer = [None] * capacity
        self._capacity = capacity
        self._start = 0
        self._end = 0
        self._size = 0

    def add(self, value: any) -> None:
        """Thêm một phần tử vào cuối bộ đệm. Nếu bộ đệm đầy, phần tử đầu tiên sẽ bị loại bỏ."""
        if self._size == self._capacity:
            self._start = (self._start + 1) % self._capacity
            self._size -= 1
        self._buffer[self._end] = value
        self._end = (self._end + 1) % self._capacity
        self._size += 1

    def get(self) -> any:
        """Lấy phần tử từ đầu bộ đệm. Nếu bộ đệm rỗng, ném ra IndexError."""
        if self._size == 0:
            raise IndexError("CircularBuffer is empty")
        value = self._buffer[self._start]
        self._buffer[self._start] = None
        self._start = (self._start + 1) % self._capacity
        self._size -= 1
        return value

    def is_full(self) -> bool:
        """Kiểm tra xem bộ đệm có đầy không."""
        return self._size == self._capacity

    def is_empty(self) -> bool:
        """Kiểm tra xem bộ đệm có rỗng không."""
        return self._size == 0