from unittest.mock import patch, MagicMock
import sys

# Mock psutil globally in sys.modules if it is missing in the environment
if 'psutil' not in sys.modules:
    mock_psutil = MagicMock()
    sys.modules['psutil'] = mock_psutil

from skill_system_monitor import SystemMonitorClient

@patch('psutil.cpu_percent', return_value=15.5)
@patch('psutil.cpu_count', return_value=8)
@patch('psutil.virtual_memory')
def test_get_system_hardware_info(mock_virtual_memory, mock_cpu_count, mock_cpu_percent):
    mock_mem = MagicMock()
    mock_mem.total = 16106127360
    mock_mem.used = 8053063680
    mock_mem.percent = 50.0
    mock_virtual_memory.return_value = mock_mem

    client = SystemMonitorClient()
    info = client.get_system_hardware_info()

    assert info["cpu_usage_percent"] == 15.5
    assert info["cpu_cores"] == 8
    assert info["ram_total_gb"] == 15.0
    assert info["ram_used_gb"] == 7.5
    assert info["ram_usage_percent"] == 50.0

@patch('psutil.process_iter')
def test_get_top_resource_processes(mock_process_iter):
    mock_proc1 = MagicMock()
    mock_proc1.info = {'pid': 101, 'name': 'python.exe', 'cpu_percent': 12.5, 'memory_percent': 15.2}
    
    mock_proc2 = MagicMock()
    mock_proc2.info = {'pid': 202, 'name': 'chrome.exe', 'cpu_percent': 5.0, 'memory_percent': 35.8}

    mock_process_iter.return_value = [mock_proc1, mock_proc2]

    client = SystemMonitorClient()
    top_procs = client.get_top_resource_processes(limit=2)

    assert len(top_procs) == 2
    assert top_procs[0]["name"] == 'chrome.exe'
    assert top_procs[0]["memory_percent"] == 35.8
    assert top_procs[1]["name"] == 'python.exe'
    assert top_procs[1]["memory_percent"] == 15.2

@patch('psutil.process_iter')
def test_get_top_resource_processes_exception_handling(mock_process_iter):
    mock_proc_faulty = MagicMock()
    type(mock_proc_faulty).info = property(fget=lambda self: (_ for _ in ()).throw(Exception("Process error")))

    mock_process_iter.return_value = [mock_proc_faulty]

    client = SystemMonitorClient()
    top_procs = client.get_top_resource_processes(limit=5)

    assert isinstance(top_procs, list)
    assert len(top_procs) == 0
