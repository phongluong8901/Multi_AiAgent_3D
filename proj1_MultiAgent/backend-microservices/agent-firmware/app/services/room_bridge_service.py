import json
import time
from typing import Any, AsyncGenerator, Dict, List
from app.core.database import SessionLocal
from app.patterns.transport_strategy import TransportStrategyRegistry
from app.repositories.history_repository import history_repository
from app.services.orchestrator_engine import (
    simulate_robot_command_logic,
    stream_room_firmware_interaction,
)
from app.schemas.interaction import RobotCommandRequest, RoomFirmwareStreamRequest


class RoomBridgeService:
    """
    Service Layer điều phối giao tiếp Thực ↔ Ảo giữa Mạch Firmware (ESP32/ESP32-S3) và Room Multi-Agent,
    đồng thời tự động ghi lưu lịch sử hội thoại, hành động động cơ và độ trễ vào Neon PostgreSQL.
    """

    async def stream_and_persist(
        self,
        req: RoomFirmwareStreamRequest,
    ) -> AsyncGenerator[str, None]:
        start_ts = time.perf_counter()
        strategy = TransportStrategyRegistry.get(req.transport_protocol)

        delegation_steps: List[Dict[str, Any]] = []
        hardware_actions: List[Dict[str, Any]] = []
        sub_agents_used: List[str] = []
        agent_thought = ""
        spoken_response = ""

        async for raw_sse in stream_room_firmware_interaction(req):
            if raw_sse.startswith("data:"):
                try:
                    ev = json.loads(raw_sse[5:].strip())
                    ev_type = ev.get("type")
                    if ev_type in ("agent_step", "tool_start", "tool_end"):
                        delegation_steps.append(ev)
                    elif ev_type == "action":
                        hardware_actions.append(ev)
                    elif ev_type == "token":
                        ev = strategy.enrich_token_event(
                            ev,
                            room_id=req.room_id,
                            device_id=req.device_id,
                            seq_id=ev.get("seq_id", 1),
                            total_chunks=ev.get("total_chunks", 1),
                        )
                        raw_sse = f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
                    elif ev_type == "done":
                        spoken_response = ev.get("response_message", "")
                        agent_thought = ev.get("agent_thought", "")
                        sub_agents_used = ev.get("sub_agents_used", req.sub_agents)
                except Exception:
                    pass
            yield raw_sse

        latency_ms = int((time.perf_counter() - start_ts) * 1000)
        db = SessionLocal()
        try:
            history_repository.create_interaction_log(
                db,
                device_id=req.device_id,
                device_name=req.device_name,
                board_type=req.board_type,
                room_id=req.room_id,
                lead_agent_id=req.agent_id,
                sub_agents_used=sub_agents_used or req.sub_agents,
                connection_type=req.connection_type,
                transport_protocol=req.transport_protocol,
                user_prompt=req.prompt,
                agent_thought=agent_thought,
                delegation_steps=delegation_steps,
                spoken_response=spoken_response,
                hardware_actions=hardware_actions,
                obstacle_distance_cm=req.obstacle_distance,
                synced_to_room=req.sync_to_room_chat,
                latency_ms=latency_ms,
            )
            history_repository.create_telemetry_log(
                db,
                device_id=req.device_id,
                board_type=req.board_type,
                room_id=req.room_id,
                obstacle_distance_cm=req.obstacle_distance,
                pos_x=req.current_x,
                pos_z=req.current_z,
                rotation_deg=req.current_rotation,
            )
        except Exception as exc:
            print(f"[agent-firmware DB] Warning: Could not save interaction log: {exc}")
        finally:
            db.close()

    async def simulate_and_persist(self, req: RobotCommandRequest) -> Dict[str, Any]:
        start_ts = time.perf_counter()
        result = await simulate_robot_command_logic(req)
        latency_ms = int((time.perf_counter() - start_ts) * 1000)

        db = SessionLocal()
        try:
            history_repository.create_interaction_log(
                db,
                device_id=req.device_id,
                device_name=f"Robot {req.board_type.upper()}",
                board_type=req.board_type,
                room_id=req.room_id or "default_room",
                lead_agent_id=req.agent_id,
                sub_agents_used=["agent_search", "agent_analysis"],
                connection_type=req.connection_type,
                transport_protocol=req.transport_protocol,
                user_prompt=req.prompt,
                agent_thought=result.get("agent_thought", ""),
                delegation_steps=[],
                spoken_response=result.get("response_message", ""),
                hardware_actions=result.get("actions", []),
                obstacle_distance_cm=req.obstacle_distance,
                synced_to_room=bool(req.room_id),
                latency_ms=latency_ms,
            )
        except Exception as exc:
            print(f"[agent-firmware DB] Warning: Could not save simulate log: {exc}")
        finally:
            db.close()

        return result


room_bridge_service = RoomBridgeService()
