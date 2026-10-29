from abc import ABC, abstractmethod
from typing import Any, Dict


class BaseTransportStrategy(ABC):
    """Strategy Pattern chuẩn hóa cách đóng gói gói tin Stream Token & Action cho từng giao thức truyền tải."""

    protocol_name: str = "sse"

    @abstractmethod
    def enrich_token_event(
        self,
        base_event: Dict[str, Any],
        *,
        room_id: str,
        device_id: str,
        seq_id: int,
        total_chunks: int,
    ) -> Dict[str, Any]:
        pass


class SseTransportStrategy(BaseTransportStrategy):
    protocol_name = "sse"

    def enrich_token_event(
        self,
        base_event: Dict[str, Any],
        *,
        room_id: str,
        device_id: str,
        seq_id: int,
        total_chunks: int,
    ) -> Dict[str, Any]:
        return {
            **base_event,
            "transport": "sse",
            "seq_id": seq_id,
            "total_chunks": total_chunks,
        }


class WebSocketTransportStrategy(BaseTransportStrategy):
    protocol_name = "websocket"

    def enrich_token_event(
        self,
        base_event: Dict[str, Any],
        *,
        room_id: str,
        device_id: str,
        seq_id: int,
        total_chunks: int,
    ) -> Dict[str, Any]:
        return {
            **base_event,
            "transport": "websocket",
            "ws_channel": f"/api/v1/firmware/ws/{device_id}",
            "seq_id": seq_id,
            "total_chunks": total_chunks,
        }


class MqttTransportStrategy(BaseTransportStrategy):
    protocol_name = "mqtt"

    def enrich_token_event(
        self,
        base_event: Dict[str, Any],
        *,
        room_id: str,
        device_id: str,
        seq_id: int,
        total_chunks: int,
    ) -> Dict[str, Any]:
        return {
            **base_event,
            "transport": "mqtt",
            "mqtt_topic": f"multiagent/room/{room_id}/device/{device_id}/stream",
            "qos": 0,
            "seq_id": seq_id,
            "total_chunks": total_chunks,
        }


class EspNowTransportStrategy(BaseTransportStrategy):
    protocol_name = "esp_now"

    def enrich_token_event(
        self,
        base_event: Dict[str, Any],
        *,
        room_id: str,
        device_id: str,
        seq_id: int,
        total_chunks: int,
    ) -> Dict[str, Any]:
        raw_bytes = len((base_event.get("content") or "").encode("utf-8"))
        return {
            **base_event,
            "transport": "esp_now",
            "seq_id": seq_id,
            "total_chunks": total_chunks,
            "espnow_frame": {
                "seq_id": seq_id,
                "total_frames": total_chunks,
                "frame_type": 1,
                "payload_bytes": min(240, raw_bytes + 47),
            },
        }


class HttpTransportStrategy(BaseTransportStrategy):
    protocol_name = "http"

    def enrich_token_event(
        self,
        base_event: Dict[str, Any],
        *,
        room_id: str,
        device_id: str,
        seq_id: int,
        total_chunks: int,
    ) -> Dict[str, Any]:
        return {
            **base_event,
            "transport": "http",
            "seq_id": seq_id,
            "total_chunks": total_chunks,
        }


class TransportStrategyRegistry:
    """Factory/Registry lấy Strategy truyền tải tương ứng theo tên giao thức."""

    _strategies: Dict[str, BaseTransportStrategy] = {
        "sse": SseTransportStrategy(),
        "websocket": WebSocketTransportStrategy(),
        "mqtt": MqttTransportStrategy(),
        "esp_now": EspNowTransportStrategy(),
        "http": HttpTransportStrategy(),
    }

    @classmethod
    def get(cls, protocol: str) -> BaseTransportStrategy:
        return cls._strategies.get((protocol or "sse").lower(), cls._strategies["sse"])

