from typing import Optional
from sqlalchemy.orm import Session
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage

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

    def _build_tool_definitions(self, agent_tools: list) -> list:
        """Xây dựng OpenAI/Gemini/Local-compatible Function Calling Schema cho tất cả công cụ."""
        tool_definitions = []
        for tool in agent_tools:
            tool_id = tool.id if hasattr(tool, "id") else tool.get("id", "")
            tool_name_val = tool.name if hasattr(tool, "name") else tool.get("name", "")
            tool_desc = tool.description if hasattr(tool, "description") else tool.get("description", "")
            tool_id_lower = str(tool_id).lower()

            if "search" in tool_id_lower or "wiki" in tool_id_lower:
                properties = {
                    "query": {"type": "string", "description": "Từ khóa tìm kiếm trên Internet hoặc Wikipedia"},
                    "lang": {"type": "string", "description": "Ngôn ngữ tra cứu ('vi' hoặc 'en', mặc định 'vi')"},
                    "input": {"type": "string", "description": "Từ khóa tìm kiếm dự phòng"},
                }
                required = ["query"]
            elif "financial" in tool_id_lower or "market" in tool_id_lower:
                properties = {
                    "action": {
                        "type": "string",
                        "description": "Loại phân tích tài chính: 'compound_interest' (lãi kép/ROI/CAGR), 'npv' (định giá dòng tiền), 'loan' (trả góp vay), hoặc 'fx' (quy đổi ngoại tệ/Crypto/Vàng)",
                    },
                    "principal": {"type": "number", "description": "Số vốn gốc / khoản vay / số tiền cần quy đổi"},
                    "rate": {"type": "number", "description": "Lãi suất năm (%) hoặc tỷ suất chiết khấu (%)"},
                    "years": {"type": "number", "description": "Số năm đầu tư hoặc vay"},
                    "monthly_contribution": {"type": "number", "description": "Số tiền gửi/đầu tư thêm hàng tháng (nếu có)"},
                    "cash_flows": {"type": "array", "items": {"type": "number"}, "description": "Dòng tiền dự kiến qua các năm (dùng cho NPV)"},
                    "from_currency": {"type": "string", "description": "Mã tiền tệ gốc (USD, VND, EUR, JPY, BTC, ETH, GOLD_OZ, SJC_TAEL)"},
                    "to_currency": {"type": "string", "description": "Mã tiền tệ đích (VND, USD, EUR...)"},
                }
                required = []
            elif "calc" in tool_id_lower:
                properties = {
                    "expression": {
                        "type": "string",
                        "description": "Biểu thức toán học/thống kê cần tính (hỗ trợ +, -, *, /, **, sqrt, sin, cos, log, mean, stdev; ví dụ: 'sqrt(144) + 125 * 8')",
                    },
                    "input": {"type": "string", "description": "Biểu thức toán học dự phòng"},
                }
                required = ["expression"]
            elif "sentiment" in tool_id_lower:
                properties = {
                    "text": {"type": "string", "description": "Đoạn văn bản, đánh giá khách hàng hoặc tin tức thị trường cần phân tích cảm xúc"},
                    "input": {"type": "string", "description": "Văn bản dự phòng"},
                }
                required = ["text"]
            elif "json" in tool_id_lower or "transformer" in tool_id_lower:
                properties = {
                    "data": {"type": "string", "description": "Chuỗi JSON cần chuyển đổi sang bảng Markdown/CSV, hoặc văn bản thô cần trích xuất Email/SĐT/URL bằng Regex"},
                    "operation": {"type": "string", "description": "Tác vụ: 'auto', 'json_to_table', hoặc 'extract' (trích xuất Regex)"},
                }
                required = ["data"]
            elif "sql" in tool_id_lower:
                properties = {
                    "task": {"type": "string", "description": "Yêu cầu thiết kế bảng Database (DDL) hoặc câu truy vấn SQL cần tối ưu"},
                    "dialect": {"type": "string", "description": "Hệ quản trị CSDL ('postgresql', 'mysql', 'sqlite')"},
                    "tables": {"type": "array", "items": {"type": "string"}, "description": "Danh sách tên bảng liên quan"},
                }
                required = ["task"]
            elif "security" in tool_id_lower or "auditor" in tool_id_lower:
                properties = {
                    "code": {"type": "string", "description": "Đoạn mã nguồn cần kiểm toán lỗ hổng bảo mật OWASP và đánh giá chất lượng"},
                    "language": {"type": "string", "description": "Ngôn ngữ lập trình ('python', 'javascript', 'sql', 'go')"},
                }
                required = ["code"]
            elif "health" in tool_id_lower or "system_control" in tool_id_lower:
                properties = {
                    "target": {"type": "string", "description": "Thành phần cần kiểm tra ('all', 'cluster', 'ollama', 'rentals')"},
                }
                required = []
            elif "summar" in tool_id_lower:
                properties = {
                    "text": {"type": "string", "description": "Văn bản, tài liệu hoặc kết quả tìm kiếm cần tóm tắt lại"},
                    "max_length": {"type": "integer", "description": "Độ dài tóm tắt mong muốn (mặc định 150 ký tự)"},
                    "input": {"type": "string", "description": "Văn bản cần tóm tắt dự phòng"},
                }
                required = ["text"]
            elif "analysis" in tool_id_lower or "analyst" in tool_id_lower:
                properties = {
                    "data": {"type": "string", "description": "Dãy số hoặc mảng số liệu cần phân tích thống kê (ví dụ: '[12, 15, 20, 25, 30]')"},
                    "input": {"type": "string", "description": "Dữ liệu phân tích dự phòng"},
                }
                required = ["data"]
            elif "ml" in tool_id_lower or "evaluator" in tool_id_lower:
                properties = {
                    "task_type": {"type": "string", "description": "Loại bài toán: 'classification', 'regression', hoặc 'recommendation'"},
                    "tp": {"type": "number", "description": "True Positives"},
                    "fp": {"type": "number", "description": "False Positives"},
                    "tn": {"type": "number", "description": "True Negatives"},
                    "fn": {"type": "number", "description": "False Negatives"},
                    "data_type": {"type": "string", "description": "Loại dữ liệu ('tabular', 'nlp', 'time_series')"},
                }
                required = ["task_type"]
            elif "plan" in tool_id_lower or "workflow" in tool_id_lower:
                properties = {
                    "goal": {"type": "string", "description": "Mục tiêu bài toán phức tạp cần phân rã thành các bước và gán cho các agent chuyên trách"},
                    "input": {"type": "string", "description": "Mục tiêu bài toán dự phòng"},
                }
                required = ["goal"]
            elif "image" in tool_id_lower or "vision" in tool_id_lower or "ocr" in tool_id_lower:
                properties = {
                    "image_url": {"type": "string", "description": "Đường dẫn URL của hình ảnh cần phân tích"},
                    "image_path": {"type": "string", "description": "Đường dẫn file ảnh trên hệ thống cục bộ"},
                    "task": {"type": "string", "description": "Tác vụ: 'all', 'ocr', hoặc 'classification'"},
                    "prompt": {"type": "string", "description": "Câu hỏi cụ thể về bức ảnh"},
                }
                required = []
            elif "csv" in tool_id_lower:
                properties = {
                    "file_url": {"type": "string", "description": "Đường dẫn URL tải file CSV"},
                    "file_path": {"type": "string", "description": "Đường dẫn file CSV trên ổ đĩa"},
                    "csv_content": {"type": "string", "description": "Nội dung chuỗi dữ liệu bảng tính CSV thô"},
                    "query": {"type": "string", "description": "Khía cạnh cần tập trung phân tích trong file CSV"},
                }
                required = []
            elif "generator" in tool_id_lower or "code_gen" in tool_id_lower:
                properties = {
                    "task": {"type": "string", "description": "Mô tả bài toán hoặc chức năng cần viết mã nguồn Python"},
                    "libraries": {"type": "array", "items": {"type": "string"}, "description": "Danh sách thư viện yêu cầu sử dụng"},
                    "include_tests": {"type": "boolean", "description": "Tự động sinh khối kiểm thử mẫu (mặc định true)"},
                }
                required = ["task"]
            elif "sandbox" in tool_id_lower or "runner" in tool_id_lower:
                properties = {
                    "code": {"type": "string", "description": "Mã nguồn Python hoàn chỉnh cần thực thi an toàn trong Sandbox"},
                    "timeout_seconds": {"type": "integer", "description": "Thời gian thực thi tối đa (1 - 30 giây, mặc định 15)"},
                }
                required = ["code"]
            else:
                properties = {
                    "input": {"type": "string", "description": "Nội dung đầu vào thực thi công cụ"},
                }
                required = ["input"]

            tool_definitions.append(
                {
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
                }
            )
        return tool_definitions

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

    def _build_room_collaboration_matrix(
        self,
        db: Session,
        agent_id: str,
        agent_data: dict,
        room_id: Optional[str] = None,
        context: Optional[dict] = None,
    ) -> str:
        """
        Xây dựng Ma trận Năng lực & Công cụ trong phòng (Room Agent & Tool Matrix)
        để Agent nhận thức chính xác:
        1. Bản thân sở hữu công cụ nào (chỉ được gọi trực tiếp công cụ của chính mình).
        2. Trong phòng hiện tại có những đồng nghiệp nào và mỗi đồng nghiệp đang sở hữu công cụ gì.
        3. Phân biệt rõ cách xử lý:
           - Bài toán đơn giản: gọi đúng 1 công cụ của mình rồi trả lời ngay.
           - Bài toán phức tạp (ví dụ Giá Vàng): làm phần việc của mình, nếu thiếu công cụ (như vẽ biểu đồ) thì kiểm tra xem trong phòng ai sở hữu công cụ đó để bàn giao.
        """
        # 1. Xác định danh sách Agent thực tế đang có mặt trong không gian hiện tại
        active_room_agent_ids = []
        if context and isinstance(context, dict):
            ctx_agents = context.get("activeAgents") or context.get("room_agents") or context.get("roomAgents") or context.get("active_agents")
            if isinstance(ctx_agents, list):
                active_room_agent_ids = [str(a.get("id") if isinstance(a, dict) else a) for a in ctx_agents if a]

        if not active_room_agent_ids and room_id and room_id not in ["office", "default", "global"]:
            try:
                import urllib.request, json, os
                room_svc_url = os.getenv("ROOM_SERVICE_URL", "http://room-service:5002")
                req = urllib.request.Request(
                    f"{room_svc_url}/api/v1/internal/rooms/{room_id}",
                    headers={
                        "User-Agent": "AgentService",
                        "x-internal-service": "agent-service",
                        "x-user-id": "system-internal",
                    }
                )
                with urllib.request.urlopen(req, timeout=1.5) as resp:
                    r_json = json.loads(resp.read().decode())
                    active_room_agent_ids = r_json.get("data", {}).get("activeAgents", [])
            except Exception:
                pass

        # Nếu ở 3D Office (room_id=="office" hoặc không truyền room_id): toàn bộ các chuyên gia đều cùng hiện diện trong văn phòng
        if not active_room_agent_ids and (not room_id or room_id in ["office", "default", "global"]):
            from app.models.agent import AgentModel
            all_db_agents = db.query(AgentModel.id).all()
            active_room_agent_ids = [a[0] for a in all_db_agents] if all_db_agents else [
                "agent_manager", "agent_search", "agent_summarizer", 
                "agent_calculate", "agent_analysis", "agent_analyst", "agent_ml", "agent_visualize"
            ]

        # 2. Bóc tách danh sách công cụ của bản thân
        my_agent_name = agent_data.get("name", agent_id)
        my_tools = [t.name if hasattr(t, "name") else str(t.get("name", t.get("id", ""))) for t in agent_data.get("tools", [])]
        my_tools_str = ", ".join(my_tools) if my_tools else "Không được trang bị công cụ ngoài"

        # 3. Lấy thông tin chi tiết từng đồng nghiệp trong phòng kèm công cụ họ sở hữu
        colleagues_lines = []
        for member_agent_id in active_room_agent_ids:
            if member_agent_id == agent_id:
                continue
            try:
                colleague = agent_service.get_agent_by_id(db, member_agent_id)
                colleague_name = colleague.get("name", member_agent_id)
                colleague_tools = [t.name if hasattr(t, "name") else str(t.get("name", t.get("id", ""))) for t in colleague.get("tools", [])]
                
                role_desc = "Trợ lý chuyên gia"
                if colleague.get("prompt_id"):
                    from app.services.prompt_service import prompt_service
                    c_prompt = prompt_service.get_prompt(db, colleague["prompt_id"])
                    if c_prompt and c_prompt.content:
                        role_desc = c_prompt.content.split("\n")[0][:120]

                tools_str = f" [CÔNG CỤ SỞ HỮU: {', '.join(colleague_tools)}]" if colleague_tools else " [Không có công cụ ngoài]"
                colleagues_lines.append(f"- @{member_agent_id} ({colleague_name}): {role_desc}{tools_str}")
            except Exception:
                colleagues_lines.append(f"- @{member_agent_id}: Đồng nghiệp có mặt trong phòng")

        # 4. Tạo chỉ dẫn làm việc nhóm dựa trên ma trận thực tế
        if colleagues_lines:
            colleagues_list_str = "\n".join(colleagues_lines)
            team_guide = (
                f"\n\n[MA TRẬN NĂNG LỰC & CÔNG CỤ CỦA CÁC AGENT ĐANG CÓ MẶT TRONG PHÒNG HIỆN TẠI]\n"
                f"1. BẢN THÂN BẠN: '@{agent_id}' ({my_agent_name}).\n"
                f"   - Công cụ bạn ĐANG SỞ HỮU: [{my_tools_str}].\n"
                f"   - NGUYÊN TẮC QUYỀN SỞ HỮU CÔNG CỤ: Bạn CHỈ ĐƯỢC PHÉP trực tiếp kích hoạt các công cụ bạn đang sở hữu ở trên. Bạn TUYỆT ĐỐI KHÔNG THỂ tự gọi các công cụ mà bạn không có.\n\n"
                f"2. DANH SÁCH ĐỒNG NGHIỆP ĐANG CÓ MẶT TRONG PHÒNG VÀ CÔNG CỤ CỦA HỌ:\n"
                f"{colleagues_list_str}\n\n"
                f"   A. QUY TẮC BÁO CÁO VÀ BÀN GIAO ('AI NHẬN NGƯỜI ẤY TRẢ'):\n"
                f"      - NGUYÊN TẮC VÀNG: Nếu bạn nhận nhiệm vụ do Trưởng nhóm (@agent_manager) giao phó: Sau khi bạn dùng công cụ của mình thu thập/xử lý dữ liệu xong, bạn BẮT BUỘC gắn thẻ '@agent_manager Đã hoàn thành, báo cáo kết quả lại cho Trưởng nhóm tổng hợp và trả lời người dùng'. Trưởng nhóm @agent_manager là người chịu trách nhiệm chốt hạ và phản hồi cuối cùng cho người dùng.\n"
                f"      - NẾU BẠN NHẬN YÊU CẦU TRỰC TIẾP TỪ NGƯỜI DÙNG: Dùng công cụ của bạn xử lý dứt điểm và trực tiếp trả lời kết quả cho người dùng.\n"
                f"      - Nếu bài toán đòi hỏi công cụ mà BẠN KHÔNG CÓ nhưng trong phòng CÓ ĐỒNG NGHIỆP SỞ HỮU: Hãy gắn thẻ @agent_id của đúng đồng nghiệp đó để chuyển giao.\n"
                f"      - TUYỆT ĐỐI KHÔNG tự ý tag qua lại giữa các chuyên viên (worker) để tránh lặp vòng lặp.\n\n"
                f"   B. KHI BÀI TOÁN CẦN VẼ BIỂU ĐỒ HOẶC TÍNH TOÁN LIÊN HOÀN:\n"
                f"      - Bạn dùng công cụ của mình xử lý phần việc của mình trước.\n"
                f"      - Nếu cần vẽ biểu đồ và trong phòng có @agent_visualize: Gắn thẻ '@agent_visualize Hãy vẽ biểu đồ từ số liệu trên'.\n"
                f"      - Chuyên gia cuối cùng hoàn thành chuỗi BẮT BUỘC báo cáo kết quả về lại cho '@agent_manager' (nếu Manager là người khởi xướng).\n"
                f"   C. TUYỆT ĐỐI KHÔNG gắn thẻ bất kỳ @agent_id nào KHÔNG CÓ TÊN trong danh sách đồng nghiệp đang có mặt ở trên."
            )
        else:
            team_guide = (
                f"\n\n[TRẠNG THÁI PHÒNG: LÀM VIỆC ĐỘC LẬP (SOLO)]\n"
                f"Bạn có định danh là: '@{agent_id}' ({my_agent_name}).\n"
                f"Trong phòng hiện tại CHỈ CÓ MỘT MÌNH BẠN hoạt động.\n"
                f"Công cụ bạn sở hữu: [{my_tools_str}].\n"
                f"Bạn hãy tự mình hoàn thành yêu cầu bằng các công cụ sẵn có của mình. TUYỆT ĐỐI KHÔNG gắn thẻ @agent nào khác vì không có ai khác trong phòng."
            )

        # Lấy quy định riêng của từng Agent
        from app.core.agent_configs import get_agent_config
        agent_cfg = get_agent_config(agent_id)
        specific_guidelines = agent_cfg.get("guidelines", "")
        if specific_guidelines:
            team_guide += (
                f"\n\n[QUY ĐỊNH VÀ CHUẨN ĐẦU RA RIÊNG CHO BẠN ({agent_cfg.get('role_name', agent_id)})]:\n"
                f"{specific_guidelines}"
            )

        return team_guide

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

        # 2. Lấy system prompt từ Agent kết hợp Ma trận Năng lực & Công cụ trong phòng
        base_role_prompt = "Bạn là một trợ lý ảo thông minh trong văn phòng 3D ảo."
        if agent_data.get("prompt_id"):
            from app.services.prompt_service import prompt_service
            prompt = prompt_service.get_prompt(db, agent_data["prompt_id"])
            if prompt:
                base_role_prompt = prompt.content

        # Xây dựng ma trận Agent & Tool có mặt trong phòng
        team_collaboration_guide = self._build_room_collaboration_matrix(
            db=db,
            agent_id=agent_id,
            agent_data=agent_data,
            room_id=room_id,
            context=context,
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

        # Kiểm tra cấu hình công cụ trong phòng (Room Workflow Agent Tools / Step Tools)
        wf_cfg = (context or {}).get("workflow") or {}
        agent_tools_cfg = wf_cfg.get("agentTools", {})
        if agent_id in agent_tools_cfg and isinstance(agent_tools_cfg[agent_id], list) and len(agent_tools_cfg[agent_id]) > 0:
            allowed = set(agent_tools_cfg[agent_id])
            agent_tools = [
                t for t in agent_data.get("tools", [])
                if (t.id if hasattr(t, "id") else t.get("id")) in allowed or (t.name if hasattr(t, "name") else t.get("name")) in allowed
            ]
        else:
            agent_tools = agent_data.get("tools", [])

        # Kiểm tra nếu đang chạy theo bước tuần tự có công cụ chỉ định
        if wf_cfg.get("mode") == "sequential":
            order_list = wf_cfg.get("order", [])
            step_idx = order_list.index(agent_id) if agent_id in order_list else (context or {}).get("depth", 0)
            step_tools = wf_cfg.get("stepTools", {})
            assigned_tool = step_tools.get(str(step_idx)) or step_tools.get(step_idx)
            if assigned_tool and assigned_tool != "all":
                agent_system_prompt += (
                    f"\n\n[CHỈ ĐỊNH CÔNG CỤ TẠI BƯỚC NÀY (BƯỚC #{step_idx + 1})]\n"
                    f"Quy trình phòng chỉ định bạn ưu tiên sử dụng công cụ: '{assigned_tool}' để thực thi phần việc của bước này.\n"
                )

        # Thêm hướng dẫn liên kết nhiều công cụ (Multi-Tool Chaining) nếu Agent sở hữu >= 1 tool
        if len(agent_tools) > 0:
            tool_names_str = ", ".join([t.name if hasattr(t, "name") else str(t.get("name", t.get("id", ""))) for t in agent_tools])
            agent_system_prompt += (
                f"\n\n[HƯỚNG DẪN SỬ DỤNG VÀ KẾT HỢP CÔNG CỤ (FLEXIBLE TOOL CHAINING)]\n"
                f"Bạn đang được trang bị các công cụ: [{tool_names_str}].\n"
                f"- Nếu câu hỏi đơn giản hoặc chỉ cần 1 công cụ: Bạn hãy gọi đúng 1 công cụ đó (ví dụ chỉ tính toán thì gọi calculator_tool, chỉ vẽ biểu đồ thì gọi data_visualization_tool) rồi phản hồi ngay cho người dùng.\n"
                f"- Nếu câu hỏi yêu cầu chuỗi xử lý phức tạp (ví dụ tra cứu giá vàng/thị trường, phân tích rồi vẽ biểu đồ): Bạn CÓ THỂ gọi liên hoàn nhiều công cụ theo chuỗi:\n"
                f"  + Bước 1: Gọi web_search_tool hoặc google_search_tool để thu thập số liệu mới nhất.\n"
                f"  + Bước 2: Gọi data_analysis_tool để thống kê số liệu (min, max, mean, xu hướng tăng giảm).\n"
                f"  + Bước 3: Gọi data_visualization_tool truyền mốc thời gian (labels) và số liệu (datasets) để tạo biểu đồ trực quan (line, bar, pie).\n"
                f"  + Bước 4: Đưa ra nhận xét súc tích, ngắn gọn, chuẩn xác.\n"
            )

        # 4. Lấy Short Memory (conversation history) từ Redis
        short_memory = memory_service.get_short_memory(agent_id, room_id)

        # 5. Xây dựng tool definitions (tự động nhận diện đầy đủ 18+ tools chuyên sâu)
        tool_definitions = self._build_tool_definitions(agent_tools)

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
            preferred_model = (
                (context or {}).get("model")
                or agent_data.get("model")
                or "gemini-2.5-flash-lite"
            )
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

    def stream_agent(
        self,
        db: Session,
        agent_id: str,
        user_message: str,
        room_id: Optional[str] = None,
        source: str = "http",
        context: Optional[dict] = None,
    ):
        """
        Stream tiến trình suy nghĩ, gọi tool và từng token câu trả lời của agent qua SSE (Server-Sent Events).
        """
        import json

        # 1. Lấy thông tin Agent từ DB
        try:
            agent_data = agent_service.get_agent_by_id(db, agent_id)
        except Exception:
            yield f"data: {json.dumps({'type': 'error', 'content': f'Agent {agent_id} not found'}, ensure_ascii=False)}\n\n"
            return

        agent_name = agent_data.get("name", agent_id)
        yield f"data: {json.dumps({'type': 'status', 'content': f'Đang kết nối Agent {agent_name}...'}, ensure_ascii=False)}\n\n"

        # 2. Xây dựng System prompt kết hợp Ma trận Năng lực & Công cụ trong phòng
        base_role_prompt = "Bạn là một trợ lý ảo thông minh trong văn phòng 3D ảo."
        if agent_data.get("prompt_id"):
            from app.services.prompt_service import prompt_service
            prompt = prompt_service.get_prompt(db, agent_data["prompt_id"])
            if prompt:
                base_role_prompt = prompt.content

        # Xây dựng ma trận năng lực và công cụ thực tế của các Agent trong phòng
        team_collaboration_guide = self._build_room_collaboration_matrix(
            db=db,
            agent_id=agent_id,
            agent_data=agent_data,
            room_id=room_id,
            context=context,
        )

        agent_system_prompt = f"{base_role_prompt}{team_collaboration_guide}"

        long_memories = memory_service.get_long_memories(db, agent_id, room_id, limit=10)
        memory_context = memory_service.format_long_memories_as_context(long_memories)
        if memory_context:
            agent_system_prompt = f"{agent_system_prompt}\n\n{memory_context}"

        # Kiểm tra cấu hình công cụ trong phòng (Room Workflow Agent Tools / Step Tools)
        wf_cfg = (context or {}).get("workflow") or {}
        agent_tools_cfg = wf_cfg.get("agentTools", {})
        if agent_id in agent_tools_cfg and isinstance(agent_tools_cfg[agent_id], list) and len(agent_tools_cfg[agent_id]) > 0:
            allowed = set(agent_tools_cfg[agent_id])
            agent_tools = [
                t for t in agent_data.get("tools", [])
                if (t.id if hasattr(t, "id") else t.get("id")) in allowed or (t.name if hasattr(t, "name") else t.get("name")) in allowed
            ]
        else:
            agent_tools = agent_data.get("tools", [])

        # Kiểm tra nếu đang chạy theo bước tuần tự có công cụ chỉ định
        if wf_cfg.get("mode") == "sequential":
            order_list = wf_cfg.get("order", [])
            step_idx = order_list.index(agent_id) if agent_id in order_list else (context or {}).get("depth", 0)
            step_tools = wf_cfg.get("stepTools", {})
            assigned_tool = step_tools.get(str(step_idx)) or step_tools.get(step_idx)
            if assigned_tool and assigned_tool != "all":
                agent_system_prompt += (
                    f"\n\n[CHỈ ĐỊNH CÔNG CỤ TẠI BƯỚC NÀY (BƯỚC #{step_idx + 1})]\n"
                    f"Quy trình phòng chỉ định bạn ưu tiên sử dụng công cụ: '{assigned_tool}' để thực thi phần việc của bước này.\n"
                )

        short_memory = memory_service.get_short_memory(agent_id, room_id)

        # 3. Tool definitions
        tool_definitions = self._build_tool_definitions(agent_tools)

        # 4. Messages
        initial_messages = [SystemMessage(content=agent_system_prompt)]
        for m in short_memory:
            role = m.get("role")
            content = m.get("content", "")
            if role == "user":
                initial_messages.append(HumanMessage(content=content))
            elif role == "assistant":
                initial_messages.append(AIMessage(content=content))

        initial_messages.append(HumanMessage(content=user_message))
        memory_service.append_short_memory(agent_id, "user", user_message, room_id)

        preferred_model = (
            (context or {}).get("model")
            or agent_data.get("model")
            or "gemini-2.5-flash-lite"
        )
        current_messages = list(initial_messages)
        tools_used = []
        final_answer = ""

        # 5. ReAct streaming loop (tối đa 5 lượt tool liên hoàn)
        for step in range(5):
            yield f"data: {json.dumps({'type': 'thinking', 'step': step + 1, 'content': 'Đang phân tích và xử lý...'}, ensure_ascii=False)}\n\n"

            from app.core.llm.llm_registry import llm_registry
            dynamic_client = llm_registry.get_client(preferred_model) or self.llm_client

            stream_gen = dynamic_client.stream_chat_completion(
                messages=current_messages,
                tools=tool_definitions if tool_definitions else None,
                agent_id=agent_id,
                model=preferred_model,
            )

            tool_calls = None
            step_text = ""
            for item in stream_gen:
                if isinstance(item, str):
                    step_text += item
                    yield f"data: {json.dumps({'type': 'token', 'content': item}, ensure_ascii=False)}\n\n"
                elif isinstance(item, dict):
                    if item.get("type") == "token":
                        token_content = item.get("content", "")
                        step_text += token_content
                        yield f"data: {json.dumps({'type': 'token', 'content': token_content}, ensure_ascii=False)}\n\n"
                    elif item.get("type") == "tool_calls":
                        tool_calls = item.get("tool_calls")

            if tool_calls:
                lc_tool_calls = []
                for tc in tool_calls:
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
                        "type": "tool_call"
                    })

                current_messages.append(AIMessage(content=step_text, tool_calls=lc_tool_calls))

                for tc in lc_tool_calls:
                    tool_name = tc["name"]
                    tool_args = tc["args"]
                    tool_id = tc["id"]
                    tools_used.append(tool_name)

                    yield f"data: {json.dumps({'type': 'tool_start', 'tool': tool_name, 'args': tool_args, 'message': f'Đang gọi công cụ {tool_name}...'}, ensure_ascii=False)}\n\n"

                    try:
                        tool_result = self.tool_executor.execute(tool_name, tool_args)
                    except Exception as e:
                        tool_result = f"Error: {str(e)}"

                    current_messages.append(ToolMessage(content=str(tool_result), tool_call_id=tool_id))
                    yield f"data: {json.dumps({'type': 'tool_end', 'tool': tool_name, 'result': str(tool_result)[:300]}, ensure_ascii=False)}\n\n"

                # Tiếp tục vòng lặp để model nhận ToolMessage và quyết định gọi tool tiếp theo hoặc trả lời
                continue
            else:
                final_answer = step_text
                break

        if not final_answer:
            final_answer = "Đã hoàn thành các bước xử lý dữ liệu."

        # Lưu assistant reply vào memory
        memory_service.append_short_memory(agent_id, "assistant", final_answer, room_id)

        # Publish reply lên RabbitMQ
        self._publish_reply(
            agent_id=agent_id,
            agent_name=agent_name,
            room_id=room_id,
            answer=final_answer,
            tools_used=tools_used,
            workflow_trace=None,
            source=source,
            context=context,
        )

        yield f"data: {json.dumps({'type': 'done', 'answer': final_answer, 'tools_used': tools_used}, ensure_ascii=False)}\n\n"


agent_runner = AgentRunner()