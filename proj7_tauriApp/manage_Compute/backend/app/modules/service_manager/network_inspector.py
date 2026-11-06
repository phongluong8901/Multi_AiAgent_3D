"""
Module thanh tra mạng và giám sát kết nối Socket (Network Inspector).
Hỗ trợ phân giải DNS ngược bất đồng bộ (Reverse DNS resolution với in-memory cache),
phân loại dịch vụ mục tiêu (AI/LLM, Database, Cloud Provider, Local Microservice),
truy xuất socket qua psutil kèm cơ chế fallback tự động sang netstat.
"""

import psutil
import socket
import subprocess
import time
import re
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor
from app.schemas.process_schema import (
    ProcessNetworkProfile,
    SocketConnectionItem,
    SystemNetworkSummary,
)

class NetworkInspector:
    """
    Bộ thanh tra và giải mã lưu lượng mạng cho từng tiến trình và toàn bộ hệ thống.
    """
    def __init__(self):
        """Khởi tạo DNS cache trong RAM và ThreadPoolExecutor phục vụ phân giải hostname không chặn main thread."""
        # In-memory DNS cache: ip -> (hostname, timestamp)
        self._dns_cache: Dict[str, tuple[str, float]] = {
            "127.0.0.1": ("localhost", time.time() + 86400 * 365),
            "0.0.0.0": ("localhost / all-interfaces", time.time() + 86400 * 365),
            "::1": ("localhost (IPv6)", time.time() + 86400 * 365),
        }
        self._executor = ThreadPoolExecutor(max_workers=4)

    def _resolve_ip(self, ip: str, timeout: float = 0.4) -> str:
        """
        Phân giải địa chỉ IP sang Hostname qua DNS Cache với cơ chế non-blocking an toàn.

        Args:
            ip: Địa chỉ IP cần phân giải.
            timeout: Thời gian chờ tối đa cho mỗi truy vấn DNS (giây).

        Returns:
            Tên miền hostname hoặc chính địa chỉ IP nếu truy vấn thất bại.
        """
        if not ip:
            return "unknown"

        now = time.time()
        if ip in self._dns_cache:
            hostname, expire_at = self._dns_cache[ip]
            if now < expire_at:
                return hostname

        # Phân loại nhanh các dải IP nội bộ LAN không cần truy vấn DNS công cộng
        if ip.startswith("10.") or ip.startswith("192.168.") or (ip.startswith("172.") and 16 <= int(ip.split(".")[1] if "." in ip else 0) <= 31):
            name = f"LAN ({ip})"
            self._dns_cache[ip] = (name, now + 3600)
            return name

        def query():
            try:
                host, _, _ = socket.gethostbyaddr(ip)
                return host
            except Exception:
                return ip

        try:
            future = self._executor.submit(query)
            resolved = future.result(timeout=timeout)
            self._dns_cache[ip] = (resolved, now + 3600)
            return resolved
        except Exception:
            self._dns_cache[ip] = (ip, now + 300)
            return ip

    def _build_target_url(self, remote_host: str, remote_ip: str, remote_port: Optional[int], category: str) -> str:
        """
        Xây dựng chuỗi URL Endpoint đầy đủ dựa trên giao thức, port và host/domain.

        Args:
            remote_host: Tên host đã phân giải.
            remote_ip: Địa chỉ IP đích.
            remote_port: Cổng mạng đích.
            category: Phân loại dịch vụ.

        Returns:
            Định dạng URL trực quan (https://, http://, postgres://, v.v.).
        """
        host_target = remote_host if remote_host and remote_host != "unknown" and not remote_host.startswith("LAN (") else remote_ip
        if not host_target:
            return "N/A"

        if remote_port == 443:
            return f"https://{host_target}"
        elif remote_port == 80:
            return f"http://{host_target}"
        elif category == "DATABASE":
            if remote_port == 5432:
                return f"postgres://{host_target}:5432"
            elif remote_port == 3306:
                return f"mysql://{host_target}:3306"
            elif remote_port == 6379:
                return f"redis://{host_target}:6379"
            elif remote_port == 27017:
                return f"mongodb://{host_target}:27017"
            return f"db://{host_target}:{remote_port}"
        elif remote_port in [8000, 8080, 5000, 3000, 5173, 11434, 14200] or category in ["LOCAL_SERVICE", "AI_LLM"]:
            return f"http://{host_target}:{remote_port}"
        else:
            return f"tcp://{host_target}:{remote_port}" if remote_port else host_target

    def _classify_service(self, remote_ip: str, remote_port: Optional[int], remote_host: str) -> tuple[str, str]:
        """
        Phân loại dịch vụ API và điểm cuối kết nối (AI/LLM, Cloud, Database, Local Microservice).

        Args:
            remote_ip: Địa chỉ IP máy chủ đích.
            remote_port: Cổng kết nối đích.
            remote_host: Tên miền của máy chủ đích.

        Returns:
            Tuple gồm (mã danh mục, mô tả chi tiết).
        """
        host_lower = (remote_host or "").lower()
        ip_str = remote_ip or ""

        # Điểm cuối dịch vụ AI & LLM Inference
        if any(k in host_lower for k in ["openai", "api.openai", "chatgpt"]):
            return "AI_LLM", "OpenAI API Endpoint (GPT-4o / Embeddings)"
        if any(k in host_lower for k in ["anthropic", "claude"]):
            return "AI_LLM", "Anthropic API Endpoint (Claude)"
        if any(k in host_lower for k in ["huggingface", "hf.co"]):
            return "AI_LLM", "Hugging Face Model Hub & Inference API"
        if any(k in host_lower for k in ["deepseek", "openrouter", "together.xyz", "groq"]):
            return "AI_LLM", "AI Cloud Inference Provider"
        if remote_port == 11434 or "ollama" in host_lower:
            return "AI_LLM", "Ollama Local LLM Inference Engine"
        if remote_port == 8000 and any(k in host_lower for k in ["localhost", "127.0.0.1"]):
            return "AI_LLM", "vLLM / Local AI Microservice (:8000)"

        # Kết nối cơ sở dữ liệu
        if remote_port == 5432:
            return "DATABASE", "PostgreSQL Database Connection"
        if remote_port == 3306:
            return "DATABASE", "MySQL Database Connection"
        if remote_port == 6379:
            return "DATABASE", "Redis In-Memory Cache"
        if remote_port == 27017:
            return "DATABASE", "MongoDB Cluster"

        # Dịch vụ Cloud và Code Hosting
        if any(k in host_lower for k in ["github", "githubusercontent"]):
            return "CLOUD_API", "GitHub API & Code Repository"
        if any(k in host_lower for k in ["googleapis", "google", "gstatic", "1e100"]):
            return "CLOUD_API", "Google Cloud / Workspace API"
        if any(k in host_lower for k in ["amazonaws", "aws", "s3"]):
            return "CLOUD_API", "Amazon AWS Cloud Services"
        if any(k in host_lower for k in ["azure", "microsoft"]):
            return "CLOUD_API", "Microsoft Azure Cloud Services"
        if any(k in host_lower for k in ["cloudflare", "workers"]):
            return "CLOUD_API", "Cloudflare CDN & Edge Proxy"

        # Microservice và IPC cục bộ
        if ip_str in ["127.0.0.1", "0.0.0.0", "::1", "localhost"] or "localhost" in host_lower:
            if remote_port == 14200:
                return "LOCAL_SERVICE", "Compute Studio Daemon (:14200)"
            if remote_port in [5000, 5001]:
                return "LOCAL_SERVICE", "Local MLflow / Flask Server"
            if remote_port in [3000, 5173, 8080]:
                return "LOCAL_SERVICE", "Local Web / Dev Server"
            return "LOCAL_SERVICE", f"Local IPC / Microservice (:{remote_port})"

        # Lưu lượng Web / REST API tiêu chuẩn
        if remote_port == 443:
            return "HTTPS_API", "Secure HTTPS REST / Web API"
        if remote_port == 80:
            return "HTTP_API", "Standard HTTP Web Traffic"

        return "UNKNOWN", f"Outbound Socket (:{remote_port})"

    def _get_connections_via_psutil(self, target_pid: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Truy vấn danh sách kết nối mạng thông qua thư viện psutil.

        Args:
            target_pid: PID tiến trình cụ thể (tùy chọn).

        Returns:
            Danh sách dictionary mô tả kết nối thô.
        """
        results: List[Dict[str, Any]] = []
        try:
            if target_pid:
                proc = psutil.Process(target_pid)
                conns_fn = getattr(proc, "net_connections", None) or getattr(proc, "connections", None)
                conns = conns_fn(kind="inet") if conns_fn else []
            else:
                conns = psutil.net_connections(kind="inet")

            for c in conns:
                l_ip = getattr(c.laddr, "ip", "") if c.laddr else ""
                l_port = getattr(c.laddr, "port", 0) if c.laddr else 0
                if not l_ip and isinstance(c.laddr, (tuple, list)) and len(c.laddr) >= 2:
                    l_ip, l_port = c.laddr[0], c.laddr[1]

                r_ip = getattr(c.raddr, "ip", None) if c.raddr else None
                r_port = getattr(c.raddr, "port", None) if c.raddr else None
                if not r_ip and isinstance(c.raddr, (tuple, list)) and len(c.raddr) >= 2:
                    r_ip, r_port = c.raddr[0], c.raddr[1]

                results.append({
                    "pid": c.pid or (target_pid or 0),
                    "protocol": "TCP" if c.type == socket.SOCK_STREAM else "UDP",
                    "local_ip": str(l_ip or "0.0.0.0"),
                    "local_port": int(l_port or 0),
                    "remote_ip": str(r_ip) if r_ip else None,
                    "remote_port": int(r_port) if r_port else None,
                    "status": str(c.status or "NONE"),
                })
        except Exception:
            # Fallback nếu psutil bị chặn quyền truy cập cấp thấp
            pass
        return results

    def _get_connections_via_netstat(self, target_pid: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Cơ chế dự phòng: phân tích output của lệnh `netstat -ano` trên Windows
        khi psutil bị giới hạn bởi quyền hạn tài khoản.

        Args:
            target_pid: PID tiến trình cần lọc (tùy chọn).

        Returns:
            Danh sách kết nối được phân tích cú pháp từ netstat.
        """
        results: List[Dict[str, Any]] = []
        try:
            cmd = ["netstat", "-ano"]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=2.0)
            if res.returncode != 0 or not res.stdout:
                return results

            lines = res.stdout.splitlines()
            for line in lines:
                parts = line.strip().split()
                if len(parts) >= 4 and parts[0] in ["TCP", "UDP"]:
                    proto = parts[0]
                    local_str = parts[1]
                    foreign_str = parts[2]
                    state = parts[3] if proto == "TCP" and len(parts) >= 5 else "LISTEN"
                    pid_str = parts[-1]

                    try:
                        c_pid = int(pid_str)
                    except ValueError:
                        continue

                    if target_pid and c_pid != target_pid:
                        continue

                    def parse_addr(addr: str):
                        if ":" in addr:
                            idx = addr.rfind(":")
                            return addr[:idx], int(addr[idx+1:])
                        return addr, 0

                    l_ip, l_port = parse_addr(local_str)
                    r_ip, r_port = parse_addr(foreign_str)
                    if foreign_str == "*:*" or r_ip in ["0.0.0.0", "*"]:
                        r_ip, r_port = None, None

                    results.append({
                        "pid": c_pid,
                        "protocol": proto,
                        "local_ip": l_ip,
                        "local_port": l_port,
                        "remote_ip": r_ip,
                        "remote_port": r_port,
                        "status": state,
                    })
        except Exception:
            pass
        return results

    def _collect_connections(self, target_pid: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Thu thập kết nối: Ưu tiên psutil, tự động fallback sang netstat nếu psutil không có quyền.

        Args:
            target_pid: PID tiến trình cần truy vấn (tùy chọn).

        Returns:
            Danh sách kết nối mạng thu thập được.
        """
        conns = self._get_connections_via_psutil(target_pid)
        if not conns:
            conns = self._get_connections_via_netstat(target_pid)
        return conns

    def get_process_network_profile(self, pid: int) -> ProcessNetworkProfile:
        """
        Thu thập toàn bộ thông tin socket, điểm cuối API và hostname mà tiến trình đang gọi tới.

        Args:
            pid: Định danh tiến trình mục tiêu.

        Returns:
            Hồ sơ mạng ProcessNetworkProfile hoàn chỉnh.
        """
        pname = f"Process {pid}"
        try:
            proc = psutil.Process(pid)
            pname = proc.name()
        except Exception:
            pass

        raw_conns = self._collect_connections(target_pid=pid)
        listening_ports: List[int] = []
        outbound_connections: List[SocketConnectionItem] = []
        domains_contacted = set()
        categories = set()

        for c in raw_conns:
            status = c["status"].upper()
            if status == "LISTEN" or not c["remote_ip"]:
                if c["local_port"] > 0:
                    listening_ports.append(c["local_port"])
            else:
                remote_ip = c["remote_ip"]
                remote_port = c["remote_port"]
                remote_host = self._resolve_ip(remote_ip) if remote_ip else "unknown"
                category, desc = self._classify_service(remote_ip, remote_port, remote_host)
                target_url = self._build_target_url(remote_host, remote_ip, remote_port, category)

                domains_contacted.add(remote_host)
                categories.add(category)

                outbound_connections.append(
                    SocketConnectionItem(
                        protocol=c["protocol"],
                        local_ip=c["local_ip"],
                        local_port=c["local_port"],
                        remote_ip=remote_ip,
                        remote_port=remote_port,
                        remote_host=remote_host,
                        url=target_url,
                        status=status,
                        category=category,
                        description=desc,
                    )
                )

        return ProcessNetworkProfile(
            pid=pid,
            name=pname,
            total_connections=len(raw_conns),
            listening_ports=sorted(list(set(listening_ports))),
            outbound_connections=outbound_connections,
            domains_contacted=sorted(list(domains_contacted)),
            categories=sorted(list(categories)),
        )

    def get_system_network_summary(self) -> SystemNetworkSummary:
        """
        Tổng hợp lưu lượng kết nối API và Socket của toàn bộ hệ thống.

        Returns:
            Báo cáo SystemNetworkSummary với danh sách top domain và top tiến trình.
        """
        all_conns = self._collect_connections()
        pid_map: Dict[int, List[Dict[str, Any]]] = {}
        domain_counts: Dict[str, int] = {}

        for c in all_conns:
            pid = c["pid"]
            if pid > 0:
                pid_map.setdefault(pid, []).append(c)

            if c["remote_ip"]:
                host = self._resolve_ip(c["remote_ip"])
                domain_counts[host] = domain_counts.get(host, 0) + 1

        top_domains = [
            {"domain": domain, "connections": count}
            for domain, count in sorted(domain_counts.items(), key=lambda x: x[1], reverse=True)[:12]
        ]

        top_processes = []
        for pid, conns in sorted(pid_map.items(), key=lambda x: len(x[1]), reverse=True)[:15]:
            pname = f"PID {pid}"
            try:
                pname = psutil.Process(pid).name()
            except Exception:
                pass

            outbound_count = sum(1 for c in conns if c.get("remote_ip"))
            listening_count = sum(1 for c in conns if c.get("status") == "LISTEN")

            top_processes.append({
                "pid": pid,
                "name": pname,
                "total_sockets": len(conns),
                "outbound_apis": outbound_count,
                "listening": listening_count,
            })

        return SystemNetworkSummary(
            total_active_connections=len(all_conns),
            monitored_processes_count=len(pid_map),
            top_domains=top_domains,
            top_processes=top_processes,
        )

# Instance duy nhất của thanh tra mạng
network_inspector = NetworkInspector()
