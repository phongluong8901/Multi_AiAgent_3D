import json
import os
import platform
import urllib.request
from typing import Dict, Any
from .base_tool import BaseTool


class SystemHealthTool(BaseTool):
    name = "system_health_tool"
    description = (
        "Công cụ Giám sát Sức khỏe Hệ thống Microservices & Cụm Node Phân tán (Cluster Health & Telemetry): "
        "kiểm tra trạng thái thực tế của Distributed Engine, Owner Service, Seller Service, RL Training Service "
        "và Local Ollama Engine."
    )

    def _probe_url(self, url: str, timeout: float = 2.0) -> Dict[str, Any]:
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8", errors="ignore")
                try:
                    data = json.loads(raw)
                except Exception:
                    data = {"raw": raw[:200]}
                return {"online": resp.status == 200, "status_code": resp.status, "data": data}
        except Exception as e:
            return {"online": False, "error": str(e)}

    def execute(self, arguments: Dict[str, Any]) -> str:
        try:
            dist_url = os.getenv("DISTRIBUTED_SERVICE_URL", "http://distributed-service:8083").rstrip("/")
            owner_url = os.getenv("OWER_SERVICE_URL", "http://ower-service:8084").rstrip("/")
            ollama_url = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434").rstrip("/")
            rl_url = os.getenv("RLTRAIN_SERVICE_URL", "http://rltrain-service:8001").rstrip("/")

            services = {
                "agent_service": {"online": True, "status": "healthy"},
                "distributed_cluster": self._probe_url(f"{dist_url}/api/v1/cluster/status"),
                "ower_service_rentals": self._probe_url(f"{owner_url}/api/v1/owner/rentals"),
                "ollama_local_engine": self._probe_url(f"{ollama_url}/api/tags"),
                "rltrain_service": self._probe_url(f"{rl_url}/health"),
            }

            online_count = sum(1 for v in services.values() if v.get("online"))
            return json.dumps(
                {
                    "success": True,
                    "overall_status": "HEALTHY" if online_count >= 2 else "DEGRADED",
                    "online_services": f"{online_count}/{len(services)}",
                    "host_info": {
                        "os": platform.system(),
                        "release": platform.release(),
                        "python_version": platform.python_version(),
                        "cpu_cores": os.cpu_count() or 1,
                    },
                    "microservices": services,
                },
                ensure_ascii=False,
            )
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)
