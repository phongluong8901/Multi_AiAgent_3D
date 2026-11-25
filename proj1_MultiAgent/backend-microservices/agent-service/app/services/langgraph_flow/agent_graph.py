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
    step_count: int = 0
    on_chunk: Any = None
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

    @staticmethod
    def _synthesize_from_tool_messages(messages: List[Any]) -> str:
        """Tổng hợp kết quả trực tiếp từ ToolMessage nếu LLM gặp sự cố kết nối ở lượt tổng hợp."""
        for msg in reversed(messages):
            if isinstance(msg, ToolMessage) or getattr(msg, "type", "") == "tool":
                raw = str(getattr(msg, "content", "") or "").strip()
                if not raw:
                    continue
                try:
                    data = json.loads(raw)
                    if isinstance(data, dict):
                        lines: List[str] = ["Dưới đây là thông tin tra cứu mới nhất:"]
                        if data.get("ai_answer"):
                            lines.append(f"\n**Tổng hợp nhanh:** {data['ai_answer']}")
                        results = data.get("results")
                        if isinstance(results, list) and results:
                            lines.append("\n**Chi tiết từ các nguồn:**")
                            for item in results[:4]:
                                if isinstance(item, dict):
                                    title = item.get("title") or "Nguồn tin"
                                    snippet = str(item.get("snippet") or item.get("content") or "").strip()
                                    url = item.get("url") or item.get("link") or ""
                                    if len(snippet) > 350:
                                        snippet = snippet[:350] + "..."
                                    src = f" ([Nguồn]({url}))" if url else ""
                                    lines.append(f"- **{title}**: {snippet}{src}")
                        return "\n".join(lines)
                except Exception:
                    pass
                return raw[:1500]
        return ""

    def call_model(self, state: AgentState) -> Dict[str, Any]:
        """Node 1: Gửi messages hiện tại lên LLM (hỗ trợ tool calling và dynamic model)"""
        messages = state["messages"]
        tool_definitions = state["tool_definitions"]

        model = state.get("model")
        step_count = int(state.get("step_count") or 0)
        on_chunk = state.get("on_chunk")

        # Lấy client phù hợp động (Gemini, Local Ollama, hoặc Rented Seller Node)
        from app.core.llm.llm_registry import llm_registry
        client = llm_registry.get_client(model) or self.llm_client

        # Nếu đã qua ít nhất 1 vòng chạy công cụ (tools_used không rỗng), ở lượt tổng hợp kế tiếp không ép Local LLM gọi tool lặp lại nữa
        already_used_tools = bool(state.get("tools_used"))
        is_local = client.__class__.__name__ == "OllamaProvider"
        effective_tools = None if (is_local and already_used_tools) else (tool_definitions if tool_definitions else None)

        # Gọi LLM Client (đã chuẩn hóa OpenAI format, hỗ trợ agent_id, model riêng biệt và callback streaming on_chunk)
        try:
            response = client.chat_completion(
                messages=messages,
                tools=effective_tools,
                agent_id=state.get("agent_id"),
                model=model,
                on_chunk=on_chunk,
            )
            response_message = response.choices[0].message
            text_content = response_message.content or ""
            tool_calls_raw = response_message.tool_calls or []
        except Exception as llm_err:
            if is_local and self.llm_client and self.llm_client is not client:
                print(f"[WARN] [LangGraph] Local LLM timed out or unreachable ({llm_err}). Falling back to default LLM client.")
                try:
                    fallback_resp = self.llm_client.chat_completion(
                        messages=messages,
                        tools=effective_tools,
                        agent_id=state.get("agent_id"),
                        model="gemini-3.5-flash-lite",
                        on_chunk=on_chunk,
                    )
                    response_message = fallback_resp.choices[0].message
                    text_content = response_message.content or ""
                    tool_calls_raw = response_message.tool_calls or []
                    if text_content and callable(on_chunk):
                        try:
                            on_chunk(text_content, text_content)
                        except Exception:
                            pass
                except Exception:
                    text_content = self._synthesize_from_tool_messages(messages)
                    tool_calls_raw = []
                    if not text_content:
                        raise llm_err
                    if callable(on_chunk):
                        try:
                            on_chunk(text_content, text_content)
                        except Exception:
                            pass
            else:
                text_content = self._synthesize_from_tool_messages(messages)
                tool_calls_raw = []
                if not text_content:
                    raise llm_err
                if callable(on_chunk):
                    try:
                        on_chunk(text_content, text_content)
                    except Exception:
                        pass

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
        return {"messages": [ai_message], "step_count": step_count + 1}

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

            try:
                print(f"[INFO] [LangGraph] Calling tool: {tool_name} | args: {tool_args}")
            except Exception:
                pass
            tools_used.append(tool_name)

            # Thực thi tool thông qua tool_executor thực tế
            try:
                tool_result_str = self.tool_executor.execute(tool_name, tool_args)
                if tool_name in ["web_search_tool", "tavily_search_tool", "google_search_tool"]:
                    try:
                        parsed_res = json.loads(tool_result_str)
                        if isinstance(parsed_res, dict) and (parsed_res.get("success") is False or not parsed_res.get("results")):
                            tool_result_str = self.tool_executor.execute("duckduckgo_search", tool_args)
                    except Exception:
                        pass
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
        """Hàm điều kiện rẽ nhánh (Conditional Edge) có giới hạn chống lặp vô hạn"""
        messages = state["messages"]
        last_message = messages[-1]
        step_count = int(state.get("step_count") or 0)

        # Giới hạn tối đa 3 lượt gọi LLM trong 1 yêu cầu để tránh vòng lặp vô hạn
        if step_count >= 3:
            return "end"
        
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