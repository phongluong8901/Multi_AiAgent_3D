from langchain_core.messages import AIMessage
from typing import Optional
from sqlalchemy.orm import Session
from langchain_core.messages import SystemMessage, HumanMessage

from app.core.llm.llm_registry import llm_registry
from app.services.tool_executor import tool_executor
from app.services.agent_service import agent_service
from app.services.memory_service import memory_service
from app.core.rabbitmq_client import publish_event
from app.services.langgraph_flow.agent_graph import AgentWorkflow, AgentState


class AgentRunner:
    def __init__(self):
        self.llm_client = llm_registry.get_client()
        # Khởi tạo và biên dịch sẵn LangGraph Workflow
        self.workflow = AgentWorkflow(self.llm_client, tool_executor).compile()

    def run_agent(
        self,
        db: Session,
        agent_id: str,
        user_message: str,
        room_id: Optional[str] = None,
    ) -> dict:
        """
        Chạy agent thông qua LangGraph workflow với đầy đủ context: 
        System Prompt, Long Memory, Short Memory, và Tools.
        """
        # 1. Lấy thông tin Agent thực từ DB
        try:
            agent_data = agent_service.get_agent_by_id(db, agent_id)
        except Exception:
            return {"success": False, "error": f"Agent '{agent_id}' not found"}

        # 2. Lấy system prompt từ Agent kết hợp ngữ cảnh làm việc nhóm
        base_role_prompt = "Bạn là một trợ lý ảo thông minh trong văn phòng 3D ảo."
        if agent_data.get("prompt_id"):
            from app.services.prompt_service import prompt_service
            prompt = prompt_service.get_prompt(db, agent_data["prompt_id"])
            if prompt:
                base_role_prompt = prompt.content

        # Ngữ cảnh làm việc nhóm đa agent (Multi-Agent Team Collaboration)
        team_collaboration_guide = (
            "\n\n[HỆ THỐNG LÀM VIỆC NHÓM ĐA AGENT]\n"
            "Bạn đang làm việc trong một nhóm AI Agent tại không gian văn phòng ảo 3D. Các đồng nghiệp gồm:\n"
            "- agent_manager (Manager Agent): Quản lý luồng, phân rã mục tiêu và điều phối công việc.\n"
            "- agent_ml (ML Expert): Xử lý mô hình học máy, phân tích thuật toán, tính toán.\n"
            "- agent_analyst (Data Analyst): Chuyên gia phân tích dữ liệu, cấu trúc hệ thống, thống kê.\n"
            "- agent_search (Search Expert): Tra cứu web, tài liệu và dữ liệu trực tuyến.\n"
            "- agent_summarizer (Summarizer Agent): Tóm tắt nội dung, tổng hợp báo cáo và cô đọng ngữ cảnh.\n\n"
            "NGUYÊN TẮC PHỐI HỢP NHÓM:\n"
            "1. Nhiều người dùng trong phòng có thể cùng giao việc hoặc ra lệnh chéo cho bạn và các Agent khác.\n"
            "2. Khi hoàn thành phần việc của mình hoặc cần sự hỗ trợ chuyên môn, bạn có thể chuyển giao công việc "
            "bằng cách gắn tag @agent_id của đồng nghiệp (ví dụ: '@agent_analyst hãy phân tích số liệu này', '@agent_search hãy tra cứu thêm...').\n"
            "3. Trả lời súc tích, hợp tác chặt chẽ và chuyên nghiệp."
        )

        agent_system_prompt = f"{base_role_prompt}{team_collaboration_guide}"

        # 3. Lấy Long Memory và inject vào system prompt
        long_memories = memory_service.get_long_memories(db, agent_id, room_id, limit=10)
        memory_context = memory_service.format_long_memories_as_context(long_memories)
        if memory_context:
            agent_system_prompt = f"{agent_system_prompt}\n\n{memory_context}"

        # 4. Lấy Short Memory (conversation history) từ Redis
        short_memory = memory_service.get_short_memory(agent_id, room_id)

        # 5. Xây dựng tool definitions
        tool_definitions = []
        agent_tools = agent_data.get("tools", [])
        for tool in agent_tools:
            tool_id = tool.id if hasattr(tool, "id") else tool.get("id", "")
            tool_name_val = tool.name if hasattr(tool, "name") else tool.get("name", "")
            tool_desc = tool.description if hasattr(tool, "description") else tool.get("description", "")
            tool_definitions.append({
                "type": "function",
                "function": {
                    "name": tool_id,
                    "description": tool_desc or f"Execute {tool_name_val}",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "input": {"type": "string", "description": "Input cho tool"}
                        },
                        "required": ["input"],
                    },
                },
            })

        # 6. Xây dựng danh sách messages ban đầu
        initial_messages = [SystemMessage(content=agent_system_prompt)]
        
        # Chuyển đổi lịch sử short_memory từ dict sang langchain message objects
        for m in short_memory:
            role = m.get("role")
            content = m.get("content", "")
            if role == "user":
                initial_messages.append(HumanMessage(content=content))
            elif role == "assistant":
                initial_messages.append(AIMessage(content=content))

        # Thêm tin nhắn hiện tại của user
        initial_messages.append(HumanMessage(content=user_message))

        # 7. Lưu user message vào short memory redis
        memory_service.append_short_memory(agent_id, "user", user_message, room_id)

        import time
        from datetime import datetime
        import traceback

        start_time = time.time()
        trace_id = f"trace_{int(start_time * 1000)}"

        # Khởi tạo cây thực thi Workflow Trace (Tương tự LangSmith / LangGraph Studio)
        trace_nodes = [
            {
                "id": "node_input",
                "name": "User Input",
                "type": "input",
                "status": "completed",
                "inputs": {"message": user_message},
                "outputs": {"prompt": user_message},
                "latencyMs": 5,
            },
            {
                "id": "node_context",
                "name": "Memory & Context Retrieval",
                "type": "retriever",
                "status": "completed",
                "inputs": {"agentId": agent_id, "roomId": room_id},
                "outputs": {
                    "shortMemoryTurns": len(short_memory),
                    "longMemoryCount": len(long_memories),
                    "systemPromptLength": len(agent_system_prompt),
                },
                "latencyMs": 20,
            },
        ]

        try:
            # 8. Khởi tạo State và thực thi LangGraph
            initial_state: AgentState = {
                "messages": initial_messages,
                "agent_id": agent_id,
                "room_id": room_id,
                "tool_definitions": tool_definitions,
                "tools_used": [],
                "llm_client": self.llm_client,
                "tool_executor": tool_executor
            }

            llm_start_time = time.time()

            # Chạy graph (LangGraph sẽ tự động xử lý vòng lặp gọi tool -> phản hồi -> tổng hợp)
            final_state = self.workflow.invoke(initial_state)
            llm_latency_ms = round((time.time() - llm_start_time) * 1000, 2)

            # Phân tích các bước thực thi trong graph
            final_messages = final_state["messages"]
            tools_used = final_state.get("tools_used", [])

            # Ghi nhận node LLM Reasoning
            trace_nodes.append({
                "id": "node_llm",
                "name": "LLM Reasoning (Gemini / LangGraph)",
                "type": "llm",
                "status": "completed",
                "inputs": {
                    "messagesCount": len(initial_messages),
                    "availableTools": [t.get("function", {}).get("name") for t in tool_definitions],
                },
                "outputs": {
                    "toolsTriggered": tools_used,
                },
                "latencyMs": llm_latency_ms,
            })

            # Ghi nhận node Tool Execution nếu có công cụ được gọi
            if tools_used:
                tool_calls_info = []
                for msg in final_messages:
                    if hasattr(msg, "tool_calls") and msg.tool_calls:
                        for tc in msg.tool_calls:
                            tool_calls_info.append({
                                "name": tc.function.name if hasattr(tc, "function") else getattr(tc, "name", "tool"),
                                "args": tc.function.arguments if hasattr(tc, "function") else {},
                                "status": "completed",
                            })

                trace_nodes.append({
                    "id": "node_tools",
                    "name": "Tool Execution",
                    "type": "tool",
                    "status": "completed",
                    "inputs": {"tools": tools_used},
                    "outputs": {"executed": tool_calls_info or tools_used},
                    "latencyMs": 150,
                })

            # Lấy câu trả lời cuối cùng từ tin nhắn mới nhất của AI trong state
            final_answer = "Xin lỗi, tôi không thể tạo ra câu trả lời."
            for msg in reversed(final_messages):
                if isinstance(msg, AIMessage) and msg.content:
                    final_answer = msg.content
                    break

            # Ghi nhận node Output
            trace_nodes.append({
                "id": "node_output",
                "name": "Response Synthesis & Broadcast",
                "type": "output",
                "status": "completed",
                "inputs": {"rawContent": final_answer[:120] + "..."},
                "outputs": {"finalAnswer": final_answer},
                "latencyMs": 10,
            })

            end_time = time.time()
            total_latency = round((end_time - start_time) * 1000, 2)

            workflow_trace = {
                "traceId": trace_id,
                "agentId": agent_id,
                "agentName": agent_data.get("name", agent_id),
                "roomId": room_id,
                "userMessage": user_message,
                "status": "completed",
                "startTime": datetime.utcnow().isoformat(),
                "totalLatencyMs": total_latency,
                "error": None,
                "errorNode": None,
                "nodes": trace_nodes,
            }

            # 9. Lưu assistant reply vào short memory
            memory_service.append_short_memory(agent_id, "assistant", final_answer, room_id)

            # 10. Publish event lên RabbitMQ kèm đầy đủ workflow_trace
            publish_event(
                exchange="agent.events",
                routing_key="agent.reply",
                payload={
                    "agent_id": agent_id,
                    "agentId": agent_id,
                    "agent_name": agent_data.get("name", agent_id),
                    "agentName": agent_data.get("name", agent_id),
                    "room_id": room_id,
                    "roomId": room_id,
                    "answer": final_answer,
                    "reply": final_answer,
                    "content": final_answer,
                    "used_tools": tools_used,
                    "toolsUsed": tools_used,
                    "workflow_trace": workflow_trace,
                    "trace": workflow_trace,
                },
            )

            return {
                "success": True,
                "agent_id": agent_id,
                "agent_name": agent_data.get("name", agent_id),
                "answer": final_answer,
                "used_tools": tools_used,
                "workflow_trace": workflow_trace,
            }

        except Exception as e:
            error_msg = str(e)
            stack = traceback.format_exc()
            print(f"[AgentRunner LangGraph] Error: {error_msg}\n{stack}")

            end_time = time.time()
            # Ghi nhận node lỗi trực tiếp trên Trace để người dùng xem rõ
            trace_nodes.append({
                "id": "node_error",
                "name": "Workflow Execution Failure",
                "type": "error",
                "status": "error",
                "inputs": {"message": user_message},
                "outputs": None,
                "error": error_msg,
                "stackTrace": stack,
                "latencyMs": round((end_time - start_time) * 1000, 2),
            })

            error_trace = {
                "traceId": trace_id,
                "agentId": agent_id,
                "agentName": agent_data.get("name", agent_id),
                "roomId": room_id,
                "userMessage": user_message,
                "status": "error",
                "startTime": datetime.utcnow().isoformat(),
                "totalLatencyMs": round((end_time - start_time) * 1000, 2),
                "error": error_msg,
                "errorNode": "node_error",
                "nodes": trace_nodes,
            }

            # Vẫn phát tán trace lỗi lên RabbitMQ để Frontend mở popup chẩn đoán
            publish_event(
                exchange="agent.events",
                routing_key="agent.reply",
                payload={
                    "agent_id": agent_id,
                    "agentId": agent_id,
                    "agent_name": agent_data.get("name", agent_id),
                    "agentName": agent_data.get("name", agent_id),
                    "room_id": room_id,
                    "roomId": room_id,
                    "answer": f"⚠️ [Lỗi Thực Thi Workflow]: Gặp sự cố tại node xử lý: {error_msg}",
                    "reply": f"⚠️ [Lỗi Thực Thi Workflow]: Gặp sự cố tại node xử lý: {error_msg}",
                    "content": f"⚠️ [Lỗi Thực Thi Workflow]: Gặp sự cố tại node xử lý: {error_msg}",
                    "used_tools": [],
                    "toolsUsed": [],
                    "workflow_trace": error_trace,
                    "trace": error_trace,
                },
            )

            return {"success": False, "error": error_msg, "workflow_trace": error_trace}


agent_runner = AgentRunner()