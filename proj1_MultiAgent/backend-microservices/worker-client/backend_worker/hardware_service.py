import json
import os
import platform
import socket
import subprocess
import time
import urllib.request

try:
    import psutil
except ImportError:
    psutil = None

_cached_location = None
_last_location_fetch = 0.0

def get_cpu_info():
    """Retrieve CPU statistics (usage percentage, core counts, clock frequency)"""
    if not psutil:
        return {
            "percent": 0.0,
            "count_logical": os.cpu_count() or 4,
            "count_physical": os.cpu_count() or 4,
            "freq_current": None,
            "freq_max": None,
        }
    
    freq = psutil.cpu_freq()
    return {
        "percent": psutil.cpu_percent(interval=0.2),
        "count_logical": psutil.cpu_count(logical=True) or 4,
        "count_physical": psutil.cpu_count(logical=False) or 4,
        "freq_current": round(freq.current, 1) if freq else None,
        "freq_max": round(freq.max, 1) if freq else None,
    }

def get_memory_info():
    """Retrieve RAM memory usage"""
    if not psutil:
        return {
            "total": 16 * (1024 ** 3),
            "available": 8 * (1024 ** 3),
            "used": 8 * (1024 ** 3),
            "percent": 50.0,
        }
    mem = psutil.virtual_memory()
    return {
        "total": mem.total,
        "available": mem.available,
        "used": mem.used,
        "percent": mem.percent,
    }

def get_disk_info():
    """Retrieve disk partition usage"""
    disks = []
    if not psutil:
        return disks
    
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
            disks.append({
                "device": part.device,
                "mountpoint": part.mountpoint,
                "fstype": part.fstype,
                "total": usage.total,
                "used": usage.used,
                "free": usage.free,
                "percent": usage.percent,
            })
        except Exception:
            pass
    return disks

def get_network_info():
    """Retrieve network I/O counters"""
    if not psutil:
        return {"bytes_sent": 0, "bytes_recv": 0, "packets_sent": 0, "packets_recv": 0}
    net = psutil.net_io_counters()
    return {
        "bytes_sent": net.bytes_sent,
        "bytes_recv": net.bytes_recv,
        "packets_sent": net.packets_sent,
        "packets_recv": net.packets_recv,
    }

def get_battery_info():
    """Retrieve battery status if available (e.g. laptop)"""
    if not psutil:
        return None
    try:
        battery = psutil.sensors_battery()
        if battery:
            return {
                "percent": battery.percent,
                "plugged": battery.power_plugged,
                "secsleft": battery.secsleft if battery.secsleft != psutil.POWER_TIME_UNLIMITED else None,
            }
    except Exception:
        pass
    return None

def get_os_info():
    """Retrieve Operating System details"""
    boot_time_str = ""
    if psutil:
        try:
            boot_time = psutil.boot_time()
            boot_time_str = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(boot_time))
        except Exception:
            pass

    return {
        "hostname": socket.gethostname(),
        "platform": platform.system(),
        "release": platform.release(),
        "version": platform.version(),
        "architecture": platform.machine(),
        "processor": platform.processor(),
        "boot_time": boot_time_str,
    }

def get_gpu_info():
    """
    Detect dedicated NVIDIA GPU via nvidia-smi.
    Returns GPU metadata dict or None if no dedicated GPU is detected.
    """
    try:
        cmd = [
            "nvidia-smi",
            "--query-gpu=name,memory.total,utilization.gpu,temperature.gpu",
            "--format=csv,noheader,nounits",
        ]
        creationflags = subprocess.CREATE_NO_WINDOW if platform.system() == "Windows" else 0
        out = subprocess.check_output(cmd, stderr=subprocess.DEVNULL, timeout=2, creationflags=creationflags)
        lines = out.decode("utf-8", errors="ignore").strip().splitlines()
        if lines:
            parts = [p.strip() for p in lines[0].split(",")]
            if len(parts) >= 4 and parts[0]:
                return {
                    "name": parts[0],
                    "vram_gb": round(float(parts[1]) / 1024.0, 1),
                    "load_percent": float(parts[2]),
                    "temperature": float(parts[3]),
                }
    except Exception:
        pass
    return None

def check_gpu_availability():
    """
    Check if the host machine has an active dedicated GPU suitable for AI acceleration.
    Returns (has_gpu: bool, gpu_info: dict | None)
    """
    gpu = get_gpu_info()
    if gpu and gpu.get("name"):
        vram = float(gpu.get("vram_gb") or 0.0)
        if vram > 0.0:
            return True, gpu
    return False, None

def get_location():
    """Fetch public IP location with 5-minute caching to prevent rate-limiting"""
    global _cached_location, _last_location_fetch
    now = time.time()
    if _cached_location and (now - _last_location_fetch) < 300:
        return _cached_location

    try:
        with urllib.request.urlopen("http://ip-api.com/json/", timeout=3) as response:
            data = json.loads(response.read().decode())
            if data.get("status") == "success":
                _cached_location = {
                    "lat": data.get("lat"),
                    "lon": data.get("lon"),
                    "city": data.get("city"),
                    "region": data.get("regionName"),
                    "country": data.get("country"),
                    "ip": data.get("query"),
                    "isp": data.get("isp"),
                    "source": "ip-api",
                }
                _last_location_fetch = now
                return _cached_location
    except Exception:
        pass
    return _cached_location
