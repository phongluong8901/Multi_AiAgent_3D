import ast
import json
import re
from typing import Dict, Any, List
from .base_tool import BaseTool


class SecurityCodeAuditorTool(BaseTool):
    name = "security_code_auditor_tool"
    description = (
        "Công cụ Kiểm toán Bảo mật & Chất lượng Mã nguồn (Static Application Security Testing - SAST): "
        "phát hiện lỗ hổng OWASP (SQL Injection, Command Injection, XSS, Hardcoded API Key/Secret, "
        "Insecure Deserialization), kiểm tra cú pháp AST Python và đánh giá độ phức tạp thuật toán."
    )

    VULNERABILITY_PATTERNS = [
        {
            "id": "OWASP-A03-SQLI",
            "severity": "CRITICAL",
            "title": "Nguy cơ SQL Injection do nối chuỗi trực tiếp",
            "regex": r"(?:execute|cursor\.execute|raw)\s*\(\s*(?:f['\"]|['\"].*%s|['\"].*\+)",
            "fix": "Sử dụng Parameterized Queries (ví dụ: cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))) thay vì f-string hoặc nối chuỗi.",
        },
        {
            "id": "OWASP-A03-CMDI",
            "severity": "CRITICAL",
            "title": "Nguy cơ OS Command Injection / Thực thi mã tùy ý",
            "regex": r"\b(?:os\.system|subprocess\.(?:Popen|call|run)\([^)]*shell\s*=\s*True|eval\s*\(|exec\s*\()",
            "fix": "Tránh dùng eval()/exec() hoặc shell=True. Hãy truyền danh sách tham số vào subprocess.run(['cmd', 'arg'], shell=False).",
        },
        {
            "id": "OWASP-A02-SECRET",
            "severity": "HIGH",
            "title": "Hardcoded API Key / Secret / Password trong mã nguồn",
            "regex": r"(?i)(?:api_key|secret_key|password|token|private_key)\s*=\s*['\"][A-Za-z0-9_\-]{12,}['\"]",
            "fix": "Di chuyển khóa bí mật sang biến môi trường (os.getenv('API_KEY')) hoặc trình quản lý Secret.",
        },
        {
            "id": "OWASP-A08-DESERIALIZE",
            "severity": "HIGH",
            "title": "Giải tuần tự hóa không an toàn (Pickle / YAML Loader)",
            "regex": r"\b(?:pickle\.loads?|yaml\.load\s*\([^)]*(?!SafeLoader))",
            "fix": "Sử dụng json.loads() hoặc yaml.safe_load() thay cho pickle.loads() trên dữ liệu đầu vào không tin cậy.",
        },
        {
            "id": "OWASP-A07-XSS",
            "severity": "MEDIUM",
            "title": "Nguy cơ Cross-Site Scripting (XSS) do render HTML thô",
            "regex": r"\b(?:dangerouslySetInnerHTML|innerHTML\s*=|v-html|mark_safe)",
            "fix": "Sanitize dữ liệu HTML bằng DOMPurify/bleach trước khi hiển thị ra giao diện.",
        },
    ]

    def execute(self, arguments: Dict[str, Any]) -> str:
        try:
            if isinstance(arguments, str):
                code = arguments
                language = "python"
            elif isinstance(arguments, dict):
                code = (
                    arguments.get("code")
                    or arguments.get("source_code")
                    or arguments.get("script")
                    or arguments.get("input")
                    or ""
                )
                language = str(arguments.get("language") or "python").lower()
            else:
                code = str(arguments)
                language = "python"

            code_str = str(code).strip()
            if not code_str:
                return json.dumps(
                    {"success": False, "error": "Mã nguồn cần kiểm toán không được để trống."},
                    ensure_ascii=False,
                )

            findings: List[Dict[str, Any]] = []
            lines = code_str.splitlines()

            # Quét các mẫu lỗ hổng bảo mật OWASP
            for rule in self.VULNERABILITY_PATTERNS:
                for idx, line in enumerate(lines, start=1):
                    if re.search(rule["regex"], line):
                        findings.append(
                            {
                                "rule_id": rule["id"],
                                "severity": rule["severity"],
                                "title": rule["title"],
                                "line": idx,
                                "snippet": line.strip()[:120],
                                "remediation": rule["fix"],
                            }
                        )

            # Phân tích AST nếu là Python
            syntax_valid = True
            syntax_error = None
            functions_count = 0
            classes_count = 0
            nested_loops = 0

            if language == "python":
                try:
                    tree = ast.parse(code_str)
                    for node in ast.walk(tree):
                        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                            functions_count += 1
                        elif isinstance(node, ast.ClassDef):
                            classes_count += 1
                        elif isinstance(node, (ast.For, ast.While)):
                            for child in ast.iter_child_nodes(node):
                                if isinstance(child, (ast.For, ast.While)):
                                    nested_loops += 1
                except SyntaxError as se:
                    syntax_valid = False
                    syntax_error = f"Line {se.lineno}: {se.msg}"

            # Tính điểm an toàn (0 - 100)
            score = 100
            for f in findings:
                if f["severity"] == "CRITICAL":
                    score -= 30
                elif f["severity"] == "HIGH":
                    score -= 20
                else:
                    score -= 10
            if not syntax_valid:
                score -= 25
            security_score = max(0, score)

            estimated_complexity = "O(N^2) hoặc cao hơn" if nested_loops > 0 else "O(N) / O(1)"

            return json.dumps(
                {
                    "success": True,
                    "language": language,
                    "security_score": security_score,
                    "status": "PASSED" if security_score >= 80 and syntax_valid else "WARNING / NEEDS_FIX",
                    "syntax_valid": syntax_valid,
                    "syntax_error": syntax_error,
                    "metrics": {
                        "total_lines": len(lines),
                        "functions_count": functions_count,
                        "classes_count": classes_count,
                        "estimated_time_complexity": estimated_complexity,
                    },
                    "vulnerabilities_found": len(findings),
                    "findings": findings,
                },
                ensure_ascii=False,
            )
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)
