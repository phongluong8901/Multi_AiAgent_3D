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
        self.name = name
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
        """Tạo hướng dẫn gọi công cụ có ví dụ cụ thể (Few-shot) tối ưu cho Local LLM."""
        if not tools:
            return ""
        compact_tools = []
        has_search = False
        has_calc = False
        for t in tools:
            fn = t.get("function", {}) if isinstance(t, dict) else {}
            name = fn.get("name", "")
            if not name:
                continue
            if "search" in name.lower() or "wiki" in name.lower():
                has_search = True
            if "calc" in name.lower() or "math" in name.lower():
                has_calc = True
            props = fn.get("parameters", {}).get("properties", {})
            param_desc = {k: v.get("description", v.get("type", "string")) for k, v in props.items()}
            compact_tools.append(
                {
                    "name": name,
                    "description": fn.get("description", ""),
                    "arguments": param_desc,
                }
            )
        if not compact_tools:
            return ""

        tools_json = json.dumps(compact_tools, ensure_ascii=False)
        examples = []
        if has_search:
            examples.append(
                'Người dùng: thời tiết Hà Nội hôm nay thế nào?\n'
                'Trợ lý: <tool_call>{"name": "web_search_tool", "arguments": {"query": "thời tiết Hà Nội hôm nay"}}</tool_call>'
            )
        if has_calc:
            examples.append(
                'Người dùng: tính 125 * 45 + sqrt(144)\n'
                'Trợ lý: <tool_call>{"name": "calculator_tool", "arguments": {"expression": "125 * 45 + sqrt(144)"}}</tool_call>'
            )
        examples_str = "\n\n".join(examples) if examples else ""

        return (
            "\n\n[CÔNG CỤ HỖ TRỢ (FUNCTION CALLING) - QUY TẮC BẮT BUỘC]\n"
            f"Danh sách công cụ khả dụng của bạn: {tools_json}\n\n"
            "QUY TẮC:\n"
            "1. Khi người dùng hỏi thông tin cần tra cứu dữ liệu thực tế (thời tiết, tin tức, sự kiện, giá cả, thời sự) hoặc tính toán:\n"
            "   TUYỆT ĐỐI KHÔNG từ chối rằng 'tôi không có khả năng tra cứu' hay 'tôi không có kết nối internet'.\n"
            "   Bạn BẮT BUỘC PHẢI xuất DUY NHẤT một thẻ <tool_call>.\n"
            "2. Định dạng xuất duy nhất:\n"
            '<tool_call>{"name": "tên_công_cụ", "arguments": {"tham_số": "giá_trị"}}</tool_call>\n\n'
            + (f"VÍ DỤ MẪU BẮT BUỘC:\n{examples_str}\n\n" if examples_str else "")
            + "3. Nếu đã có [Kết quả thực thi Công cụ] ở bên dưới, hãy tổng hợp dữ liệu và trả lời trực tiếp cho Người dùng bằng tiếng Việt (TUYỆT ĐỐI KHÔNG xuất lại thẻ <tool_call>)."
        )

    @staticmethod
    def _compact_tool_result(raw_content: Any) -> str:
        """Rút gọn kết quả JSON từ Tool thành văn bản súc tích (~800-1200 ký tự) để Local LLM 1.5B/3B xử lý tức thì không bị timeout."""
        text_str = str(raw_content or "").strip()
        try:
            parsed = json.loads(text_str)
            if isinstance(parsed, dict):
                lines = []
                if parsed.get("ai_answer"):
                    lines.append(f"Tóm tắt trực tiếp: {str(parsed['ai_answer'])[:500]}")
                results = parsed.get("results")
                if isinstance(results, list) and results:
                    for idx, item in enumerate(results[:3], start=1):
                        if isinstance(item, dict):
                            title = str(item.get("title") or "").strip()
                            snip = " ".join(str(item.get("snippet") or item.get("content") or "").split())[:380]
                            url = str(item.get("url") or item.get("link") or "").strip()
                            src = f" (Nguồn: {url})" if url else ""
                            lines.append(f"{idx}. {title}: {snip}{src}")
                if lines:
                    return "\n".join(lines)
        except Exception:
            pass
        return " ".join(text_str.split())[:1200]

    def _extract_prompts(
        self, messages: List[Any], tools: Optional[List[Dict[str, Any]]] = None
    ) -> tuple[str, str, int, str]:
        system_parts = []
        conversation_parts = []
        tool_parts = []
        tool_result_count = 0
        last_user_query = ""

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
                clean_msg = re.sub(r"^@[\w\-]+\s*", "", str(content).strip())
                # Bỏ qua phần nhồi dữ liệu cũ trong lịch sử short_memory nếu có
                if "[DỮ LIỆU TRA CỨU" in clean_msg:
                    clean_msg = clean_msg.split("[DỮ LIỆU TRA CỨU")[0].replace("Câu hỏi của người dùng:", "").strip()
                    clean_msg = re.sub(r"^@[\w\-]+\s*", "", clean_msg).strip()
                last_user_query = clean_msg or str(content).strip()
                conversation_parts.append(f"Người dùng: {clean_msg[:400]}")
            elif isinstance(m, AIMessage) or role == "assistant" or cls_name == "AIMessage":
                if content:
                    conversation_parts.append(f"Trợ lý: {str(content)[:400]}")
            elif isinstance(m, ToolMessage) or role == "tool" or cls_name == "ToolMessage":
                tool_result_count += 1
                compact_res = self._compact_tool_result(content)
                tool_parts.append(f"[Kết quả Công cụ #{tool_result_count}]:\n{compact_res}")
            else:
                conversation_parts.append(str(content)[:400])

        system_prompt = "\n".join(system_parts).strip()
        # Chỉ đính kèm hướng dẫn gọi tool khi chưa có kết quả công cụ
        if tools and tool_result_count == 0:
            system_prompt += self._build_tool_calling_instruction(tools)
            recent_conv = conversation_parts[-3:]
            user_prompt = "\n\n".join(recent_conv).strip()
        elif tool_result_count > 0:
            # Khi đã có kết quả từ công cụ, chỉ gửi câu hỏi hiện tại + dữ liệu đã rút gọn để Local LLM phản hồi ngay lập tức (<1s)
            tool_block = "\n\n".join(tool_parts)
            user_prompt = (
                f"Câu hỏi của người dùng: {last_user_query}\n\n"
                f"{tool_block}\n\n"
                "CHỈ THỊ: Dựa trực tiếp vào [Kết quả Công cụ] ở trên, hãy tổng hợp và trả lời đầy đủ, chính xác, "
                "rõ ràng bằng tiếng Việt cho người dùng (kèm số liệu cụ thể và nguồn nếu có)."
            )
        else:
            recent_conv = conversation_parts[-4:]
            user_prompt = "\n\n".join(recent_conv).strip()

        return system_prompt, user_prompt, tool_result_count, last_user_query

    def _parse_tool_calls_from_text(
        self,
        text: str,
        allowed_tools: Optional[List[Dict[str, Any]]] = None,
        last_user_query: str = "",
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

        # Ánh xạ bí danh công cụ (aliases) thông dụng để model nhỏ gọi đúng tool
        alias_map = {
            "duck-search": "duckduckgo_search",
            "duck_search": "duckduckgo_search",
            "ducksearch": "duckduckgo_search",
            "duckduckgo": "duckduckgo_search",
            "duckduckgo_search_tool": "duckduckgo_search",
            "web_search": "web_search_tool",
            "tavily_search": "web_search_tool",
            "google_search": "google_search_tool",
            "google_custom_search": "google_search_tool",
            "calculator": "calculator_tool",
            "calc": "calculator_tool",
            "summarizer": "summarizer_tool",
            "text_summarizer": "summarizer_tool",
            "python_sandbox": "python_sandbox_tool",
            "python_code_generator": "python_code_generator_tool",
            "financial_market": "financial_market_tool",
            "data_analysis": "data_analysis_tool",
            "csv_analyzer": "csv_analyzer_tool",
        }

        # Loại bỏ phần <think>...</think> của DeepSeek-R1 khi dò tìm JSON tool_call
        cleaned_for_parse = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

        tool_calls: List[_ToolCallMock] = []
        raw_json_candidates = []

        # 1. Trích xuất từ thẻ <tool_call>...</tool_call>
        for match in re.finditer(r"<tool_call>\s*(.*?)\s*</tool_call>", cleaned_for_parse, flags=re.DOTALL):
            raw_json_candidates.append(match.group(1))

        # 2. Nếu chưa có, trích xuất từ khối code markdown ```json ... ```
        if not raw_json_candidates:
            for match in re.finditer(r"```(?:json)?\s*(\{\s*[\"'](?:name|tool|function|tool_id)[\"'].*?\})\s*```", cleaned_for_parse, flags=re.DOTALL):
                raw_json_candidates.append(match.group(1))

        # 3. Nếu vẫn chưa có, dò tìm JSON thô dạng nhúng bất kỳ bằng JSONDecoder
        if not raw_json_candidates:
            decoder = json.JSONDecoder()
            for idx_char, ch in enumerate(cleaned_for_parse):
                if ch == "{":
                    try:
                        obj, _ = decoder.raw_decode(cleaned_for_parse[idx_char:])
                        if isinstance(obj, dict) and any(k in obj for k in ["name", "tool", "function", "tool_id"]):
                            raw_json_candidates.append(json.dumps(obj, ensure_ascii=False))
                            break
                    except Exception:
                        pass

        call_idx = 1
        for raw_json in raw_json_candidates:
            try:
                data = json.loads(raw_json.strip()) if isinstance(raw_json, str) else raw_json
                if not isinstance(data, dict):
                    continue
                fn_name = data.get("name") or data.get("tool") or data.get("tool_id") or data.get("function")
                args = data.get("arguments") or data.get("parameters") or data.get("args") or {}
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except Exception:
                        args = {"input": args}

                # Chuẩn hóa tên tool theo alias
                fn_name_lower = str(fn_name).lower() if fn_name else ""
                if fn_name_lower in alias_map:
                    mapped_name = alias_map[fn_name_lower]
                    if not allowed_names or mapped_name in allowed_names:
                        fn_name = mapped_name

                # Nếu khớp với tool trong danh sách cho phép (hoặc danh sách cho phép rỗng)
                if fn_name and (not allowed_names or fn_name in allowed_names):
                    tool_calls.append(
                        _ToolCallMock(
                            call_id=f"ollama_call_{call_idx}",
                            name=fn_name,
                            arguments=args if isinstance(args, dict) else {"input": args},
                        )
                    )
                    call_idx += 1
            except Exception:
                continue

        if tool_calls:
            # Khi đã bắt được tool_calls, trả về content rỗng để không làm bẩn lịch sử hội thoại bằng thẻ <tool_call>
            return "", tool_calls

        # --- BỘ CHẮN & KÍCH HOẠT DỰ PHÒNG THÔNG MINH (REFUSAL INTERCEPTOR) ---
        # Khi model local nhỏ (1.5B/3B) trả lời theo phản xạ từ chối (không có khả năng tra cứu, không có internet...)
        # nhưng Agent THỰC SỰ đã được gán công cụ tra cứu/tính toán -> Hệ thống tự động kích hoạt Tool giúp người dùng!
        refusal_markers = [
            "không có khả năng tra cứu",
            "không thể tra cứu",
            "không có quyền truy cập internet",
            "không có kết nối internet",
            "không thể truy cập internet",
            "không có khả năng tìm kiếm",
            "xin lỗi vì sự không tiện",
            "tôi không có khả năng",
            "tôi là mô hình ngôn ngữ",
            "tôi là một mô hình ngôn ngữ",
            "bạn có thể sử dụng công cụ tìm kiếm",
            "bạn có thể tra cứu trên",
            "không thể biết thời tiết",
            "không thể xem thời tiết",
            "đã cố gắng tìm kiếm",
            "không tìm thấy dữ liệu cụ thể",
            "tiếp tục tìm kiếm và cập nhật",
            "không có thông tin thời gian thực",
        ]
        lower_output = cleaned_for_parse.lower()
        is_refusal = any(marker in lower_output for marker in refusal_markers)

        if is_refusal and allowed_names:
            search_tool_id = next(
                (
                    name
                    for name in [
                        "duckduckgo_search",
                        "duckduckgo_search_tool",
                        "web_search_tool",
                        "tavily_search_tool",
                        "google_search_tool",
                        "wikipedia_tool",
                    ]
                    if name in allowed_names
                ),
                None,
            )
            calc_tool_id = "calculator_tool" if "calculator_tool" in allowed_names else None

            # 1. Tự động chuyển hướng sang Web Search nếu câu hỏi cần tra cứu
            if search_tool_id and last_user_query:
                clean_query = re.sub(r"^@[\w\-]+\s*", "", last_user_query).strip()
                clean_query = re.sub(r"^(xin hỏi|hãy cho biết|cho tôi biết|tìm kiếm|tra cứu)\s+", "", clean_query, flags=re.IGNORECASE).strip()
                safe_q = clean_query.encode("ascii", errors="replace").decode("ascii")
                print(f"[INFO] [OllamaProvider Interceptor] Detected refusal: Auto-triggering {search_tool_id} with query: '{safe_q}'")
                return "", [
                    _ToolCallMock(
                        call_id="interceptor_search_1",
                        name=search_tool_id,
                        arguments={"query": clean_query or last_user_query, "input": clean_query or last_user_query},
                    )
                ]

            # 2. Tự động chuyển hướng sang Calculator nếu có phép tính
            if calc_tool_id and last_user_query and any(op in last_user_query for op in ["+", "-", "*", "/", "sqrt", "tính"]):
                safe_q = last_user_query.encode("ascii", errors="replace").decode("ascii")
                print(f"[INFO] [OllamaProvider Interceptor] Auto-triggering {calc_tool_id} for expression: '{safe_q}'")
                return "", [
                    _ToolCallMock(
                        call_id="interceptor_calc_1",
                        name=calc_tool_id,
                        arguments={"expression": last_user_query, "input": last_user_query},
                    )
                ]

        return cleaned_for_parse or text, []

    def _call_distributed_service(
        self,
        prompt: str,
        system_prompt: str,
        temperature: float,
        on_chunk: Optional[Any] = None,
    ) -> str:
        dist_urls = []
        for candidate in [
            self.distributed_url,
            "http://distributed-service:5010",
            "http://host.docker.internal:5010",
            "http://localhost:5010",
        ]:
            clean_c = (candidate or "").rstrip("/")
            if clean_c and clean_c not in dist_urls:
                dist_urls.append(clean_c)

        node_id_to_send = "" if self.target_node_id.startswith("rent_") else self.target_node_id
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "systemPrompt": system_prompt,
            "temperature": temperature,
            "maxTokens": 512,
            "nodeId": node_id_to_send,
            "stream": True,
        }
        data_bytes = json.dumps(payload).encode("utf-8")

        for base_url in dist_urls:
            url = f"{base_url}/api/v1/distributed/inference"
            try:
                req = urllib.request.Request(
                    url,
                    data=data_bytes,
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "text/event-stream",
                    },
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=45) as resp:
                    content_type = resp.headers.get("Content-Type", "")
                    if "text/event-stream" in content_type:
                        chunks: List[str] = []
                        final_output = ""
                        for raw_line in resp:
                            if not raw_line:
                                continue
                            line_str = raw_line.decode("utf-8", errors="replace").strip()
                            if not line_str.startswith("data:"):
                                continue
                            json_part = line_str[5:].strip()
                            if not json_part:
                                continue
                            try:
                                evt = json.loads(json_part)
                            except Exception:
                                continue
                            if evt.get("error"):
                                raise RuntimeError(str(evt["error"]))
                            piece = evt.get("chunk") or ""
                            if piece:
                                chunks.append(piece)
                                if callable(on_chunk):
                                    try:
                                        on_chunk(piece, "".join(chunks))
                                    except Exception:
                                        pass
                            if evt.get("output") and not chunks:
                                final_output = str(evt["output"])
                            if evt.get("done"):
                                break
                        result_str = "".join(chunks) or final_output
                        if result_str:
                            return result_str
                        raise RuntimeError("Worker trả về kết quả rỗng.")
                    else:
                        data = json.loads(resp.read().decode("utf-8"))
                        ans = data.get("output") or data.get("response")
                        if ans:
                            if callable(on_chunk):
                                try:
                                    on_chunk(str(ans), str(ans))
                                except Exception:
                                    pass
                            return str(ans)
                        if data.get("message") and not data.get("success"):
                            raise RuntimeError(data["message"])
            except urllib.error.HTTPError as http_err:
                try:
                    err_body = json.loads(http_err.read().decode("utf-8", errors="ignore"))
                    msg = err_body.get("message") or err_body.get("error") or str(http_err)
                except Exception:
                    msg = str(http_err)
                raise RuntimeError(msg)
            except urllib.error.URLError as url_err:
                reason_str = str(getattr(url_err, "reason", url_err)).lower()
                if "timed out" in reason_str or "timeout" in reason_str:
                    raise RuntimeError("Quá thời gian chờ phản hồi từ Electron Worker.")
                continue
            except RuntimeError:
                raise
            except Exception as ex:
                if "timed out" in str(ex).lower() or "timeout" in str(ex).lower():
                    raise RuntimeError("Quá thời gian chờ phản hồi từ Electron Worker.")
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
            "options": {"temperature": temperature, "num_predict": 512, "num_ctx": 2048},
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=45) as resp:
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
            "options": {"temperature": temperature, "num_predict": 512, "num_ctx": 2048},
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=45) as resp:
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

    def _call_rental_service(
        self,
        prompt: str,
        system_prompt: str,
        on_chunk: Optional[Any] = None,
    ) -> str:
        """Gọi tới ower-service (hỗ trợ SSE streaming) để thực thi inference trên máy trạm Seller đã thuê qua P2P Relay."""
        owner_urls = []
        for candidate in [
            os.getenv("OWNER_SERVICE_URL", "http://ower-service:5012").rstrip("/"),
            "http://host.docker.internal:5012",
            "http://localhost:5012",
        ]:
            if candidate and candidate not in owner_urls:
                owner_urls.append(candidate)

        payload = {
            "rentalId": self.rental_session_id,
            "rentalSessionId": self.rental_session_id,
            "prompt": prompt,
            "systemPrompt": system_prompt,
        }
        data_bytes = json.dumps(payload).encode("utf-8")

        for base_url in owner_urls:
            try:
                target_url = f"{base_url}/api/v1/owner/agents/inference/stream"
                req = urllib.request.Request(
                    target_url,
                    data=data_bytes,
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "text/event-stream",
                    },
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=90) as resp:
                    chunks: List[str] = []
                    final_output = ""
                    for raw_line in resp:
                        if not raw_line:
                            continue
                        line_str = raw_line.decode("utf-8", errors="replace").strip()
                        if not line_str.startswith("data:"):
                            continue
                        json_part = line_str[5:].strip()
                        if not json_part:
                            continue
                        try:
                            evt = json.loads(json_part)
                        except Exception:
                            continue
                        if evt.get("error"):
                            raise RuntimeError(str(evt["error"]))
                        piece = evt.get("chunk") or ""
                        if piece:
                            chunks.append(piece)
                            if callable(on_chunk):
                                try:
                                    on_chunk(piece, "".join(chunks))
                                except Exception:
                                    pass
                        if evt.get("output") and not chunks:
                            final_output = str(evt["output"])
                        if evt.get("done"):
                            break
                    result_str = "".join(chunks) or final_output
                    if result_str:
                        return result_str
                    raise RuntimeError("Phiên thuê trả về kết quả rỗng.")
            except urllib.error.HTTPError as http_err:
                try:
                    err_body = json.loads(http_err.read().decode("utf-8", errors="ignore"))
                    msg = err_body.get("message") or err_body.get("error") or str(http_err)
                except Exception:
                    msg = str(http_err)
                raise RuntimeError(msg)
            except urllib.error.URLError as url_err:
                reason_str = str(getattr(url_err, "reason", url_err)).lower()
                if "timed out" in reason_str or "timeout" in reason_str:
                    raise RuntimeError("Quá thời gian chờ phản hồi từ phiên thuê Worker.")
                continue
            except RuntimeError:
                raise
            except Exception as ex:
                if "timed out" in str(ex).lower() or "timeout" in str(ex).lower():
                    raise RuntimeError("Quá thời gian chờ phản hồi từ phiên thuê Worker.")
                continue
        raise RuntimeError(f"Không thể kết nối tới ower-service cho phiên thuê '{self.rental_session_id}'")

    def _execute(
        self,
        messages: List[Any],
        temperature: float = 0.2,
        tools: Optional[List[Dict[str, Any]]] = None,
        on_chunk: Optional[Any] = None,
    ) -> tuple[str, List[_ToolCallMock]]:
        system_prompt, user_prompt, tool_result_count, last_user_query = self._extract_prompts(messages, tools=tools)

        # Ở lượt đầu tiên (tool_result_count == 0) khi Agent được trang bị công cụ tìm kiếm:
        # Phát sinh chuẩn AIMessage(tool_calls=...) để LangGraph đi qua đúng node 'tools' -> tạo ToolMessage chuẩn trên LangSmith!
        if tools and tool_result_count == 0 and last_user_query:
            allowed_names = [
                t.get("function", {}).get("name")
                for t in tools
                if isinstance(t, dict) and t.get("function", {}).get("name")
            ]
            search_tool_id = next(
                (
                    tid
                    for tid in [
                        "duckduckgo_search",
                        "duckduckgo_search_tool",
                        "web_search_tool",
                        "tavily_search_tool",
                        "google_search_tool",
                        "wikipedia_tool",
                    ]
                    if tid in allowed_names
                ),
                None,
            )
            clean_q = re.sub(r"^@[\w\-]+\s*", "", last_user_query).strip()
            q_lower = clean_q.lower()
            is_greeting = q_lower in ["hi", "hello", "xin chào", "chào", "chào bạn", "alo", "test"]
            if search_tool_id and clean_q and not is_greeting:
                search_q = (
                    re.sub(
                        r"^(xin hỏi|hãy cho biết|cho tôi biết|hãy tìm kiếm|tìm kiếm|tra cứu|hãy tra cứu)\s+",
                        "",
                        clean_q,
                        flags=re.IGNORECASE,
                    ).strip()
                    or clean_q
                )
                return "", [
                    _ToolCallMock(
                        call_id="call_search_1",
                        name=search_tool_id,
                        arguments={"query": search_q},
                    )
                ]

        def _filtered_chunk_cb(piece: str, accumulated: str):
            if not callable(on_chunk):
                return
            stripped = accumulated.lstrip()
            if stripped.startswith("<tool_call>") or stripped.startswith("{") or stripped.startswith("```json"):
                return
            clean_acc = re.sub(r"<think>.*?</think>", "", accumulated, flags=re.DOTALL)
            if "<think>" in clean_acc:
                clean_acc = clean_acc.split("<think>")[0]
            clean_acc = clean_acc.strip()
            if clean_acc:
                on_chunk(piece, clean_acc)

        raw_text = ""
        dist_reached_upstream = False
        last_error_msg = ""

        # 1. Ưu tiên gọi trực tiếp qua Distributed Service SSE Stream (kết nối thẳng tới Electron Worker, stream từng token tức thì!)
        try:
            raw_text = self._call_distributed_service(
                user_prompt,
                system_prompt,
                temperature,
                on_chunk=_filtered_chunk_cb if on_chunk else None,
            )
        except Exception as dist_err:
            err_s = str(dist_err)
            last_error_msg = err_s
            print(f"[OllamaProvider] Distributed SSE route note: {err_s}")
            if "Quá thời gian" in err_s:
                dist_reached_upstream = True

        # 2. Nếu có phiên thuê và chưa kết nối được Distributed Service -> Gọi qua ower-service P2P Relay
        if not raw_text and self.rental_session_id and not dist_reached_upstream:
            try:
                raw_text = self._call_rental_service(
                    user_prompt,
                    system_prompt,
                    on_chunk=_filtered_chunk_cb if on_chunk else None,
                )
            except Exception as rent_err:
                last_error_msg = str(rent_err)
                print(f"[OllamaProvider] Rental node '{self.rental_session_id}' fallback: {rent_err}")
                if "Quá thời gian" in str(rent_err):
                    dist_reached_upstream = True

        # 3. Fallback gọi trực tiếp tới Ollama trên máy chủ/máy cá nhân (chỉ gọi khi bước 1/2 chưa bị timeout trên cùng máy trạm)
        if not raw_text and not dist_reached_upstream:
            try:
                if callable(on_chunk):
                    acc_direct: List[str] = []
                    for tok in self._call_direct_ollama_stream(user_prompt, system_prompt, temperature):
                        acc_direct.append(tok)
                        _filtered_chunk_cb(tok, "".join(acc_direct))
                    raw_text = "".join(acc_direct)
                else:
                    raw_text = self._call_direct_ollama(user_prompt, system_prompt, temperature)
            except Exception as ollama_err:
                last_error_msg = str(ollama_err)

        if not raw_text:
            raise RuntimeError(
                f"Không thể kết nối tới Local LLM '{self.model_name}' "
                f"(Ollama URL: {self.ollama_base_url}). Chi tiết: {last_error_msg or 'timed out'}"
            )

        if tools and tool_result_count == 0:
            cleaned_text, parsed_calls = self._parse_tool_calls_from_text(raw_text, allowed_tools=tools, last_user_query=last_user_query)
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
        on_chunk = kwargs.get("on_chunk")
        text, tool_calls = self._execute(
            messages,
            temperature=temperature,
            tools=tools,
            on_chunk=on_chunk,
        )
        return _ResponseMock(content=text, tool_calls=tool_calls)

    def stream_chat_completion(
        self,
        messages: List[Any],
        temperature: float = 0.2,
        tools: Optional[List[Dict[str, Any]]] = None,
        **kwargs,
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Streaming token và tool calls theo thời gian thực từ Electron Worker / Rental Node / Local Ollama.
        """
        import queue
        import threading

        q: "queue.Queue[Optional[Dict[str, Any]]]" = queue.Queue()
        result_holder: Dict[str, Any] = {"text": "", "tool_calls": [], "error": None}
        streamed_any = [False]

        def _on_chunk_live(piece: str, _acc: str):
            if piece:
                streamed_any[0] = True
                q.put({"type": "token", "content": piece})

        def _worker():
            try:
                text, tool_calls = self._execute(
                    messages,
                    temperature=temperature,
                    tools=tools,
                    on_chunk=_on_chunk_live,
                )
                result_holder["text"] = text
                result_holder["tool_calls"] = tool_calls
            except Exception as ex:
                result_holder["error"] = ex
            finally:
                q.put(None)

        t = threading.Thread(target=_worker, daemon=True)
        t.start()

        while True:
            item = q.get()
            if item is None:
                break
            yield item

        if result_holder["error"]:
            raise result_holder["error"]

        if result_holder["tool_calls"]:
            yield {"type": "tool_calls", "tool_calls": result_holder["tool_calls"]}
            return

        if not streamed_any[0] and result_holder["text"]:
            text = result_holder["text"]
            chunk_size = 12
            for i in range(0, len(text), chunk_size):
                yield {"type": "token", "content": text[i : i + chunk_size]}