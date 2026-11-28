import pytest
import time
from concurrent.futures import TimeoutError as FutureTimeoutError
from skill_thread_pool import ThreadPool, Future, ThreadPoolError, TimeoutError

def test_submit_and_result():
    pool = ThreadPool(4)
    future = pool.submit(lambda x: x * x, 5)
    assert future.result() == 25
    pool.shutdown()

def test_submit_with_args_and_kwargs():
    pool = ThreadPool(4)
    future = pool.submit(lambda x, y: x + y, 5, y=10)
    assert future.result() == 15
    pool.shutdown()

def test_submit_multiple_tasks():
    pool = ThreadPool(4)
    futures = [pool.submit(lambda x: x * x, i) for i in range(10)]
    results = [future.result() for future in futures]
    assert results == [i * i for i in range(10)]
    pool.shutdown()

def test_submit_with_exception():
    pool = ThreadPool(4)
    future = pool.submit(lambda: 1 / 0)
    with pytest.raises(ZeroDivisionError):
        future.result()
    pool.shutdown()

def test_shutdown_immediately():
    pool = ThreadPool(4)
    future = pool.submit(time.sleep, 10)
    pool.shutdown(wait=False)
    assert not future.done()

def test_shutdown_wait():
    pool = ThreadPool(4)
    future = pool.submit(time.sleep, 1)
    pool.shutdown(wait=True)
    assert future.done()

def test_future_done():
    pool = ThreadPool(4)
    future = pool.submit(lambda: None)
    assert not future.done()
    future.result()
    assert future.done()
    pool.shutdown()

def test_future_timeout():
    pool = ThreadPool(4)
    future = pool.submit(time.sleep, 2)
    with pytest.raises(TimeoutError):
        future.result(timeout=1)
    pool.shutdown()

def test_future_no_timeout():
    pool = ThreadPool(4)
    future = pool.submit(time.sleep, 1)
    future.result(timeout=2)
    assert future.done()
    pool.shutdown()

def test_thread_pool_error():
    with pytest.raises(ThreadPoolError):
        raise ThreadPoolError("Test ThreadPoolError")

def test_timeout_error():
    with pytest.raises(TimeoutError):
        raise TimeoutError("Test TimeoutError")

def test_large_number_of_threads():
    pool = ThreadPool(100)
    futures = [pool.submit(lambda x: x * x, i) for i in range(100)]
    results = [future.result() for future in futures]
    assert results == [i * i for i in range(100)]
    pool.shutdown()

def test_zero_threads():
    with pytest.raises(ThreadPoolError):
        ThreadPool(0)

def test_negative_threads():
    with pytest.raises(ThreadPoolError):
        ThreadPool(-1)

def test_large_task():
    pool = ThreadPool(4)
    future = pool.submit(lambda: sum(range(1000000)))
    assert future.result() == sum(range(1000000))
    pool.shutdown()

def test_stress_test():
    pool = ThreadPool(4)
    futures = [pool.submit(lambda x: x * x, i) for i in range(1000)]
    results = [future.result() for future in futures]
    assert results == [i * i for i in range(1000)]
    pool.shutdown()