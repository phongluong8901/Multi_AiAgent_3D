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

    @staticmethod
    def _publish_reply(
        agent_id: str,
        agent_name: str,
        room_id: Optional[str],
        answer: str,
        tools_used: list,
        workflow_trace: Optional[dict],
        source: str,
        context: Optional[dict],
    ) -> None:
        """
        Publish phản hồi của agent lên RabbitMQ.
        - source: "mq" (được gọi qua hàng đợi) hoặc "http" (gọi trực tiếp qua REST).
          chat-service chỉ lưu/broadcast các reply có source = "mq" để tránh trùng lặp tin nhắn.
        - context: dữ liệu ngữ cảnh do chat-service gửi kèm (depth, typeChat, senderId...) được trả lại nguyên vẹn.
        """
        ctx = context or {}
        publish_event(
            exchange="agent.events",
            routing_key="agent.reply",
            payload={
                "agent_id": agent_id,
                "agentId": agent_id,
                "agent_name": agent_name,
                "agentName": agent_name,
                "room_id": room_id,
                "roomId": room_id,
                "answer": answer,
                "reply": answer,
                "content": answer,
                "used_tools": tools_used,
                "toolsUsed": tools_used,
                "workflow_trace": workflow_trace,
                "trace": workflow_trace,
                "source": source,
                "depth": ctx.get("depth", 0),
                "context": ctx,
            },
        )

    def run_agent(
        self,
        db: Session,
        agent_id: str,
        user_message: str,
        room_id: Optional[str] = None,
        source: str = "mq",
        context: Optional[dict] = None,
    ) -> dict:
        """
        Chạy agent thông qua LangGraph workflow với đầy đủ context: 
        System Prompt, Long Memory, Short Memory, và Tools.
        """
        # 1. Lấy thông tin Agent thực từ DB
        try:
            agent_data = agent_service.get_agent_by_id(db, agent_id)
        except Exception:
            error_msg = f"Agent '{agent_id}' not found"
            # Vẫn phản hồi để người dùng không phải chờ vô hạn trong chat
            self._publish_reply(
                agent_id=agent_id,
                agent_name=agent_id,
                room_id=room_id,
                answer=f"⚠️ Không tìm thấy agent '{agent_id}' trong hệ thống agent-service.",
                tools_used=[],
                workflow_trace=None,
                source=source,
                context=context,
            )
            return {"success": False, "error": error_msg}

        # 2. Lấy system prompt từ Agent kết hợp ngữ cảnh làm việc nhóm
        base_role_prompt = "Bạn là một trợ lý ảo thông minh trong văn phòng 3D ảo."
        if agent_data.get("prompt_id"):
            from app.services.prompt_service import prompt_service
            prompt = prompt_service.get_prompt(db, agent_data["prompt_id"])
            if prompt:
                base_role_prompt = prompt.content

        # Xác định danh sách các Agent thực tế đang có mặt trong phòng hiện tại
        active_room_agent_ids = []
        if context and isinstance(context, dict):
            ctx_agents = context.get("activeAgents") or context.get("room_agents") or context.get("roomAgents")
            if isinstance(ctx_agents, list):
                active_room_agent_ids = [str(a) for a in ctx_agents if a]

        if not active_room_agent_ids and room_id:
            try:
                import urllib.request
                import json
                import os
                room_svc_url = os.getenv("ROOM_SERVICE_URL", "http://room-service:5002")
                req = urllib.request.Request(f"{room_svc_url}/api/v1/rooms/user-user/{room_id}", headers={"User-Agent": "AgentService"})
                with urllib.request.urlopen(req, timeout=1.5) as resp:
                    r_json = json.loads(resp.read().decode())
                    active_room_agent_ids = r_json.get("data", {}).get("activeAgents", [])
            except Exception:
                pass

        # Lấy thông tin chi tiết của các đồng nghiệp trong phòng để xây dựng bảng năng lực
        colleagues_info = []
        if active_room_agent_ids:
            for member_agent_id in active_room_agent_ids:
                if member_agent_id == agent_id:
                    continue
                try:
                    colleague = agent_service.get_agent_by_id(db, member_agent_id)
                    colleague_name = colleague.get("name", member_agent_id)
                    colleague_tools = [t.name if hasattr(t, "name") else t.get("name", "") for t in colleague.get("tools", [])]
                    
                    role_desc = "Trợ lý hỗ trợ đa nhiệm"
                    if colleague.get("prompt_id"):
                        from app.services.prompt_service import prompt_service
                        c_prompt = prompt_service.get_prompt(db, colleague["prompt_id"])
                        if c_prompt and c_prompt.content:
                            role_desc = c_prompt.content.split("\n")[0][:100]

                    tools_str = f" [Công cụ: {', '.join(colleague_tools)}]" if colleague_tools else " [Không dùng công cụ ngoài]"
                    colleagues_info.append(f"- @{member_agent_id} ({colleague_name}): {role_desc}{tools_str}")
                except Exception:
                    colleagues_info.append(f"- @{member_agent_id}: Thành viên trong phòng")

        # Ngữ cảnh làm việc nhóm đa agent linh hoạt theo từng phòng (Autonomous Multi-Agent Room Collaboration)
        my_agent_name = agent_data.get('name', agent_id)
        if colleagues_info:
            colleagues_list_str = "\n".join(colleagues_info)
            team_collaboration_guide = (
                f"\n\n[HỆ THỐNG LÀM VIỆC NHÓM ĐA AGENT TRONG PHÒNG HIỆN TẠI]\n"
                f"Bạn có định danh là: '{agent_id}' ({my_agent_name}).\n"
                f"Danh sách các đồng nghiệp ĐANG CÓ MẶT TRONG PHÒNG NÀY:\n"
                f"{colleagues_list_str}\n\n"
                f"QUY TẮC CỘNG TÁC TỰ ĐỘNG (AUTONOMOUS HANDOFF):\n"
                f"1. Bạn CHỈ được phép bàn giao công việc cho các đồng nghiệp CÓ TÊN TRONG DANH SÁCH TRÊN bằng cú pháp @agent_id (ví dụ: '@{colleagues_info[0].split(' ')[1][1:]} hãy...'). TUYỆT ĐỐI KHÔNG gắn tag bất kỳ agent nào không có mặt trong danh sách phòng này.\n"
                f"2. Nếu bạn sở hữu công cụ phù hợp với yêu cầu của người dùng, hãy chủ động dùng công cụ để xử lý phần việc của mình trước.\n"
                f"3. Sau khi giải quyết xong phần việc của mình, nếu cần sự hỗ trợ của một đồng nghiệp trong phòng để hoàn thành mục tiêu, hãy tóm tắt kết quả của bạn và BẮT BUỘC gắn thẻ @agent_id của đồng nghiệp đó kèm yêu cầu cụ thể.\n"
                f"4. Nếu nhiệm vụ đã được xử lý xong trọn vẹn hoặc bạn là người đúc kết cuối cùng, hãy đưa ra câu trả lời chi tiết, thẩm mỹ cho người dùng và TUYỆT ĐỐI KHÔNG gắn thêm thẻ @agent nào nữa để kết thúc chu trình.\n"
                f"5. Nếu tin nhắn có tiền tố '[Bàn giao nhiệm vụ từ...]': Bạn hãy tiếp nhận dữ liệu được gửi kèm và giải quyết theo đúng chuyên môn của bạn."
            )
        else:
            team_collaboration_guide = (
                f"\n\n[NGỮ CẢNH HOẠT ĐỘNG TRONG PHÒNG]\n"
                f"Bạn có định danh là: '{agent_id}' ({my_agent_name}).\n"
                f"Hiện tại trong phòng chỉ có một mình bạn là AI Agent hoạt động.\n"
                f"Hãy tự mình tiếp nhận, sử dụng các công cụ sẵn có (nếu cần) và giải quyết trọn vẹn yêu cầu của người dùng.\n"
                f"TUYỆT ĐỐI KHÔNG gắn thẻ @agent nào khác vì không có đồng nghiệp nào khác trong phòng này."
            )

        # Lấy cấu hình và quy định riêng biệt theo từng agent (search sources, độ dài tóm tắt, model...)
        from app.core.agent_configs import get_agent_config
        agent_cfg = get_agent_config(agent_id)
        specific_guidelines = agent_cfg.get("guidelines", "")
        if specific_guidelines:
            team_collaboration_guide += (
                f"\n\n[QUY ĐỊNH VÀ CHUẨN ĐẦU RA RIÊNG CHO BẠN ({agent_cfg.get('role_name', agent_id)})]:\n"
                f"{specific_guidelines}"
            )

        # Tích hợp cấu hình Workflow của phòng (Solo / Sequential / Routing)
        workflow = {}
        if context and isinstance(context, dict):
            workflow = context.get("workflow") or {}

        if workflow and workflow.get("enabled"):
            mode = workflow.get("mode")
            if mode == "solo":
                team_collaboration_guide += (
                    "\n\n[QUY TRÌNH WORKFLOW PHÒNG: CHẠY ĐƠN LẺ (SOLO)]\n"
                    "Phòng này hiện đang cấu hình ở chế độ Chạy Đơn Lẻ. "
                    "Bạn hãy tự mình hoàn thành trọn vẹn yêu cầu và đưa ra câu trả lời cuối cùng cho người dùng. "
                    "TUYỆT ĐỐI KHÔNG gắn thẻ @agent nào khác để chuyển giao."
                )
            elif mode == "sequential":
                order = workflow.get("order", [])
                order_str = " -> ".join(["@" + str(a) for a in order]) if order else "Chuỗi tuần tự"
                team_collaboration_guide += (
                    f"\n\n[QUY TRÌNH WORKFLOW PHÒNG: TUẦN TỰ (SEQUENTIAL PIPELINE)]\n"
                    f"Thứ tự chuỗi thực thi trong phòng: {order_str}.\n"
                    "Hệ thống sẽ tự động bàn giao kết quả của bạn sang bước kế tiếp. "
                    "Bạn hãy tập trung giải quyết xuất sắc phần việc theo chuyên môn của mình."
                )
            elif mode == "routing":
                transitions = workflow.get("transitions", [])
                trans_lines = [
                    f"- @{t.get('fromAgentId')} -> @{t.get('toAgentId')}{' (' + t.get('condition') + ')' if t.get('condition') else ''}"
                    for t in transitions if isinstance(t, dict)
                ]
                trans_str = "\n".join(trans_lines) if trans_lines else "Theo quy tắc định tuyến"
                team_collaboration_guide += (
                    f"\n\n[QUY TRÌNH WORKFLOW PHÒNG: ĐỊNH TUYẾN THEO QUY TẮC (ROUTING)]\n"
                    f"Sơ đồ quy tắc chuyển tiếp của phòng:\n{trans_str}\n"
                    "Hệ thống sẽ tự động điều phối chuyển tiếp theo đúng quy tắc trên."
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
            
            # Cung cấp properties schema chính xác theo loại tool
            tool_id_lower = str(tool_id).lower()
            if "search" in tool_id_lower:
                properties = {
                    "query": {"type": "string", "description": "Từ khóa tìm kiếm thông tin trên internet (ví dụ: 'thời tiết Hà Nội hôm nay')"},
                    "input": {"type": "string", "description": "Từ khóa tìm kiếm dự phòng"}
                }
                required = ["query"]
            elif "calc" in tool_id_lower:
                properties = {
                    "expression": {"type": "string", "description": "Biểu thức toán học cần tính toán (ví dụ: '125 * 8 + 50')"},
                    "input": {"type": "string", "description": "Biểu thức toán học dự phòng"}
                }
                required = ["expression"]
            elif "crawl" in tool_id_lower:
                properties = {
                    "url": {"type": "string", "description": "Đường dẫn URL bài viết/website cần thu thập nội dung"},
                    "input": {"type": "string", "description": "Đường dẫn URL dự phòng"}
                }
                required = ["url"]
            else:
                properties = {
                    "input": {"type": "string", "description": "Nội dung đầu vào thực thi công cụ"}
                }
                required = ["input"]

            tool_definitions.append({
                "type": "function",
                "function": {
                    "name": tool_id,
                    "description": tool_desc or f"Execute {tool_name_val}",
                    "parameters": {
                        "type": "object",
                        "properties": properties,
                        "required": required,
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
            preferred_model = agent_data.get("model") or "gemini-2.5-flash-lite"
            initial_state: AgentState = {
                "messages": initial_messages,
                "agent_id": agent_id,
                "room_id": room_id,
                "model": preferred_model,
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
                            if isinstance(tc, dict):
                                tc_name = tc.get("name", "tool")
                                tc_args = tc.get("args", {})
                            else:
                                tc_name = getattr(tc, "name", None) or (tc.function.name if hasattr(tc, "function") else "tool")
                                tc_args = getattr(tc, "args", None) or (tc.function.arguments if hasattr(tc, "function") else {})
                            tool_calls_info.append({
                                "name": tc_name,
                                "args": tc_args,
                                "status": "completed",
                            })

                trace_nodes.append({
                    "id": "node_tools",
                    "name": "Tool Execution",
                    "type": "tool",
                    "status": "completed",
                    "inputs": {"tools": tools_used},
                    "outputs": {"executed": tool_calls_info if tool_calls_info else tools_used},
                    "latencyMs": 150,
                })

            # Lấy câu trả lời cuối cùng từ tin nhắn mới nhất của AI trong state
            final_answer = "Xin lỗi, tôi không thể tạo ra câu trả lời."
            for msg in reversed(final_messages):
                if isinstance(msg, AIMessage) and msg.content:
                    content = msg.content
                    if isinstance(content, list):
                        # Gemini có thể trả về content dạng list các part -> ghép lại thành text
                        content = "".join(
                            part.get("text", "") if isinstance(part, dict) else str(part)
                            for part in content
                        )
                    if str(content).strip():
                        final_answer = str(content)
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
            self._publish_reply(
                agent_id=agent_id,
                agent_name=agent_data.get("name", agent_id),
                room_id=room_id,
                answer=final_answer,
                tools_used=tools_used,
                workflow_trace=workflow_trace,
                source=source,
                context=context,
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
            error_answer = f"⚠️ [Lỗi Thực Thi Workflow]: Gặp sự cố tại node xử lý: {error_msg}"
            self._publish_reply(
                agent_id=agent_id,
                agent_name=agent_data.get("name", agent_id),
                room_id=room_id,
                answer=error_answer,
                tools_used=[],
                workflow_trace=error_trace,
                source=source,
                context=context,
            )

            return {
                "success": False,
                "error": error_msg,
                "answer": error_answer,
                "workflow_trace": error_trace,
            }


agent_runner = AgentRunner()