import json
from typing import Annotated, List, Any, Dict, Optional
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage, SystemMessage
import operator

# Định nghĩa State lưu trữ trong toàn bộ quá trình chạy của Agent kế thừa BaseModel để tương thích hoàn toàn với LangGraph StateLike bound
class AgentState(BaseModel):
    messages: Annotated[List[Any], operator.add] = Field(default_factory=list)
    agent_id: str = ""
    room_id: Optional[str] = None
    model: Optional[str] = None
    tool_definitions: List[Dict[str, Any]] = Field(default_factory=list)
    tools_used: List[str] = Field(default_factory=list)
    llm_client: Any = None
    tool_executor: Any = None

    def __getitem__(self, item: str) -> Any:
        return getattr(self, item)

    def get(self, item: str, default: Any = None) -> Any:
        return getattr(self, item, default)

    model_config = {"arbitrary_types_allowed": True}

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
        last_message = messages[-1] if messages else None
        tool_calls = getattr(last_message, "tool_calls", []) or []  # LangChain AIMessage tool_calls: list of dicts
        
        new_messages = []
        tools_used = list(state.get("tools_used") or [])

        for tool_call in tool_calls:
            # LangChain format: dict {"id": ..., "name": ..., "args": {...}}
            if isinstance(tool_call, dict):
                tool_name = tool_call.get("name", "")
                tool_args = tool_call.get("args", {})
                tool_call_id = tool_call.get("id", "")
            else:
                # Fallback cho mock format cũ
                tool_name = getattr(getattr(tool_call, "function", None), "name", "") or getattr(tool_call, "name", "")
                raw_args = getattr(getattr(tool_call, "function", None), "arguments", None) or getattr(tool_call, "args", {})
                try:
                    tool_args = json.loads(raw_args) if isinstance(raw_args, str) and raw_args else (raw_args or {})
                except Exception:
                    tool_args = {"input": str(raw_args)}
                tool_call_id = getattr(tool_call, "id", "")

            print(f"[INFO] [LangGraph] Calling tool: {tool_name} | args: {tool_args}")
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