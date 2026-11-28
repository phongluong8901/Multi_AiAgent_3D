import pytest
from unittest.mock import patch, MagicMock
from skill_system_monitor import SystemMonitorClient
import psutil

@pytest.fixture
def monitor_client():
    return SystemMonitorClient()

@patch("psutil.net_connections")
def test_get_network_connections_summary_success(mock_net_conns, monitor_client):
    mock_conn1 = MagicMock()
    mock_conn1.status = psutil.CONN_LISTEN
    mock_conn2 = MagicMock()
    mock_conn2.status = psutil.CONN_ESTABLISHED
    
    mock_net_conns.return_value = [mock_conn1, mock_conn2]

    summary = monitor_client.get_network_connections_summary()
    assert summary["total_connections"] == 2
    assert summary["status_breakdown"][psutil.CONN_LISTEN] == 1
    assert summary["status_breakdown"][psutil.CONN_ESTABLISHED] == 1

@patch("psutil.net_connections")
def test_get_network_connections_summary_error(mock_net_conns, monitor_client):
    mock_net_conns.side_effect = Exception("Access denied")
    with pytest.raises(RuntimeError, match="Failed to retrieve network connections"):
        monitor_client.get_network_connections_summary()

@patch("skill_system_monitor.SystemMonitorClient._get_process_name")
@patch("psutil.net_connections")
def test_get_listening_ports_success(mock_net_conns, mock_get_proc_name, monitor_client):
    mock_conn = MagicMock()
    mock_conn.status = psutil.CONN_LISTEN
    mock_conn.laddr = MagicMock(ip="127.0.0.1", port=8080)
    mock_conn.family = 2
    mock_conn.type = 1
    mock_conn.pid = 1234

    mock_net_conns.return_value = [mock_conn]
    mock_get_proc_name.return_value = "python.exe"

    ports = monitor_client.get_listening_ports()
    assert len(ports) == 1
    assert ports[0]["port"] == 8080
    assert ports[0]["ip"] == "127.0.0.1"
    assert ports[0]["pid"] == 1234
    assert ports[0]["process_name"] == "python.exe"

@patch("psutil.net_connections")
def test_get_listening_ports_error(mock_net_conns, monitor_client):
    mock_net_conns.side_effect = Exception("System error")
    with pytest.raises(RuntimeError, match="Failed to retrieve listening ports"):
        monitor_client.get_listening_ports()

@patch("skill_system_monitor.SystemMonitorClient._get_process_name")
@patch("psutil.net_connections")
def test_get_established_connections_success(mock_net_conns, mock_get_proc_name, monitor_client):
    mock_conn = MagicMock()
    mock_conn.status = psutil.CONN_ESTABLISHED
    mock_conn.laddr = MagicMock(ip="192.168.1.10", port=50000)
    mock_conn.raddr = MagicMock(ip="93.184.216.34", port=443)
    mock_conn.pid = 5678

    mock_net_conns.return_value = [mock_conn]
    mock_get_proc_name.return_value = "chrome.exe"

    conns = monitor_client.get_established_connections()
    assert len(conns) == 1
    assert conns[0]["local_port"] == 50000
    assert conns[0]["remote_ip"] == "93.184.216.34"
    assert conns[0]["remote_port"] == 443
    assert conns[0]["pid"] == 5678
    assert conns[0]["process_name"] == "chrome.exe"

@patch("psutil.net_connections")
def test_get_established_connections_error(mock_net_conns, monitor_client):
    mock_net_conns.side_effect = Exception("System error")
    with pytest.raises(RuntimeError, match="Failed to retrieve established connections"):
        monitor_client.get_established_connections()
