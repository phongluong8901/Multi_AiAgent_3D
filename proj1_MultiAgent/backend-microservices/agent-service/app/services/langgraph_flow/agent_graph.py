import json
from typing import TypedDict, Annotated, List, Any, Dict
from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage, SystemMessage
import operator

# Định nghĩa State lưu trữ trong toàn bộ quá trình chạy của Agent
class AgentState(TypedDict):
    messages: Annotated[List[Any], operator.add]
    agent_id: str
    room_id: str | None
    model: str | None
    tool_definitions: List[Dict[str, Any]]
    tools_used: List[str]
    llm_client: Any
    tool_executor: Any

class AgentWorkflow:
    def __init__(self, llm_client, tool_executor):
        self.llm_client = llm_client
        self.tool_executor = tool_executor

    def call_model(self, state: AgentState) -> Dict[str, Any]:
        """Node 1: Gửi messages hiện tại lên LLM (hỗ trợ tool calling và dynamic model)"""
        messages = state["messages"]
        tool_definitions = state["tool_definitions"]

        model = state.get("model")
        # Lấy client phù hợp động (Gemini, Local Ollama, hoặc Rented Seller Node)
        from app.core.llm.llm_registry import llm_registry
        client = llm_registry.get_client(model) or self.llm_client

        # Gọi LLM Client (đã chuẩn hóa OpenAI format, hỗ trợ agent_id và model riêng biệt)
        response = client.chat_completion(
            messages=messages,
            tools=tool_definitions if tool_definitions else None,
            agent_id=state.get("agent_id"),
            model=model,
        )
        
        response_message = response.choices[0].message
        text_content = response_message.content or ""
        tool_calls_raw = response_message.tool_calls or []

        # Chuyển đổi sang LangChain AIMessage với tool_calls đúng format
        # để agent_runner.py có thể dùng isinstance(msg, AIMessage)
        lc_tool_calls = []
        for tc in tool_calls_raw:
            args = tc.function.arguments
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except Exception:
                    args = {"input": args}
            lc_tool_calls.append({
                "id": tc.id,
                "name": tc.function.name,
                "args": args,
                "type": "tool_call",
            })

        ai_message = AIMessage(content=text_content, tool_calls=lc_tool_calls)
        return {"messages": [ai_message]}

    def execute_tools(self, state: AgentState) -> Dict[str, Any]:
        """Node 2: Thực thi các Tool mà LLM yêu cầu gọi"""
        messages = state["messages"]
        last_message = messages[-1]
        tool_calls = last_message.tool_calls  # LangChain AIMessage tool_calls: list of dicts
        
        new_messages = []
        tools_used = list(state["tools_used"])

        for tool_call in tool_calls:
            # LangChain format: dict {"id": ..., "name": ..., "args": {...}}
            if isinstance(tool_call, dict):
                tool_name = tool_call.get("name", "")
                tool_args = tool_call.get("args", {})
                tool_call_id = tool_call.get("id", "")
            else:
                # Fallback cho mock format cũ
                tool_name = tool_call.function.name
                try:
                    tool_args = json.loads(tool_call.function.arguments) if tool_call.function.arguments else {}
                except Exception:
                    tool_args = {}
                tool_call_id = tool_call.id

            print(f"🤖 [LangGraph] Calling tool: {tool_name} | args: {tool_args}")
            tools_used.append(tool_name)

            # Thực thi tool thông qua tool_executor thực tế
            try:
                tool_result_str = self.tool_executor.execute(tool_name, tool_args)
            except Exception as e:
                tool_result_str = f"Error executing tool {tool_name}: {str(e)}"

            # Đóng gói kết quả trả về dạng ToolMessage
            new_messages.append(
                ToolMessage(
                    content=str(tool_result_str),
                    tool_call_id=tool_call_id,
                )
            )

        return {
            "messages": new_messages,
            "tools_used": tools_used
        }

    def should_continue(self, state: AgentState) -> str:
        """Hàm điều kiện rẽ nhánh (Conditional Edge)"""
        messages = state["messages"]
        last_message = messages[-1]
        
        # Nếu LLM trả về yêu cầu gọi tool -> chuyển sang node "tools"
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "continue"
        
        # Ngược lại, đã có câu trả lời cuối cùng -> kết thúc graph
        return "end"

    def compile(self):
        """Biên dịch StateGraph thành một executable graph"""
        workflow = StateGraph(AgentState)

        workflow.add_node("agent", self.call_model)
        workflow.add_node("tools", self.execute_tools)

        workflow.set_entry_point("agent")

        # Thêm rẽ nhánh thông minh
        workflow.add_conditional_edges(
            "agent",
            self.should_continue,
            {
                "continue": "tools",
                "end": END
            }
        )

        # Sau khi chạy tool xong, quay lại node "agent" để LLM tổng hợp kết quả
        workflow.add_edge("tools", "agent")

        return workflow.compile()