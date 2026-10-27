import os
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.tool import ToolModel
from app.models.prompt import PromptModel
from app.models.agent import AgentModel
from app.schemas.tool_schema import ToolCreate
from app.schemas.prompt_schema import PromptCreate
from app.schemas.agent_schema import AgentCreate
from app.services.tool_service import tool_service
from app.services.prompt_service import prompt_service
from app.services.agent_service import agent_service
from app.repositories.tool_repository import tool_repository
from app.repositories.prompt_repository import prompt_repository
from app.repositories.agent_repository import agent_repository

logger = logging.getLogger(__name__)

class AgentFileGenerator:
    """
    Quản lý việc tạo file mã nguồn và đồng bộ hóa các thành phần của Agent vào hệ thống:
    - app/generated/tools/   : File code Python chuẩn BaseTool (*.py)
    - app/generated/prompts/ : File System Prompt (*.md, *.json)
    - app/generated/models/  : File cấu hình LLM Model (*.json)
    - app/generated/agents/  : File đặc tả Agent Manifest (*.json)
    Đồng thời tự động lưu trữ và đồng bộ vào PostgreSQL Database (Agents, Prompts, Tools).
    """

    def __init__(self):
        # Đường dẫn gốc của thư mục app/generated/
        self.base_dir = os.path.abspath(
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "generated")
        )
        self.tools_dir = os.path.join(self.base_dir, "tools")
        self.prompts_dir = os.path.join(self.base_dir, "prompts")
        self.models_dir = os.path.join(self.base_dir, "models")
        self.agents_dir = os.path.join(self.base_dir, "agents")

        for d in [self.tools_dir, self.prompts_dir, self.models_dir, self.agents_dir]:
            os.makedirs(d, exist_ok=True)

    def generate_and_sync_all(
        self,
        db: Session,
        agent_blueprint: Dict[str, Any],
        system_prompt: str,
        tool_code: str,
        tool_parameters: Optional[str] = None,
        save_to_db: bool = True
    ) -> Dict[str, Any]:
        """
        Sinh toàn bộ file mã nguồn theo form chuẩn và đồng bộ vào cơ sở dữ liệu.
        """
        agent_id = agent_blueprint.get("id", "agent_custom")
        agent_name = agent_blueprint.get("name", "Agent Tự Sinh")
        role = agent_blueprint.get("role", "")
        color = agent_blueprint.get("color", "#6366f1")
        model = agent_blueprint.get("model", "gemini-2.5-flash-lite")
        prompt_id = agent_blueprint.get("prompt_id") or f"prompt_{agent_id.replace('agent_', '')}"
        tool_id = agent_blueprint.get("tool_id") or f"tool_{agent_id.replace('agent_', '')}"
        tool_name = agent_blueprint.get("tool_name") or f"Tool {agent_name}"
        tool_desc = agent_blueprint.get("tool_description") or f"Công cụ phụ trợ cho {agent_name}"

        now_iso = datetime.now().isoformat()
        generated_files = {}

        # 1. ──── SINH FILE PYTHON CHO TOOL THEO FORM CHUẨN (BaseTool) ────
        class_name = "".join(part.capitalize() for part in tool_id.split("_"))
        if not class_name.endswith("Tool"):
            class_name += "Tool"

        formatted_tool_code = (
            f"# -*- coding: utf-8 -*-\n"
            f'"""\n'
            f'Generated Tool: {tool_name} ({tool_id})\n'
            f'Tự động sinh bởi AI Agent Lab Foundry vào lúc {now_iso}\n'
            f'Mô tả: {tool_desc}\n'
            f'"""\n\n'
            f"import os\n"
            f"import re\n"
            f"import json\n"
            f"import urllib.request\n"
            f"from typing import Dict, Any, Optional\n"
            f"from app.core.tools.base_tool import BaseTool\n\n"
            f"class {class_name}(BaseTool):\n"
            f'    name = "{tool_id}"\n'
            f'    description = "{tool_desc}"\n\n'
            f"    def execute(self, arguments: Dict[str, Any]) -> str:\n"
            f'        """Thực thi tác vụ của {tool_name}"""\n'
            f"        try:\n"
        )

        # Chèn nội dung xử lý của Tool
        if tool_code and tool_code.strip():
            indented_code = "\n".join("            " + line for line in tool_code.strip().splitlines())
            formatted_tool_code += (
                f"{indented_code}\n\n"
                f"            # Nếu có hàm execute trong scope, gọi hàm đó\n"
                f"            if 'execute' in locals() and callable(locals()['execute']):\n"
                f"                res = locals()['execute'](arguments)\n"
                f"                return res if isinstance(res, str) else json.dumps(res, ensure_ascii=False)\n"
            )
        else:
            formatted_tool_code += (
                f"            return json.dumps({{'status': 'success', 'data': str(arguments)}}, ensure_ascii=False)\n"
            )

        formatted_tool_code += (
            f"        except Exception as e:\n"
            f"            return json.dumps({{'status': 'error', 'error': str(e)}}, ensure_ascii=False)\n\n\n"
            f"# Hàm execute module-level để tương thích ToolExecutor và Sandbox\n"
            f"def execute(arguments: Dict[str, Any]) -> str:\n"
            f"    return {class_name}().execute(arguments)\n"
        )

        tool_filepath = os.path.join(self.tools_dir, f"{tool_id}.py")
        with open(tool_filepath, "w", encoding="utf-8") as f:
            f.write(formatted_tool_code)
        generated_files["tool_py"] = f"app/generated/tools/{tool_id}.py"

        # 2. ──── SINH FILE SYSTEM PROMPT (*.md và *.json) ────
        prompt_md_path = os.path.join(self.prompts_dir, f"{prompt_id}.md")
        with open(prompt_md_path, "w", encoding="utf-8") as f:
            f.write(
                f"# {agent_name} - System Prompt\n\n"
                f"> Tự động sinh bởi Agent Lab Foundry • {now_iso}\n\n"
                f"## 1. Vai trò & Mục tiêu\n"
                f"{role}\n\n"
                f"## 2. Nội dung Chỉ thị Hệ thống (System Directive)\n\n"
                f"{system_prompt}\n"
            )
        generated_files["prompt_md"] = f"app/generated/prompts/{prompt_id}.md"

        prompt_json_path = os.path.join(self.prompts_dir, f"{prompt_id}.json")
        with open(prompt_json_path, "w", encoding="utf-8") as f:
            json.dump({
                "id": prompt_id,
                "title": f"Prompt {agent_name}",
                "agent_id": agent_id,
                "created_at": now_iso,
                "content": system_prompt
            }, f, ensure_ascii=False, indent=2)
        generated_files["prompt_json"] = f"app/generated/prompts/{prompt_id}.json"

        # 3. ──── SINH FILE CẤU HÌNH MÔ HÌNH (*.json) ────
        model_json_path = os.path.join(self.models_dir, f"{agent_id}_model.json")
        model_config = {
            "agent_id": agent_id,
            "agent_name": agent_name,
            "selected_model": model,
            "provider": "google" if "gemini" in model.lower() else "ollama",
            "temperature": 0.2,
            "max_output_tokens": 4096,
            "top_p": 0.95,
            "recommended_use_cases": [role],
            "created_at": now_iso
        }
        with open(model_json_path, "w", encoding="utf-8") as f:
            json.dump(model_config, f, ensure_ascii=False, indent=2)
        generated_files["model_json"] = f"app/generated/models/{agent_id}_model.json"

        # 4. ──── SINH FILE ĐẶC TẢ AGENT MANIFEST (*.json) ────
        agent_manifest_path = os.path.join(self.agents_dir, f"{agent_id}.json")
        agent_manifest = {
            "id": agent_id,
            "name": agent_name,
            "role": role,
            "color": color,
            "model": model,
            "prompt_id": prompt_id,
            "tool_ids": [tool_id],
            "artifacts": generated_files,
            "created_at": now_iso
        }
        with open(agent_manifest_path, "w", encoding="utf-8") as f:
            json.dump(agent_manifest, f, ensure_ascii=False, indent=2)
        generated_files["agent_manifest"] = f"app/generated/agents/{agent_id}.json"

        # 5. ──── NẠP ĐỘNG TOOL VÀO TOOL REGISTRY ────
        try:
            from app.core.tools.registry import tool_registry
            tool_registry.load_generated_tools()
        except Exception as reg_err:
            logger.warning(f"⚠️ [AgentFileGenerator] Lỗi nạp động tool vào registry: {reg_err}")

        # 6. ──── ĐỒNG BỘ VÀO POSTGRESQL DATABASE (ĐỂ HIỆN TRÊN TRANG AGENTS, PROMPTS, TOOLS) ────
        db_records = {}
        if save_to_db:
            try:
                # Đồng bộ Tool vào bảng `tools`
                existing_tool = tool_repository.get(db, tool_id)
                tool_data = ToolCreate(
                    id=tool_id,
                    name=tool_name,
                    description=f"{tool_desc} [Sinh tự động tại {generated_files['tool_py']}]",
                    code=formatted_tool_code,
                    parameters=tool_parameters or json.dumps({
                        "type": "object",
                        "properties": {
                            "url": {"type": "string", "description": "Đường dẫn file hoặc URL"},
                            "input": {"type": "string", "description": "Dữ liệu đầu vào"}
                        }
                    }, ensure_ascii=False),
                    category="generated"
                )
                if not existing_tool:
                    db_records["tool"] = tool_service.create_tool(db, tool_data)
                else:
                    db_records["tool"] = tool_service.update_tool(db, tool_id, tool_data)

                # Đồng bộ Prompt vào bảng `prompts`
                existing_prompt = prompt_repository.get(db, prompt_id)
                prompt_data = PromptCreate(
                    id=prompt_id,
                    title=f"Prompt {agent_name}",
                    content=system_prompt
                )
                if not existing_prompt:
                    db_records["prompt"] = prompt_service.create_prompt(db, prompt_data)
                else:
                    db_records["prompt"] = prompt_service.update_prompt(db, prompt_id, prompt_data)

                # Đồng bộ Agent vào bảng `agents`
                existing_agent = agent_repository.get(db, agent_id)
                active_tools = [tool_id]
                # Tự động liên kết thêm tool chuyên môn nếu bài toán yêu cầu
                lower_role = (role + " " + agent_id).lower()
                if "pdf" in lower_role:
                    active_tools.append("pdf_analyzer_tool")
                elif "csv" in lower_role:
                    active_tools.append("csv_analyzer_tool")
                elif "code" in lower_role:
                    active_tools.append("python_code_generator_tool")
                    active_tools.append("python_sandbox_tool")

                agent_data = AgentCreate(
                    id=agent_id,
                    name=agent_name,
                    color=color,
                    status="idle",
                    speech=f"Xin chào! Tôi là {agent_name}, vừa được chế tạo tại Agent Lab 3D!",
                    pos_x=0.0,
                    pos_y=0.0,
                    pos_z=0.0,
                    model=model,
                    prompt_id=prompt_id,
                    tool_ids=list(set(active_tools))
                )
                if not existing_agent:
                    db_records["agent"] = agent_service.create_agent(db, agent_data)
                else:
                    db_records["agent"] = agent_service.update_agent(db, agent_id, agent_data)

                logger.info(f"✅ [AgentFileGenerator] Đồng bộ thành công Agent '{agent_name}' ({agent_id}) vào Database!")
            except Exception as db_err:
                logger.error(f"❌ [AgentFileGenerator] Lỗi ghi dữ liệu Database: {db_err}", exc_info=True)
                db_records["error"] = str(db_err)

        return {
            "success": True,
            "generated_files": generated_files,
            "db_records": db_records
        }

    def list_all_generated(self) -> Dict[str, Any]:
        """Liệt kê toàn bộ file đã sinh trong các thư mục"""
        def scan(dir_path: str):
            res = []
            if not os.path.exists(dir_path):
                return res
            for f in os.listdir(dir_path):
                if f.startswith("__"):
                    continue
                p = os.path.join(dir_path, f)
                if os.path.isfile(p):
                    res.append({
                        "filename": f,
                        "path": os.path.relpath(p, os.path.dirname(self.base_dir)).replace("\\", "/"),
                        "size_bytes": os.path.getsize(p),
                        "updated_at": datetime.fromtimestamp(os.path.getmtime(p)).isoformat()
                    })
            return res

        return {
            "tools": scan(self.tools_dir),
            "prompts": scan(self.prompts_dir),
            "models": scan(self.models_dir),
            "agents": scan(self.agents_dir),
        }

agent_file_generator = AgentFileGenerator()
