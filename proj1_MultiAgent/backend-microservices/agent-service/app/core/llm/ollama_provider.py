import json
import os
import re
import urllib.request
import urllib.error
from typing import List, Dict, Any, Generator, Optional
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
from .base_provider import BaseLLMProvider


class _FunctionMock:
    def __init__(self, name: str, arguments: str):
        self.name = name
        self.arguments = arguments


class _ToolCallMock:
    def __init__(self, call_id: str, name: str, arguments: Dict[str, Any]):
        self.id = call_id
        self.type = "function"
        self.function = _FunctionMock(
            name=name,
            arguments=json.dumps(arguments, ensure_ascii=False),
        )


class _MessageMock:
    def __init__(self, content: str, tool_calls: Optional[List[_ToolCallMock]] = None):
        self.content = content
        self.tool_calls = tool_calls or []


class _ChoiceMock:
    def __init__(self, message: _MessageMock):
        self.message = message


class _ResponseMock:
    def __init__(self, content: str, tool_calls: Optional[List[_ToolCallMock]] = None):
        self.choices = [_ChoiceMock(_MessageMock(content, tool_calls))]


class OllamaProvider(BaseLLMProvider):
    """
    Provider kết nối tới mô hình Local LLM (Ollama) hoặc P2P Distributed Rental Node:
    - Ưu tiên định tuyến qua Distributed Service (`/api/v1/inference/execute`) nếu có Node khả dụng hoặc model thuộc dạng `rental:...`.
    - Tự động Fallback sang kết nối trực tiếp Ollama Engine (`/api/generate` & `/api/chat`).
    - Hỗ trợ ReAct / JSON Function-Calling cho các model Local (Qwen2.5-Coder, Llama3.2, DeepSeek-R1, Gemma2).
    """

    def __init__(self, model_name: str = "qwen2.5-coder:1.5b"):
        raw = model_name or "qwen2.5-coder:1.5b"
        self.target_node_id = ""
        self.rental_session_id = ""

        # Hỗ trợ định dạng: rented:<sessionId> hoặc rental:<node_id>:<model_name>
        if raw.startswith("rented:") or raw.startswith("rental:"):
            prefix = "rented:" if raw.startswith("rented:") else "rental:"
            rem = raw[len(prefix):].strip()
            self.rental_session_id = rem
            parts = rem.split(":", 1)
            if len(parts) == 2:
                self.target_node_id = parts[0].strip()
                raw = parts[1].strip()
            else:
                self.target_node_id = rem
                raw = "qwen2.5:1.5b" 

        for prefix in ("ollama/", "ollama:", "local/", "local:"):
            if raw.startswith(prefix):
                raw = raw[len(prefix):]

        self.model_name = raw.strip() or "qwen2.5-coder:1.5b"
        self.ollama_base_url = os.getenv(
            "OLLAMA_BASE_URL", "http://host.docker.internal:11434"
        ).rstrip("/")
        self.distributed_url = os.getenv(
            "DISTRIBUTED_SERVICE_URL", "http://distributed-service:5010"
        ).rstrip("/")

    def _build_tool_calling_instruction(self, tools: List[Dict[str, Any]]) -> str:
        """Tạo hướng dẫn gọi công cụ JSON nhỏ gọn cho Local LLM."""
        if not tools:
            return ""
        compact_tools = []
        for t in tools:
            fn = t.get("function", {}) if isinstance(t, dict) else {}
            if not fn.get("name"):
                continue
            props = fn.get("parameters", {}).get("properties", {})
            param_desc = {k: v.get("description", v.get("type", "string")) for k, v in props.items()}
            compact_tools.append(
                {
                    "name": fn["name"],
                    "description": fn.get("description", ""),
                    "arguments": param_desc,
                }
            )
        if not compact_tools:
            return ""

        tools_json = json.dumps(compact_tools, ensure_ascii=False)
        return (
            "\n\n[CÔNG CỤ HỖ TRỢ (FUNCTION CALLING)]\n"
            f"Danh sách công cụ của bạn: {tools_json}\n"
            "Nếu bạn CẦN gọi công cụ để lấy số liệu/tính toán/tra cứu thực tế trước khi trả lời, "
            "hãy xuất DUY NHẤT thẻ sau (không viết thêm lời giải thích trước khi có kết quả công cụ):\n"
            '<tool_call>{"name": "tên_công_cụ", "arguments": {"tham_số": "giá_trị"}}</tool_call>\n'
            "Nếu câu hỏi chỉ là trò chuyện thông thường hoặc ĐÃ CÓ kết quả công cụ ở bên dưới, "
            "TUYỆT ĐỐI KHÔNG xuất thẻ <tool_call> nữa mà hãy trả lời trực tiếp cho người dùng bằng tiếng Việt."
        )

    def _extract_prompts(
        self, messages: List[Any], tools: Optional[List[Dict[str, Any]]] = None
    ) -> tuple[str, str, int]:
        system_parts = []
        conversation_parts = []
        tool_result_count = 0

        for m in messages:
            content = (
                m.content
                if hasattr(m, "content")
                else (m.get("content", "") if isinstance(m, dict) else str(m))
            )
            role = (
                getattr(m, "role", None)
                or (m.get("role") if isinstance(m, dict) else None)
                or ""
            )
            cls_name = m.__class__.__name__

            if isinstance(m, SystemMessage) or role == "system" or cls_name == "SystemMessage":
                system_parts.append(str(content))
            elif isinstance(m, HumanMessage) or role == "user" or cls_name == "HumanMessage":
                conversation_parts.append(f"Người dùng: {content}")
            elif isinstance(m, AIMessage) or role == "assistant" or cls_name == "AIMessage":
                if content:
                    conversation_parts.append(f"Trợ lý: {content}")
            elif isinstance(m, ToolMessage) or role == "tool" or cls_name == "ToolMessage":
                tool_result_count += 1
                conversation_parts.append(f"[Kết quả thực thi Công cụ #{tool_result_count}]: {content}")
            else:
                conversation_parts.append(str(content))

        system_prompt = "\n".join(system_parts).strip()
        # Chỉ đính kèm hướng dẫn gọi tool khi chưa vượt quá 2 vòng gọi tool để tránh lặp vô hạn trên model nhỏ
        if tools and tool_result_count == 0:
            system_prompt += self._build_tool_calling_instruction(tools)
        elif tool_result_count > 0:
            conversation_parts.append(
                "Hệ thống: Bạn đã nhận được kết quả từ công cụ ở trên. "
                "Bây giờ hãy tổng hợp dữ liệu và trả lời trực tiếp, rõ ràng cho Người dùng (KHÔNG gọi lại công cụ)."
            )

        user_prompt = "\n\n".join(conversation_parts).strip()
        return system_prompt, user_prompt, tool_result_count

    def _parse_tool_calls_from_text(
        self, text: str, allowed_tools: Optional[List[Dict[str, Any]]] = None
    ) -> tuple[str, List[_ToolCallMock]]:
        """Trích xuất lệnh gọi công cụ từ thẻ <tool_call>...</tool_call> hoặc JSON block của Local LLM."""
        if not text:
            return "", []

        allowed_names = set()
        if allowed_tools:
            for t in allowed_tools:
                fn = t.get("function", {}) if isinstance(t, dict) else {}
                if fn.get("name"):
                    allowed_names.add(fn["name"])

        # Loại bỏ phần <think>...</think> của DeepSeek-R1 khi dò tìm JSON tool_call
        cleaned_for_parse = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

        tool_calls: List[_ToolCallMock] = []
        patterns = [
            r"<tool_call>\s*(\{.*?\})\s*</tool_call>",
            r"```(?:json)?\s*(\{\s*\"name\"\s*:.*?\})\s*```",
        ]

        for pat in patterns:
            matches = re.findall(pat, cleaned_for_parse, flags=re.DOTALL)
            for idx, raw_json in enumerate(matches):
                try:
                    data = json.loads(raw_json.strip())
                    fn_name = data.get("name") or data.get("tool") or data.get("tool_id")
                    args = data.get("arguments") or data.get("parameters") or data.get("args") or {}
                    if isinstance(args, str):
                        try:
                            args = json.loads(args)
                        except Exception:
                            args = {"input": args}
                    if fn_name and (not allowed_names or fn_name in allowed_names):
                        tool_calls.append(
                            _ToolCallMock(
                                call_id=f"ollama_call_{idx + 1}",
                                name=fn_name,
                                arguments=args if isinstance(args, dict) else {"input": args},
                            )
                        )
                except Exception:
                    continue
            if tool_calls:
                break

        if tool_calls:
            # Xóa thẻ <tool_call> khỏi nội dung hiển thị
            cleaned_content = re.sub(r"<tool_call>.*?</tool_call>", "", cleaned_for_parse, flags=re.DOTALL).strip()
            return cleaned_content, tool_calls

        return cleaned_for_parse or text, []

    def _call_distributed_service(
        self, prompt: str, system_prompt: str, temperature: float
    ) -> str:
        dist_urls = [
            self.distributed_url,
            "http://distributed-service:5010",
            "http://host.docker.internal:5010",
            "http://localhost:5010",
            "http://gateway-service:4000",
            "http://localhost:4000",
        ]
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "systemPrompt": system_prompt,
            "temperature": temperature,
            "nodeId": self.target_node_id,
            "stream": False,
        }
        data_bytes = json.dumps(payload).encode("utf-8")

        for base_url in dist_urls:
            for path in ("/api/v1/distributed/inference", "/api/v1/inference/execute"):
                try:
                    url = f"{base_url.rstrip('/')}{path}"
                    req = urllib.request.Request(
                        url,
                        data=data_bytes,
                        headers={"Content-Type": "application/json"},
                        method="POST",
                    )
                    with urllib.request.urlopen(req, timeout=30) as resp:
                        data = json.loads(resp.read().decode("utf-8"))
                        ans = data.get("output") or data.get("response")
                        if ans:
                            return str(ans)
                        if data.get("message") and not data.get("success"):
                            raise RuntimeError(data["message"])
                except Exception:
                    continue
        raise RuntimeError(f"Không thể kết nối tới Distributed Service ({self.target_node_id})")

    def _resolve_available_ollama_model(self) -> str:
        """Kiểm tra danh sách model đang có trong Ollama và tự động khớp tên gần nhất nếu lệch tag."""
        try:
            url = f"{self.ollama_base_url}/api/tags"
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                models = [m.get("name", "") for m in data.get("models", []) if m.get("name")]
                if not models:
                    return self.model_name
                if self.model_name in models:
                    return self.model_name
                base_prefix = self.model_name.split(":")[0].lower()
                for m in models:
                    if m.lower().startswith(base_prefix):
                        return m
                return models[0]
        except Exception:
            return self.model_name

    def _call_direct_ollama(
        self, prompt: str, system_prompt: str, temperature: float
    ) -> str:
        resolved_model = self._resolve_available_ollama_model()
        url = f"{self.ollama_base_url}/api/generate"
        payload = {
            "model": resolved_model,
            "prompt": prompt,
            "system": system_prompt,
            "stream": False,
            "options": {"temperature": temperature},
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("response", "")

    def _call_direct_ollama_stream(
        self, prompt: str, system_prompt: str, temperature: float
    ) -> Generator[str, None, None]:
        """Stream token thực tế theo thời gian thực từ Ollama API."""
        resolved_model = self._resolve_available_ollama_model()
        url = f"{self.ollama_base_url}/api/generate"
        payload = {
            "model": resolved_model,
            "prompt": prompt,
            "system": system_prompt,
            "stream": True,
            "options": {"temperature": temperature},
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            for line in resp:
                if not line:
                    continue
                try:
                    chunk = json.loads(line.decode("utf-8"))
                    token = chunk.get("response", "")
                    if token:
                        yield token
                    if chunk.get("done"):
                        break
                except Exception:
                    continue

    def _call_rental_service(self, prompt: str, system_prompt: str) -> str:
        """Gọi tới ower-service để thực thi inference trên máy trạm Seller đã thuê qua P2P Relay."""
        owner_urls = [
            os.getenv("OWNER_SERVICE_URL", "http://ower-service:5012").rstrip("/"),
            "http://host.docker.internal:5012",
            "http://localhost:5012",
            "http://127.0.0.1:5012",
            "http://gateway-service:4000",
            "http://localhost:4000",
        ]
        payload = {
            "rentalId": self.rental_session_id,
            "rentalSessionId": self.rental_session_id,
            "prompt": prompt,
            "systemPrompt": system_prompt,
        }
        data_bytes = json.dumps(payload).encode("utf-8")

        for base_url in owner_urls:
            try:
                target_url = f"{base_url}/api/v1/owner/agents/inference"
                req = urllib.request.Request(
                    target_url,
                    data=data_bytes,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=25) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                    if resp_data.get("success") and resp_data.get("output"):
                        return resp_data["output"]
                    if resp_data.get("message"):
                        raise RuntimeError(resp_data["message"])
            except Exception:
                continue
        raise RuntimeError(f"Không thể kết nối tới ower-service cho phiên thuê '{self.rental_session_id}'")

    def _execute(self, messages: List[Any], temperature: float = 0.2, tools: Optional[List[Dict[str, Any]]] = None) -> tuple[str, List[_ToolCallMock]]:
        system_prompt, user_prompt, tool_result_count = self._extract_prompts(messages, tools=tools)

        raw_text = ""
        # 1. Nếu có phiên thuê từ máy Seller -> Gọi ower-service P2P Relay
        if self.rental_session_id:
            try:
                raw_text = self._call_rental_service(user_prompt, system_prompt)
            except Exception as rent_err:
                print(f"[OllamaProvider] Rental node '{self.rental_session_id}' fallback: {rent_err}")

        # 2. Thử gọi qua Distributed Service (P2P Worker Node)
        if not raw_text:
            try:
                raw_text = self._call_distributed_service(user_prompt, system_prompt, temperature)
            except Exception as dist_err:
                if self.target_node_id:
                    print(
                        f"[OllamaProvider] Node thuê '{self.target_node_id}' không phản hồi ({dist_err}), chuyển sang Local Ollama..."
                    )
                else:
                    print(
                        f"[OllamaProvider] Distributed route fallback -> direct Ollama ({dist_err})"
                    )

        # 2. Fallback gọi trực tiếp tới Ollama trên máy chủ/máy cá nhân
        if not raw_text:
            try:
                raw_text = self._call_direct_ollama(user_prompt, system_prompt, temperature)
            except Exception as ollama_err:
                raise RuntimeError(
                    f"Không thể kết nối tới Local LLM '{self.model_name}' "
                    f"(Ollama URL: {self.ollama_base_url}). Chi tiết: {ollama_err}"
                )

        if tools and tool_result_count == 0:
            cleaned_text, parsed_calls = self._parse_tool_calls_from_text(raw_text, allowed_tools=tools)
            return cleaned_text, parsed_calls

        # Làm sạch thẻ <think> nếu có trên DeepSeek-R1
        cleaned_final = re.sub(r"<think>.*?</think>", "", raw_text, flags=re.DOTALL).strip()
        return cleaned_final or raw_text, []

    def generate_text(
        self, prompt: str, system_prompt: Optional[str] = None, temperature: float = 0.7
    ) -> str:
        messages: List[Any] = []
        if system_prompt:
            messages.append(SystemMessage(content=system_prompt))
        messages.append(HumanMessage(content=prompt))
        text, _ = self._execute(messages, temperature=temperature)
        return text

    def chat_completion(
        self,
        messages: List[Any],
        temperature: float = 0.2,
        tools: Optional[List[Dict[str, Any]]] = None,
        **kwargs,
    ) -> Any:
        text, tool_calls = self._execute(messages, temperature=temperature, tools=tools)
        return _ResponseMock(content=text, tool_calls=tool_calls)

    def stream_chat_completion(
        self,
        messages: List[Any],
        temperature: float = 0.2,
        tools: Optional[List[Dict[str, Any]]] = None,
        **kwargs,
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Streaming token và tool calls tương thích chuẩn AgentRunner và SSE UI.
        - Nếu có tool calling hoặc qua Rental Relay: thực thi phân tích cấu trúc tool_calls.
        - Nếu gọi Ollama trực tiếp không kèm tool: stream token thực tế theo thời gian thực.
        """
        # Nếu có tools hoặc chạy qua node thuê/distributed -> thực thi qua _execute và bóc tách tool calls
        if tools or self.rental_session_id or self.target_node_id:
            text, tool_calls = self._execute(messages, temperature=temperature, tools=tools)
            if tool_calls:
                yield {"type": "tool_calls", "tool_calls": tool_calls}
                return

            chunk_size = 12
            for i in range(0, len(text), chunk_size):
                yield {"type": "token", "content": text[i : i + chunk_size]}
            return

        # Gọi trực tiếp Ollama cục bộ: stream token theo thời gian thực
        try:
            system_prompt, user_prompt, _ = self._extract_prompts(messages, tools=None)
            for token in self._call_direct_ollama_stream(user_prompt, system_prompt, temperature):
                yield {"type": "token", "content": token}
        except Exception:
            # Fallback sang execute thông thường và chunking
            text, _ = self._execute(messages, temperature=temperature, tools=None)
            chunk_size = 12
            for i in range(0, len(text), chunk_size):
                yield {"type": "token", "content": text[i : i + chunk_size]}
