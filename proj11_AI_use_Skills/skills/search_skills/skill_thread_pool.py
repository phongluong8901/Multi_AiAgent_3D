import threading
import queue
import time
from typing import Callable, Any, Optional, TypeVar, Generic
from concurrent.futures import Future as FutureBase

T = TypeVar('T')

class ThreadPoolError(Exception):
    pass

class TimeoutError(ThreadPoolError):
    pass

class Future(FutureBase, Generic[T]):
    def __init__(self) -> None:
        super().__init__()
        self._result: Optional[T] = None
        self._exception: Optional[Exception] = None
        self._event = threading.Event()

    def result(self, timeout: Optional[float] = None) -> T:
        if not self._event.wait(timeout):
            raise TimeoutError("Future timed out")
        if self._exception:
            raise self._exception
        return self._result

    def done(self) -> bool:
        return self._event.is_set()

    def _set_result(self, result: T) -> None:
        self._result = result
        self._event.set()

    def _set_exception(self, exception: Exception) -> None:
        self._exception = exception
        self._event.set()

class ThreadPool:
    def __init__(self, num_threads: int) -> None:
        if num_threads <= 0:
            raise ThreadPoolError("Number of threads must be greater than zero")
        self._num_threads = num_threads
        self._tasks = queue.Queue()
        self._threads = [threading.Thread(target=self._worker) for _ in range(num_threads)]
        self._shutdown = False
        self._lock = threading.Lock()
        for thread in self._threads:
            thread.start()

    def submit(self, func: Callable[..., T], *args, **kwargs) -> Future[T]:
        with self._lock:
            if self._shutdown:
                raise ThreadPoolError("ThreadPool is shutdown")
            future = Future[T]()
            self._tasks.put((func, args, kwargs, future))
            return future

    def shutdown(self, wait: bool = True) -> None:
        with self._lock:
            self._shutdown = True
        for _ in range(self._num_threads):
            self._tasks.put(None)
        if wait:
            for thread in self._threads:
                thread.join()

    def _worker(self) -> None:
        while True:
            task = self._tasks.get()
            if task is None:
                break
            func, args, kwargs, future = task
            try:
                result = func(*args, **kwargs)
                future._set_result(result)
            except Exception as e:
                future._set_exception(e)
            finally:
                self._tasks.task_done()