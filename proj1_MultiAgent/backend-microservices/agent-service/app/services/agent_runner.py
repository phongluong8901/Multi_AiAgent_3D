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

        # 2. Lấy system prompt từ Agent
        agent_system_prompt = "Bạn là một trợ lý ảo thông minh trong văn phòng 3D ảo."
        if agent_data.get("prompt_id"):
            from app.services.prompt_service import prompt_service
            prompt = prompt_service.get_prompt(db, agent_data["prompt_id"])
            if prompt:
                agent_system_prompt = prompt.content

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

            # Chạy graph (LangGraph sẽ tự động xử lý vòng lặp gọi tool -> phản hồi -> tổng hợp)
            final_state = self.workflow.invoke(initial_state)

            # Lấy câu trả lời cuối cùng từ tin nhắn mới nhất của AI trong state
            final_messages = final_state["messages"]
            final_answer = "Xin lỗi, tôi không thể tạo ra câu trả lời."
            
            for msg in reversed(final_messages):
                if isinstance(msg, AIMessage) and msg.content:
                    final_answer = msg.content
                    break

            tools_used = final_state.get("tools_used", [])

            # 9. Lưu assistant reply vào short memory
            memory_service.append_short_memory(agent_id, "assistant", final_answer, room_id)

            # 10. Publish event lên RabbitMQ
            publish_event(
                exchange="agent.events",
            routing_key="agent.reply",
                payload={
                    "agent_id": agent_id,
                    "room_id": room_id,
                    "answer": final_answer,
                    "used_tools": tools_used,
                },
            )

            return {
                "success": True,
                "agent_id": agent_id,
                "answer": final_answer,
                "used_tools": tools_used,
            }

        except Exception as e:
            print(f"[AgentRunner LangGraph] Error: {e}")
            return {"success": False, "error": str(e)}


agent_runner = AgentRunner()