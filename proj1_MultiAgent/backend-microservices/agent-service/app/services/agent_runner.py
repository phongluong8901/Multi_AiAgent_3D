import json
from typing import Optional
from sqlalchemy.orm import Session

from app.core.llm.llm_registry import llm_registry
from app.services.tool_executor import tool_executor
from app.services.agent_service import agent_service
from app.services.memory_service import memory_service
from app.core.rabbitmq_client import publish_event


class AgentRunner:
    def __init__(self):
        self.llm_client = llm_registry.get_client()

    def run_agent(
        self,
        db: Session,
        agent_id: str,
        user_message: str,
        room_id: Optional[str] = None,
    ) -> dict:
        """
        Chạy agent với đầy đủ context: system prompt, short memory, long memory, tools.
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

        # 5. Xây dựng tool definitions từ tools của agent
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

        # 6. Xây dựng messages: system + short memory history + user message hiện tại
        messages = [{"role": "system", "content": agent_system_prompt}]
        messages.extend(short_memory)
        messages.append({"role": "user", "content": user_message})

        # 7. Lưu user message vào short memory
        memory_service.append_short_memory(agent_id, "user", user_message, room_id)

        try:
            # 8. Gửi yêu cầu lên LLM
            response = self.llm_client.chat_completion(
                messages=messages,
                tools=tool_definitions if tool_definitions else None,
            )

            response_message = response.choices[0].message
            tool_calls = response_message.tool_calls

            # 9. Nếu LLM quyết định gọi tool
            if tool_calls:
                messages.append(response_message)

                for tool_call in tool_calls:
                    tool_name = tool_call.function.name
                    tool_args = (
                        json.loads(tool_call.function.arguments)
                        if tool_call.function.arguments
                        else {}
                    )
                    print(f"🤖 [Agent {agent_id}] Calling tool: {tool_name} | args: {tool_args}")

                    tool_result_str = tool_executor.execute(tool_name, tool_args)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "name": tool_name,
                        "content": tool_result_str,
                    })

                # 10. Gọi lại LLM để tổng hợp kết quả tool
                second_response = self.llm_client.chat_completion(messages=messages)
                final_answer = second_response.choices[0].message.content

                # 11. Lưu assistant reply vào short memory
                memory_service.append_short_memory(agent_id, "assistant", final_answer, room_id)

                # 12. Publish event lên RabbitMQ
                publish_event(
                    exchange="agent.events",
                    routing_key="agent.reply",
                    payload={
                        "agent_id": agent_id,
                        "room_id": room_id,
                        "answer": final_answer,
                        "used_tools": [tc.function.name for tc in tool_calls],
                    },
                )

                return {
                    "success": True,
                    "agent_id": agent_id,
                    "answer": final_answer,
                    "used_tools": [tc.function.name for tc in tool_calls],
                }

            # 13. Không cần tool
            final_answer = response_message.content

            # Lưu vào short memory
            memory_service.append_short_memory(agent_id, "assistant", final_answer, room_id)

            # Publish event
            publish_event(
                exchange="agent.events",
                routing_key="agent.reply",
                payload={
                    "agent_id": agent_id,
                    "room_id": room_id,
                    "answer": final_answer,
                    "used_tools": [],
                },
            )

            return {
                "success": True,
                "agent_id": agent_id,
                "answer": final_answer,
                "used_tools": [],
            }

        except Exception as e:
            print(f"[AgentRunner] Error: {e}")
            return {"success": False, "error": str(e)}


agent_runner = AgentRunner()