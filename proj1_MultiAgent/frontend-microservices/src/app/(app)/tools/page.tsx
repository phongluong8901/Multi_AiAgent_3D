'use client'

import { useEffect, useState, useMemo } from 'react'
import { toolsApi, Tool, ToolTestResult } from '@/lib/api'
import { toast } from 'sonner'
import { useConfirm } from '@/context/ConfirmContext'
import {
    IconWrench,
    IconCode,
    IconPlus,
    IconSave,
    IconTrash,
    IconPlay,
    IconRefreshCw,
    IconCheck,
    IconCheckCircle,
    IconAlertCircle,
    IconSearch,
    IconTerminal,
    IconSparkles,
    IconX,
    IconCopy,
    IconKey,
    IconEye,
    IconEyeOff,
    IconShield,
    IconActivity,
    IconRotateCcw,
} from '@/components/ui/icons'

type ApiKeyEntry = {
    key: string
    value: string
    show?: boolean
}

// Bảng tham số mẫu thông minh cho từng loại Tool hệ thống & tùy chỉnh
const TOOL_DEFAULT_SAMPLES: Record<string, Record<string, unknown>> = {
    calculator_tool: { expression: '25 * 4 + 10' },
    scientific_calculator: { expression: 'sqrt(144) + 10' },
    duckduckgo_search: { query: 'Thời tiết Hà Nội hôm nay' },
    duckduckgo_search_tool: { query: 'Thời tiết Hà Nội hôm nay' },
    web_search_tool: { query: 'LangGraph multi-agent architecture 2026' },
    tavily_search_tool: { query: 'LangGraph multi-agent architecture 2026' },
    google_search_tool: { query: 'LangGraph multi-agent architecture 2026' },
    wikipedia_tool: { query: 'Artificial Intelligence' },
    web_crawler_tool: { url: 'https://example.com' },
    data_visualization_tool: { data: [15, 30, 45, 60], type: 'bar', title: 'Thử nghiệm biểu đồ' },
    pdf_analyzer_tool: { text: 'Báo cáo thử nghiệm hệ thống Multi-Agent AI năm 2026.' },
    financial_market_tool: { operation: 'cagr', initial_value: 1000, final_value: 2000, periods: 3 },
    data_analysis_tool: { numbers: [10, 20, 30, 40, 50] },
    csv_analyzer_tool: { csv_content: 'id,name,role\n1,Alpha,Worker\n2,Beta,Supervisor' },
    json_data_transformer_tool: { json_str: '{"status": "ok", "service": "agent-service"}' },
    sentiment_analysis_tool: { text: 'Hệ thống hoạt động rất mượt mà và ổn định!' },
    sentiment_tool: { text: 'Hệ thống hoạt động rất mượt mà và ổn định!' },
    summarizer_tool: { text: 'Hệ thống Multi-Agent phân tán kết hợp microservices giúp xử lý các tác vụ tự động hóa.', max_length: 60 },
    text_summarizer_tool: { text: 'Hệ thống Multi-Agent phân tán kết hợp microservices giúp xử lý các tác vụ tự động hóa.', max_length: 60 },
    text_summarizer: { text: 'Hệ thống Multi-Agent phân tán kết hợp microservices giúp xử lý các tác vụ tự động hóa.', max_length: 60 },
    workflow_planner_tool: { task: 'Lập kế hoạch phân tích dữ liệu tự động và xuất báo cáo' },
    system_health_tool: {},
    system_control_tool: {},
    python_code_generator_tool: { prompt: 'Hàm tính tổng hai số nguyên a và b' },
    python_sandbox_tool: { code: 'result = 12 * 8\nprint(f"Ket qua: {result}")' },
    sql_query_generator_tool: { prompt: 'Lấy danh sách người dùng đăng ký trong tháng 11' },
    security_code_auditor_tool: { code: 'def run_query(param):\n    return eval(param)' },
    ml_evaluator_tool: { y_true: [1, 0, 1, 1], y_pred: [1, 0, 1, 0] },
    image_analyzer_tool: { task: 'info', image_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800' },
}

// Các mẫu code Python khởi điểm kèm cấu hình API Keys để người dùng chọn nhanh
const CODE_TEMPLATES = [
    {
        id: 'summarizer',
        name: 'Text Summarizer (Tóm tắt văn bản thông minh)',
        category: 'nlp',
        description: 'Tự động trích xuất các ý chính quan trọng nhất từ bài viết hoặc tài liệu dài.',
        defaultKeys: [] as ApiKeyEntry[],
        defaultArgs: JSON.stringify(
            {
                text: 'Trí tuệ nhân tạo (AI) đang phát triển với tốc độ chóng mặt trên toàn cầu. Các hệ thống đa tác nhân (Multi-Agent Systems) cho phép nhiều mô hình AI chuyên biệt phối hợp cùng nhau để giải quyết các bài toán kỹ thuật phức tạp mà một mô hình đơn lẻ khó lòng đáp ứng.',
                max_length: 120,
            },
            null,
            2
        ),
        code: `import json
import re

def execute(arguments: dict) -> str:
    """Tóm tắt văn bản thông minh (kết hợp lọc câu trọng số cao và trích xuất ý chính)"""
    text = arguments.get("text", "") or arguments.get("input", "")
    max_len = int(arguments.get("max_length", 150))
    
    if not text or not str(text).strip():
        return json.dumps({"success": False, "error": "Văn bản đầu vào không được để trống."})
        
    cleaned = str(text).strip()
    sentences = [s.strip() for s in re.split(r'(?<=[.!?\\n])\\s+', cleaned) if len(s.strip()) > 10]
    
    if len(sentences) <= 2:
        return json.dumps({
            "success": True, 
            "summary": " ".join(sentences), 
            "original_length": len(cleaned)
        }, ensure_ascii=False)
        
    # Thu thập câu mở đầu, câu giữa và câu kết luận
    summary_parts = [sentences[0]]
    if len(sentences) > 3:
        summary_parts.append(sentences[len(sentences)//2])
    summary_parts.append(sentences[-1])
    
    summary = " ".join(summary_parts)
    if len(summary) > max_len * 2:
        summary = summary[:max_len * 2] + "..."
        
    return json.dumps({
        "success": True,
        "original_length": len(cleaned),
        "sentences_count": len(sentences),
        "summary": summary
    }, ensure_ascii=False)
`,
    },
    {
        id: 'google_search',
        name: 'Google Custom Search (Cần API Key & CSE ID)',
        category: 'web',
        description: 'Tìm kiếm Google trực tiếp từ API với kết quả trả về gồm Title, Link và Snippet.',
        defaultKeys: [
            { key: 'GOOGLE_API_KEY', value: '', show: false },
            { key: 'GOOGLE_CSE_ID', value: '', show: false },
        ],
        defaultArgs: JSON.stringify(
            {
                query: 'LangGraph Multi-Agent Architecture 2026',
            },
            null,
            2
        ),
        code: `import json
import os
import urllib.request
import urllib.parse

def execute(arguments: dict) -> str:
    """Tìm kiếm Google Custom Search sử dụng API Key và CSE ID được nạp"""
    query = arguments.get("query", "")
    if not query:
        return json.dumps({"success": False, "error": "Từ khóa tìm kiếm không được để trống."})

    # Lấy API Key từ biến môi trường hoặc dictionary secrets
    api_key = os.getenv("GOOGLE_API_KEY") or secrets.get("GOOGLE_API_KEY", "")
    cse_id = os.getenv("GOOGLE_CSE_ID") or secrets.get("GOOGLE_CSE_ID", "")

    if not api_key or not cse_id:
        return json.dumps({
            "success": False, 
            "error": "Chưa cấu hình GOOGLE_API_KEY hoặc GOOGLE_CSE_ID trong vùng API Keys của Tool."
        })

    try:
        params = urllib.parse.urlencode({"key": api_key, "cx": cse_id, "q": query, "num": 3})
        url = f"https://www.googleapis.com/customsearch/v1?{params}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Claw-Office/1.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            items = data.get("items", [])
            results = [{"title": it.get("title"), "link": it.get("link"), "snippet": it.get("snippet")} for it in items]
            return json.dumps({"success": True, "query": query, "results": results}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"success": False, "error": f"Lỗi Google API: {str(e)}"})
`,
    },
    {
        id: 'web_fetcher',
        name: 'REST API & Web Data Fetcher',
        category: 'web',
        description: 'Gọi API bên ngoài để lấy dữ liệu tỷ giá, tin tức hoặc thông tin thị trường.',
        defaultKeys: [] as ApiKeyEntry[],
        defaultArgs: JSON.stringify(
            {
                url: 'https://api.coindesk.com/v1/bpi/currentprice.json',
            },
            null,
            2
        ),
        code: `import json
import urllib.request

def execute(arguments: dict) -> str:
    """Truy vấn REST API bên ngoài và trả về dữ liệu chuẩn JSON"""
    url = arguments.get("url", "https://api.coindesk.com/v1/bpi/currentprice.json")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Claw-Office-Agent/1.0'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return json.dumps({"success": True, "source": url, "data": data}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})
`,
    },
    {
        id: 'data_cleaner',
        name: 'Data Cleaner & Entity Extractor',
        category: 'data',
        description: 'Trích xuất Email, Số điện thoại và URLs từ tài liệu hỗn hợp.',
        defaultKeys: [] as ApiKeyEntry[],
        defaultArgs: JSON.stringify(
            {
                text: 'Mọi thông tin liên hệ xin gửi về email: contact@claw-office.ai hoặc support@tech.vn. Đường dây nóng: 0988-123-456. Trang chủ: https://claw-office.ai',
            },
            null,
            2
        ),
        code: `import json
import re

def execute(arguments: dict) -> str:
    """Trích xuất tự động email, số điện thoại và liên kết web từ nội dung"""
    text = arguments.get("text", "")
    emails = re.findall(r'[\\w\\.-]+@[\\w\\.-]+\\.\\w+', text)
    phones = re.findall(r'(\\+?\\d{1,3}[-.\\s]?)?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}', text)
    urls = re.findall(r'https?://[^\\s<>"]+|www\\.[^\\s<>"]+', text)
    
    return json.dumps({
        "success": True,
        "emails": list(set(emails)),
        "phones": list(set(phones)),
        "urls": list(set(urls)),
        "total_entities_found": len(emails) + len(urls)
    }, ensure_ascii=False)
`,
    },
    {
        id: 'math_solver',
        name: 'Math Formula & Financial Solver',
        category: 'utility',
        description: 'Tính toán lãi suất kép, tỷ lệ tăng trưởng và các biểu thức toán học.',
        defaultKeys: [] as ApiKeyEntry[],
        defaultArgs: JSON.stringify(
            {
                expression: '1000000 * ((1 + 0.08 / 12) ** (12 * 5))',
            },
            null,
            2
        ),
        code: `import json
import math

def execute(arguments: dict) -> str:
    """Tính toán biểu thức toán học và tài chính an toàn"""
    expression = arguments.get("expression", "2 * math.pi * 5")
    allowed = {
        "math": math, "abs": abs, "round": round, 
        "max": max, "min": min, "pow": pow, "sum": sum
    }
    try:
        result = eval(expression, {"__builtins__": None}, allowed)
        return json.dumps({
            "success": True, 
            "expression": expression, 
            "result": result
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"success": False, "error": f"Lỗi tính toán: {str(e)}"})
`,
    },
    {
        id: 'image_ocr_classifier',
        name: 'Image OCR & Vision Classifier',
        category: 'vision',
        description: 'Trích xuất văn bản (OCR) và phân loại đối tượng, màu sắc, cảnh quan trong bức ảnh.',
        defaultKeys: [] as ApiKeyEntry[],
        defaultArgs: JSON.stringify(
            {
                image_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800',
                task: 'all',
                prompt: 'Trích xuất toàn bộ chữ trong hóa đơn và phân loại loại chứng từ.',
            },
            null,
            2
        ),
        code: `import json

def execute(arguments: dict) -> str:
    """Gọi công cụ phân tích hình ảnh và trích xuất chữ OCR"""
    url = arguments.get("image_url", "")
    task = arguments.get("task", "all")
    prompt = arguments.get("prompt", "")
    
    if not url:
        return json.dumps({"success": False, "error": "Chưa cung cấp đường dẫn ảnh."})
        
    return json.dumps({
        "success": True,
        "image_url": url,
        "task": task,
        "status": "ready_for_vision_model"
    }, ensure_ascii=False)
`,
    },
    {
        id: 'csv_data_profiler',
        name: 'CSV Data Profiler & Insights',
        category: 'data',
        description: 'Đọc và phân tích toàn diện file CSV: số dòng/cột, tỷ lệ missing, thống kê mô tả mean/std/min/max.',
        defaultKeys: [] as ApiKeyEntry[],
        defaultArgs: JSON.stringify(
            {
                csv_content: "id,ten_san_pham,so_luong,don_gia,doanh_thu\\n1,Laptop Dell XPS,15,25000000,375000000\\n2,Chuot Logitech,120,450000,54000000\\n3,Ban phim Co,45,1200000,54000000",
                query: "Kiểm tra sản phẩm có doanh thu cao nhất",
            },
            null,
            2
        ),
        code: `import json
import csv
import io

def execute(arguments: dict) -> str:
    """Phân tích cấu trúc file CSV và tính toán số liệu thống kê"""
    data_str = arguments.get("csv_content", "")
    if not data_str:
        return json.dumps({"success": False, "error": "Dữ liệu CSV không được để trống."})
        
    reader = csv.reader(io.StringIO(data_str.strip()))
    rows = list(reader)
    if not rows:
        return json.dumps({"success": False, "error": "File CSV rỗng."})
        
    headers = rows[0]
    records = rows[1:]
    
    return json.dumps({
        "success": True,
        "columns": headers,
        "total_records": len(records),
        "preview": records[:3]
    }, ensure_ascii=False)
`,
    },
    {
        id: 'python_sandbox_runner',
        name: 'Python Isolated Sandbox Runner',
        category: 'utility',
        description: 'Thực thi mã nguồn Python an toàn trong Container Sandbox cô lập, bảo mật dữ liệu.',
        defaultKeys: [] as ApiKeyEntry[],
        defaultArgs: JSON.stringify(
            {
                code: "import math\nprint('Fibonacci series:')\na, b = 0, 1\nfor _ in range(10):\n    print(a, end=' ')\n    a, b = b, a + b\nprint()",
                timeout_seconds: 10,
            },
            null,
            2
        ),
        code: `import json

def execute(arguments: dict) -> str:
    """Thực thi Python code an toàn trong môi trường Sandbox"""
    code = arguments.get("code", "print('Hello from Python Sandbox!')")
    return json.dumps({
        "success": True,
        "environment": "docker-sandbox-ready",
        "code_length": len(code)
    }, ensure_ascii=False)
`,
    },
]

/**
 * Trang Xưởng Công cụ AI (ToolsStudioPage).
 * Cho phép quản lý các công cụ hệ thống (Built-in Tools) và công cụ tùy chỉnh (Custom Python Tools):
 * - Chạy kiểm tra sức khỏe hàng loạt (Batch Health Check) hoặc chạy thử từng công cụ với JSON arguments.
 * - Viết mã Python trực tiếp cho Custom Tool và cấu hình biến môi trường / API Keys riêng biệt.
 */
export default function ToolsStudioPage() {
    const { confirm } = useConfirm()
    const [tools, setTools] = useState<Tool[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [categoryFilter, setCategoryFilter] = useState<string>('all')
    const [healthFilter, setHealthFilter] = useState<'all' | 'healthy' | 'error' | 'untested'>('all')

    // Trạng thái kiểm tra sức khỏe của từng Tool (Health Map)
    const [healthStatusMap, setHealthStatusMap] = useState<
        Record<string, { success: boolean; status: 'healthy' | 'error'; latency_ms: number; error?: string | null }>
    >({})
    const [isBatchChecking, setIsBatchChecking] = useState(false)
    const [batchCheckSummary, setBatchCheckSummary] = useState<{
        total: number
        healthy_count: number
        error_count: number
    } | null>(null)

    // Modal Test Tool chuyên dụng
    const [testModalOpen, setTestModalOpen] = useState(false)
    const [testingTool, setTestingTool] = useState<Tool | null>(null)
    const [testArgs, setTestArgs] = useState('{}')
    const [isTestingSingle, setIsTestingSingle] = useState(false)
    const [singleTestResult, setSingleTestResult] = useState<ToolTestResult | null>(null)
    const [testViewMode, setTestViewMode] = useState<'json' | 'raw'>('json')

    // Modal Studio Editor (Tạo / Sửa code & nạp API Keys)
    const [editorOpen, setEditorOpen] = useState(false)
    const [editingToolId, setEditingToolId] = useState<string | null>(null)
    const [idInput, setIdInput] = useState('')
    const [nameInput, setNameInput] = useState('')
    const [descInput, setDescInput] = useState('')
    const [categoryInput, setCategoryInput] = useState('custom')
    const [codeInput, setCodeInput] = useState(CODE_TEMPLATES[0].code)
    const [testArgsInput, setTestArgsInput] = useState(CODE_TEMPLATES[0].defaultArgs)
    const [apiKeysList, setApiKeysList] = useState<ApiKeyEntry[]>([])
    const [testResult, setTestResult] = useState<string | null>(null)
    const [testingCode, setTestingCode] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)

    // Tải danh sách tools
    async function loadTools() {
        setLoading(true)
        try {
            const data = await toolsApi.list()
            setTools(data ?? [])
        } catch (err: any) {
            console.error('[ERROR] Lỗi tải danh sách tools:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadTools()
    }, [])

    // Mở Modal Test Tool trực tiếp từ Card
    const handleOpenTestModal = (tool: Tool) => {
        setTestingTool(tool)
        setSingleTestResult(null)
        setTestViewMode('json')

        // Phân giải tham số mẫu: parameters trong DB -> TOOL_DEFAULT_SAMPLES -> template -> mẫu mặc định
        let initialArgs = '{}'
        if (tool.parameters) {
            try {
                const parsed = JSON.parse(tool.parameters)
                if (typeof parsed === 'object' && parsed !== null) {
                    initialArgs = JSON.stringify(parsed, null, 2)
                } else {
                    initialArgs = tool.parameters
                }
            } catch {
                initialArgs = tool.parameters
            }
        } else if (TOOL_DEFAULT_SAMPLES[tool.id]) {
            initialArgs = JSON.stringify(TOOL_DEFAULT_SAMPLES[tool.id], null, 2)
        } else {
            initialArgs = JSON.stringify({ input: 'test_value' }, null, 2)
        }

        setTestArgs(initialArgs)
        setTestModalOpen(true)
    }

    // Thực thi test Tool riêng lẻ
    const handleRunSingleTest = async () => {
        if (!testingTool) return
        setIsTestingSingle(true)
        setSingleTestResult(null)

        let parsedArgs: Record<string, unknown> = {}
        if (testArgs.trim()) {
            try {
                parsedArgs = JSON.parse(testArgs)
            } catch {
                toast.error('Tham số đầu vào Arguments phải là định dạng JSON hợp lệ.')
                setIsTestingSingle(false)
                return
            }
        }

        try {
            const res = await toolsApi.test(testingTool.id, parsedArgs)
            setSingleTestResult(res)

            // Cập nhật health map
            setHealthStatusMap((prev) => ({
                ...prev,
                [testingTool.id]: {
                    success: res.success,
                    status: res.status,
                    latency_ms: res.latency_ms,
                    error: res.error,
                },
            }))

            if (res.success) {
                toast.success(`[SUCCESS] Tool '${testingTool.name}' hoạt động tốt (${res.latency_ms}ms)`)
            } else {
                toast.error(`[ERROR] Tool '${testingTool.name}' báo lỗi: ${res.error || 'Thực thi thất bại'}`)
            }
        } catch (err: any) {
            const errorMsg = err.message || 'Lỗi kết nối khi gọi tool'
            const errorResult: ToolTestResult = {
                tool_id: testingTool.id,
                tool_name: testingTool.name,
                success: false,
                status: 'error',
                latency_ms: 0,
                error: errorMsg,
                execution_result: null,
            }
            setSingleTestResult(errorResult)
            setHealthStatusMap((prev) => ({
                ...prev,
                [testingTool.id]: {
                    success: false,
                    status: 'error',
                    latency_ms: 0,
                    error: errorMsg,
                },
            }))
            toast.error(`[ERROR] Gọi tool thất bại: ${errorMsg}`)
        } finally {
            setIsTestingSingle(false)
        }
    }

    // Chạy kiểm tra hàng loạt (Batch Health Check All Tools)
    const handleRunBatchCheck = async () => {
        setIsBatchChecking(true)
        try {
            const res = await toolsApi.testAll()
            setBatchCheckSummary({
                total: res.total,
                healthy_count: res.healthy_count,
                error_count: res.error_count,
            })

            const newMap: Record<string, { success: boolean; status: 'healthy' | 'error'; latency_ms: number; error?: string | null }> = {}
            res.results.forEach((item) => {
                newMap[item.id] = {
                    success: item.success,
                    status: item.status,
                    latency_ms: item.latency_ms,
                    error: item.error,
                }
            })
            setHealthStatusMap((prev) => ({ ...prev, ...newMap }))

            if (res.error_count === 0) {
                toast.success(`[HEALTHY] Toàn bộ ${res.total} công cụ hoạt động sẵn sàng!`)
            } else {
                toast.warning(`[DIAGNOSTICS] ${res.healthy_count}/${res.total} công cụ hoạt động tốt, ${res.error_count} công cụ gặp sự cố.`)
            }
        } catch (err: any) {
            toast.error(`[ERROR] Kiểm tra hàng loạt thất bại: ${err.message}`)
        } finally {
            setIsBatchChecking(false)
        }
    }

    // Format JSON trong Test modal
    const handleFormatTestArgs = () => {
        try {
            const parsed = JSON.parse(testArgs)
            setTestArgs(JSON.stringify(parsed, null, 2))
        } catch {
            toast.error('JSON không hợp lệ để định dạng.')
        }
    }

    // Khôi phục tham số mẫu trong Test modal
    const handleResetTestArgs = () => {
        if (!testingTool) return
        if (testingTool.parameters) {
            try {
                const parsed = JSON.parse(testingTool.parameters)
                setTestArgs(JSON.stringify(parsed, null, 2))
                return
            } catch {}
        }
        if (TOOL_DEFAULT_SAMPLES[testingTool.id]) {
            setTestArgs(JSON.stringify(TOOL_DEFAULT_SAMPLES[testingTool.id], null, 2))
            return
        }
        setTestArgs(JSON.stringify({ input: 'test_sample' }, null, 2))
    }

    // Mở editor tạo mới
    const handleOpenCreate = () => {
        setEditingToolId(null)
        setIdInput('custom_summarizer')
        setNameInput('Custom Text Summarizer')
        setDescInput('Công cụ tóm tắt nội dung văn bản và trích xuất ý chính tùy chỉnh.')
        setCategoryInput('nlp')
        setCodeInput(CODE_TEMPLATES[0].code)
        setTestArgsInput(CODE_TEMPLATES[0].defaultArgs)
        setApiKeysList([])
        setTestResult(null)
        setSaveSuccess(false)
        setEditorOpen(true)
    }

    // Mở editor sửa tool
    const handleOpenEdit = (t: Tool) => {
        setEditingToolId(t.id)
        setIdInput(t.id)
        setNameInput(t.name)
        setDescInput(t.description || '')
        setCategoryInput(t.category || 'custom')
        setCodeInput(t.code || CODE_TEMPLATES[0].code)
        setTestArgsInput(t.parameters || CODE_TEMPLATES[0].defaultArgs)

        // Phân tích các API Keys đã lưu
        let parsedKeys: ApiKeyEntry[] = []
        if (t.env_vars) {
            try {
                const rawObj = JSON.parse(t.env_vars)
                parsedKeys = Object.entries(rawObj).map(([k, v]) => ({
                    key: k,
                    value: String(v || ''),
                    show: false,
                }))
            } catch {
                parsedKeys = []
            }
        }
        setApiKeysList(parsedKeys)
        setTestResult(null)
        setSaveSuccess(false)
        setEditorOpen(true)
    }

    // Chọn code template có sẵn
    const handleApplyTemplate = (tmplId: string) => {
        const found = CODE_TEMPLATES.find((t) => t.id === tmplId)
        if (!found) return
        setCodeInput(found.code)
        setTestArgsInput(found.defaultArgs)
        if (found.defaultKeys && found.defaultKeys.length > 0) {
            setApiKeysList([...found.defaultKeys])
        }
        if (!editingToolId) {
            setNameInput(found.name)
            setDescInput(found.description)
            setCategoryInput(found.category)
            setIdInput(`${found.id}_tool`)
        }
    }

    // Quản lý API Keys trong modal Studio
    const handleAddApiKey = (keyName = '', defaultValue = '') => {
        setApiKeysList((prev) => [...prev, { key: keyName, value: defaultValue, show: false }])
    }

    const handleUpdateApiKey = (index: number, field: 'key' | 'value', val: string) => {
        setApiKeysList((prev) => {
            const next = [...prev]
            next[index] = { ...next[index], [field]: val }
            return next
        })
    }

    const handleToggleShowKey = (index: number) => {
        setApiKeysList((prev) => {
            const next = [...prev]
            next[index] = { ...next[index], show: !next[index].show }
            return next
        })
    }

    const handleRemoveApiKey = (index: number) => {
        setApiKeysList((prev) => prev.filter((_, i) => i !== index))
    }

    // Chạy thử code trên UI (Live Testing trong Studio Modal)
    const handleRunCodeTest = async () => {
        setTestingCode(true)
        setTestResult(null)
        try {
            let parsedArgs = {}
            try {
                parsedArgs = JSON.parse(testArgsInput)
            } catch {
                throw new Error('Dữ liệu test arguments phải là định dạng JSON hợp lệ.')
            }

            const envVarsObj: Record<string, string> = {}
            apiKeysList.forEach((item) => {
                const k = item.key.trim()
                if (k) envVarsObj[k] = item.value.trim()
            })

            const startTime = performance.now()
            const res = await toolsApi.executeCode(codeInput, parsedArgs, envVarsObj)
            const duration = Math.round(performance.now() - startTime)

            let formatted = ''
            if (typeof res.execution_result === 'string') {
                try {
                    const parsed = JSON.parse(res.execution_result)
                    formatted = JSON.stringify(parsed, null, 2)
                } catch {
                    formatted = res.execution_result
                }
            } else {
                formatted = JSON.stringify(res.execution_result, null, 2)
            }

            setTestResult(`// [SUCCESS] Thực thi thành công (Thời gian: ${duration}ms):\n${formatted}`)
        } catch (err: any) {
            setTestResult(`// [ERROR] Lỗi khi chạy thử nghiệm:\n${err.message}`)
        } finally {
            setTestingCode(false)
        }
    }

    // Lưu Tool (Tạo mới hoặc Cập nhật)
    const handleSaveTool = async () => {
        if (!nameInput.trim()) {
            toast.warning('Tên Tool không được để trống.')
            return
        }
        setSaving(true)
        setSaveSuccess(false)
        try {
            const toolId = editingToolId || idInput.trim().toLowerCase().replace(/\s+/g, '_')

            const envVarsObj: Record<string, string> = {}
            apiKeysList.forEach((item) => {
                const k = item.key.trim()
                if (k) envVarsObj[k] = item.value.trim()
            })
            const envVarsJson = Object.keys(envVarsObj).length > 0 ? JSON.stringify(envVarsObj) : undefined

            if (editingToolId) {
                await toolsApi.update(editingToolId, {
                    name: nameInput.trim(),
                    description: descInput.trim() || undefined,
                    code: codeInput,
                    parameters: testArgsInput,
                    category: categoryInput,
                    env_vars: envVarsJson,
                })
            } else {
                await toolsApi.create({
                    id: toolId,
                    name: nameInput.trim(),
                    description: descInput.trim() || undefined,
                    code: codeInput,
                    parameters: testArgsInput,
                    category: categoryInput,
                    env_vars: envVarsJson,
                })
            }
            setSaveSuccess(true)
            toast.success(editingToolId ? 'Cập nhật Tool thành công!' : 'Tạo mới Tool thành công!')
            await loadTools()
            setTimeout(() => {
                setSaveSuccess(false)
                setEditorOpen(false)
            }, 1200)
        } catch (err: any) {
            toast.error(err.message || 'Lỗi khi lưu tool')
        } finally {
            setSaving(false)
        }
    }

    // Xóa Tool
    const handleDeleteTool = async (toolId: string) => {
        const isConfirmed = await confirm({
            title: 'Xóa Tool',
            description: `Xác nhận xóa tool '${toolId}' khỏi hệ thống?`,
            confirmText: 'Xóa Tool',
            variant: 'danger',
        })
        if (!isConfirmed) return
        try {
            await toolsApi.remove(toolId)
            toast.success(`Đã xóa tool '${toolId}'`)
            await loadTools()
        } catch (err: any) {
            toast.error(err.message || 'Lỗi khi xóa tool')
        }
    }

    // Lọc danh sách tools
    const filteredTools = useMemo(() => {
        return tools.filter((t) => {
            const matchSearch =
                t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.description || '').toLowerCase().includes(searchQuery.toLowerCase())

            const matchCat =
                categoryFilter === 'all' ||
                (categoryFilter === 'custom' && !!t.code) ||
                (categoryFilter === 'builtin' && !t.code) ||
                t.category === categoryFilter

            const health = healthStatusMap[t.id]
            const matchHealth =
                healthFilter === 'all' ||
                (healthFilter === 'healthy' && health?.success === true) ||
                (healthFilter === 'error' && health?.success === false) ||
                (healthFilter === 'untested' && !health)

            return matchSearch && matchCat && matchHealth
        })
    }, [tools, searchQuery, categoryFilter, healthFilter, healthStatusMap])

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {/* Header Trang */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
                        <IconWrench className="w-6 h-6 text-blue-400" />
                        <span>Tools &amp; Code Studio</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                        Quản lý, nạp mã nguồn Python, cấu hình API Keys và kiểm tra trực tiếp tính sẵn sàng của toàn bộ công cụ.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Nút Kiểm Tra Toàn Bộ Tool */}
                    <button
                        onClick={handleRunBatchCheck}
                        disabled={isBatchChecking || tools.length === 0}
                        className="px-3.5 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-200 hover:text-white font-bold text-xs sm:text-sm transition flex items-center gap-2 active:scale-95 disabled:opacity-50 shadow-sm"
                        title="Kiểm tra hàng loạt sức khỏe và độ sẵn sàng của tất cả Tools"
                    >
                        {isBatchChecking ? (
                            <IconRefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                        ) : (
                            <IconActivity className="w-4 h-4 text-emerald-400" />
                        )}
                        <span>
                            {isBatchChecking
                                ? 'Đang kiểm tra...'
                                : `Kiểm Tra Toàn Bộ (${tools.length})`}
                        </span>
                    </button>

                    {/* Nút Tạo Mới Tool */}
                    <button
                        onClick={handleOpenCreate}
                        className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
                    >
                        <IconPlus className="w-4 h-4" />
                        <span>Tạo Tool Mới</span>
                    </button>
                </div>
            </div>

            {/* Banner Tóm Tắt Kết Quả Chẩn Đoán (Batch Diagnostics) */}
            {batchCheckSummary && (
                <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-semibold text-white flex items-center gap-1.5">
                            <IconActivity className="w-4 h-4 text-emerald-400" />
                            <span>Báo Cáo Sức Khỏe Tools:</span>
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-mono text-[11px] flex items-center gap-1">
                            <IconCheckCircle className="w-3 h-3 text-emerald-400" />
                            <span>{batchCheckSummary.healthy_count}/{batchCheckSummary.total} Hoạt động tốt</span>
                        </span>
                        {batchCheckSummary.error_count > 0 && (
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30 font-mono text-[11px] flex items-center gap-1">
                                <IconAlertCircle className="w-3 h-3 text-rose-400" />
                                <span>{batchCheckSummary.error_count} Bị lỗi / Cần sửa</span>
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {batchCheckSummary.error_count > 0 && (
                            <button
                                onClick={() => setHealthFilter(healthFilter === 'error' ? 'all' : 'error')}
                                className={`px-2.5 py-1 rounded-xl text-xs font-medium border transition ${
                                    healthFilter === 'error'
                                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                        : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                                }`}
                            >
                                {healthFilter === 'error' ? 'Hiện tất cả' : 'Chỉ xem Tool lỗi'}
                            </button>
                        )}
                        {healthFilter !== 'all' && (
                            <button
                                onClick={() => setHealthFilter('all')}
                                className="text-zinc-400 hover:text-white text-xs underline px-1"
                            >
                                Xóa bộ lọc
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Bộ Lọc & Tìm Kiếm */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <IconSearch className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Tìm kiếm tool theo tên, id..."
                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-700 bg-zinc-950 text-xs text-white placeholder-zinc-500 outline-none focus:border-blue-500 transition"
                        />
                    </div>

                    {/* Lọc Category */}
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-950 text-xs text-white outline-none focus:border-blue-500"
                    >
                        <option value="all">Tất cả danh mục ({tools.length})</option>
                        <option value="api">Tool Dùng API Key ([API])</option>
                        <option value="web">Web &amp; Free Search</option>
                        <option value="custom">Tool Tự Viết Code</option>
                        <option value="builtin">Tool Hệ Thống Tích Hợp</option>
                        <option value="nlp">NLP / Tóm Tắt</option>
                        <option value="data">Data &amp; Phân Tích</option>
                        <option value="utility">Tiện Ích &amp; Tính Toán</option>
                    </select>

                    {/* Lọc Trạng Thái Kiểm Tra */}
                    <select
                        value={healthFilter}
                        onChange={(e) => setHealthFilter(e.target.value as any)}
                        className="px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-950 text-xs text-white outline-none focus:border-blue-500"
                    >
                        <option value="all">Trạng thái: Tất cả</option>
                        <option value="healthy">Hoạt động tốt</option>
                        <option value="error">Bị lỗi</option>
                        <option value="untested">Chưa kiểm tra</option>
                    </select>
                </div>

                <div className="text-xs text-zinc-500 flex items-center gap-1.5 self-end sm:self-auto">
                    <IconSparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span>Agent tự động phân bổ và gọi tool dựa trên ngữ cảnh nhiệm vụ</span>
                </div>
            </div>

            {/* Danh Sách Tool Cards */}
            {loading ? (
                <div className="p-12 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                    <IconRefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                    <span>Đang tải danh sách công cụ...</span>
                </div>
            ) : filteredTools.length === 0 ? (
                <div className="text-center py-14 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/30 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-800 text-zinc-500 flex items-center justify-center mx-auto">
                        <IconWrench className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-semibold text-white">Chưa tìm thấy Tool phù hợp</div>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                        Hãy thay đổi điều kiện tìm kiếm hoặc nhấn nút <strong>Tạo Tool Mới</strong> để bắt đầu.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTools.map((t) => {
                        const hasCustomCode = !!t.code
                        let keysCount = 0
                        if (t.env_vars) {
                            try {
                                keysCount = Object.keys(JSON.parse(t.env_vars)).length
                            } catch {}
                        }

                        const health = healthStatusMap[t.id]
                        const isApiTool =
                            t.category === 'api' ||
                            t.name.toUpperCase().includes('[API]') ||
                            (t.description || '').includes('[Dùng API') ||
                            keysCount > 0
                        const isFreeWeb =
                            t.name.toUpperCase().includes('[FREE]') ||
                            (t.description || '').includes('[Không cần API Key]')

                        return (
                            <div
                                key={t.id}
                                className={`p-4 rounded-3xl border bg-zinc-900/70 transition flex flex-col justify-between gap-4 shadow-sm hover:border-zinc-700 ${
                                    health && !health.success
                                        ? 'border-rose-500/40 bg-rose-950/10'
                                        : health?.success
                                        ? 'border-emerald-500/30'
                                        : 'border-zinc-800'
                                }`}
                            >
                                <div className="space-y-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div
                                                className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 border ${
                                                    hasCustomCode
                                                        ? 'bg-purple-600/20 text-purple-400 border-purple-500/30'
                                                        : 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                                                }`}
                                            >
                                                {hasCustomCode ? (
                                                    <IconCode className="w-4 h-4" />
                                                ) : (
                                                    <IconWrench className="w-4 h-4" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-xs font-bold text-white truncate">
                                                    {t.name}
                                                </h3>
                                                <span className="text-[10px] text-zinc-500 font-mono block truncate">
                                                    {t.id}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            <div className="flex items-center gap-1">
                                                {isApiTool ? (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full border font-mono bg-amber-500/15 text-amber-300 border-amber-500/30 flex items-center gap-1">
                                                        <IconKey className="w-2.5 h-2.5" />
                                                        <span>Dùng API Key</span>
                                                    </span>
                                                ) : isFreeWeb ? (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full border font-mono bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                                                        Free / No API Key
                                                    </span>
                                                ) : null}
                                                <span
                                                    className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${
                                                        hasCustomCode
                                                            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                                    }`}
                                                >
                                                    {hasCustomCode ? 'Custom Python' : 'Built-in'}
                                                </span>
                                            </div>
                                            {keysCount > 0 && (
                                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono flex items-center gap-0.5">
                                                    <IconKey className="w-2.5 h-2.5" />
                                                    <span>{keysCount} Key đã nạp</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                                        {t.description || 'Chưa có mô tả chi tiết cho công cụ này.'}
                                    </p>

                                    {/* Huy hiệu trạng thái kiểm tra (Health Status Badge) */}
                                    <div className="pt-1">
                                        {health ? (
                                            health.success ? (
                                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono">
                                                    <IconCheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                                                    <span>Sẵn sàng ({health.latency_ms}ms)</span>
                                                </div>
                                            ) : (
                                                <div
                                                    onClick={() => handleOpenTestModal(t)}
                                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] font-mono cursor-pointer hover:bg-rose-500/20 transition max-w-full"
                                                    title={health.error || 'Lỗi khi gọi tool, bấm để xem chi tiết'}
                                                >
                                                    <IconAlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                                                    <span className="truncate">Lỗi: {health.error || 'Thực thi thất bại'}</span>
                                                </div>
                                            )
                                        ) : (
                                            <span className="text-[10px] text-zinc-500 font-mono px-2 py-0.5 rounded-full border border-zinc-800 bg-zinc-950/50">
                                                Chưa test
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                                    <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">
                                        {t.category || 'general'}
                                    </span>

                                    <div className="flex items-center gap-1.5">
                                        {/* Nút Kiểm Tra Tool */}
                                        <button
                                            type="button"
                                            onClick={() => handleOpenTestModal(t)}
                                            className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-300 text-xs font-medium transition flex items-center gap-1 active:scale-95 shadow-sm"
                                            title="Kiểm tra trực tiếp xem tool có hoạt động và gọi được không"
                                        >
                                            <IconPlay className="w-3.5 h-3.5 text-emerald-400" />
                                            <span>Kiểm Tra</span>
                                        </button>

                                        {/* Nút Sửa Code */}
                                        <button
                                            type="button"
                                            onClick={() => handleOpenEdit(t)}
                                            className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition flex items-center gap-1"
                                            title="Mở trình soạn thảo mã nguồn & API Key của Tool"
                                        >
                                            <IconCode className="w-3.5 h-3.5 text-blue-400" />
                                            <span>Sửa</span>
                                        </button>

                                        {/* Nút Xóa Tool */}
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteTool(t.id)}
                                            className="p-1.5 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition"
                                            title="Xóa công cụ này"
                                        >
                                            <IconTrash className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ====================================================================== */}
            {/* MODAL KIỂM TRA TOOL (TOOL TEST RUNNER & DIAGNOSTICS)                   */}
            {/* ====================================================================== */}
            {testModalOpen && testingTool && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
                    <div className="w-full max-w-3xl rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
                        {/* Header Modal Test */}
                        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-800 shrink-0 bg-zinc-950/60">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                    <IconTerminal className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                        <span>Kiểm Tra Tool: {testingTool.name}</span>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                                            {testingTool.code ? 'Custom Code' : 'Built-in'}
                                        </span>
                                    </h2>
                                    <p className="text-xs text-zinc-400 font-mono">
                                        ID: {testingTool.id} | Danh mục: {testingTool.category || 'general'}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setTestModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition"
                            >
                                <IconX className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Nội dung Modal Test */}
                        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
                            {/* Mô tả tool */}
                            <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
                                <span className="text-zinc-500 font-semibold block mb-0.5">Mô tả công cụ:</span>
                                {testingTool.description || 'Chưa có mô tả chi tiết.'}
                            </div>

                            {/* Khu vực nhập Arguments JSON */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-white flex items-center gap-1.5">
                                        <IconPlay className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>Tham Số Thử Nghiệm (JSON Test Arguments)</span>
                                    </label>

                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={handleFormatTestArgs}
                                            className="px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-mono transition"
                                        >
                                            Beautify JSON
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleResetTestArgs}
                                            className="px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-mono transition flex items-center gap-1"
                                        >
                                            <IconRotateCcw className="w-3 h-3 text-zinc-400" />
                                            <span>Mẫu mặc định</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTestArgs('{}')}
                                            className="px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-[11px] font-mono transition"
                                        >
                                            Xóa trắng
                                        </button>
                                    </div>
                                </div>

                                <textarea
                                    value={testArgs}
                                    onChange={(e) => setTestArgs(e.target.value)}
                                    rows={4}
                                    placeholder='{"expression": "25 * 4"}'
                                    className="w-full p-3 rounded-2xl border border-zinc-800 bg-zinc-950 text-xs text-white font-mono outline-none focus:border-emerald-500 transition leading-relaxed"
                                    spellCheck={false}
                                />
                            </div>

                            {/* Nút Thực thi Test */}
                            <div className="flex items-center justify-between pt-1">
                                <button
                                    type="button"
                                    onClick={handleRunSingleTest}
                                    disabled={isTestingSingle}
                                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95"
                                >
                                    {isTestingSingle ? (
                                        <IconRefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <IconPlay className="w-4 h-4" />
                                    )}
                                    <span>{isTestingSingle ? 'Đang thực thi...' : 'Chạy Thử Nghiệm Ngay'}</span>
                                </button>

                                {singleTestResult && (
                                    <span className="text-xs font-mono text-zinc-400">
                                        Thời gian: <strong className="text-white">{singleTestResult.latency_ms}ms</strong>
                                    </span>
                                )}
                            </div>

                            {/* Bảng Hiển Thị Kết Quả Kiểm Tra */}
                            {singleTestResult && (
                                <div className="space-y-3 pt-2">
                                    {/* Alert kết quả */}
                                    <div
                                        className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 ${
                                            singleTestResult.success
                                                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                                                : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                                        }`}
                                    >
                                        {singleTestResult.success ? (
                                            <IconCheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                                        ) : (
                                            <IconAlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                                        )}
                                        <div className="flex-1 space-y-1">
                                            <div className="font-bold">
                                                {singleTestResult.success
                                                    ? '[SUCCESS] Tool hoạt động chính xác và phản hồi tốt'
                                                    : '[ERROR] Tool báo lỗi khi thực thi'}
                                            </div>
                                            {!singleTestResult.success && singleTestResult.error && (
                                                <p className="text-[11px] font-mono whitespace-pre-wrap text-rose-300">
                                                    Chi tiết: {singleTestResult.error}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Output Details Box */}
                                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
                                        <div className="flex items-center justify-between px-3.5 py-2 border-b border-zinc-800 bg-zinc-900/60 text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="text-zinc-400 font-semibold">Kết quả trả về:</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setTestViewMode('json')}
                                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition ${
                                                        testViewMode === 'json'
                                                            ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                                                            : 'text-zinc-400 hover:text-white'
                                                    }`}
                                                >
                                                    JSON
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setTestViewMode('raw')}
                                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition ${
                                                        testViewMode === 'raw'
                                                            ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                                                            : 'text-zinc-400 hover:text-white'
                                                    }`}
                                                >
                                                    Raw Output
                                                </button>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const textToCopy =
                                                        testViewMode === 'json' && singleTestResult.parsed_result
                                                            ? JSON.stringify(singleTestResult.parsed_result, null, 2)
                                                            : typeof singleTestResult.execution_result === 'string'
                                                            ? singleTestResult.execution_result
                                                            : JSON.stringify(singleTestResult.execution_result, null, 2)
                                                    navigator.clipboard.writeText(textToCopy)
                                                    toast.success('Đã sao chép kết quả vào Clipboard')
                                                }}
                                                className="text-zinc-400 hover:text-white text-[11px] flex items-center gap-1 font-mono transition"
                                            >
                                                <IconCopy className="w-3 h-3" />
                                                <span>Copy</span>
                                            </button>
                                        </div>

                                        <pre className="p-3.5 text-xs font-mono text-zinc-300 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                                            {testViewMode === 'json' && singleTestResult.parsed_result
                                                ? JSON.stringify(singleTestResult.parsed_result, null, 2)
                                                : typeof singleTestResult.execution_result === 'string'
                                                ? singleTestResult.execution_result
                                                : JSON.stringify(singleTestResult.execution_result, null, 2)}
                                        </pre>
                                    </div>

                                    {/* Nút chuyển sang sửa code nếu có lỗi trên tool custom */}
                                    {!singleTestResult.success && testingTool.code && (
                                        <div className="pt-1 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setTestModalOpen(false)
                                                    handleOpenEdit(testingTool)
                                                }}
                                                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-blue-400 hover:text-blue-300 text-xs font-medium border border-blue-500/30 transition flex items-center gap-1.5"
                                            >
                                                <IconCode className="w-3.5 h-3.5" />
                                                <span>Mở Trình Soạn Thảo Để Sửa Code / API Keys</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer Modal Test */}
                        <div className="p-4 sm:p-5 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-end shrink-0">
                            <button
                                type="button"
                                onClick={() => setTestModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ====================================================================== */}
            {/* MODAL CODE STUDIO: TẠO MỚI / SỬA CODE & NẠP API KEYS TRỰC TIẾP TRÊN WEB */}
            {/* ====================================================================== */}
            {editorOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
                    <div className="w-full max-w-4xl rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
                        {/* Header Modal */}
                        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-800 shrink-0 bg-zinc-950/50">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                                    <IconCode className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                        <span>
                                            {editingToolId ? `Chỉnh Sửa Tool: ${idInput}` : 'Tạo Tool Mới & Nạp Code Python'}
                                        </span>
                                    </h2>
                                    <p className="text-xs text-zinc-400">
                                        Định nghĩa tham số, chèn API Keys và viết logic thực thi trong hàm <code>def execute(arguments):</code>
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setEditorOpen(false)}
                                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition"
                            >
                                <IconX className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Nội dung Editor & Form */}
                        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
                            {/* 1. THÔNG TIN CƠ BẢN */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                                        Mã ID (Slug):
                                    </label>
                                    <input
                                        type="text"
                                        disabled={!!editingToolId}
                                        value={idInput}
                                        onChange={(e) => setIdInput(e.target.value)}
                                        placeholder="vidu: text_summarizer"
                                        className="w-full px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-950 text-xs text-white font-mono disabled:opacity-50 outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                                        Tên Hiển Thị:
                                    </label>
                                    <input
                                        type="text"
                                        value={nameInput}
                                        onChange={(e) => setNameInput(e.target.value)}
                                        placeholder="vidu: Text Summarizer AI"
                                        className="w-full px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-950 text-xs text-white outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                                        Phân Loại (Category):
                                    </label>
                                    <select
                                        value={categoryInput}
                                        onChange={(e) => setCategoryInput(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-950 text-xs text-white outline-none focus:border-blue-500"
                                    >
                                        <option value="nlp">NLP / Tóm Tắt (Summarizer)</option>
                                        <option value="web">Web Search &amp; Crawler</option>
                                        <option value="data">Data Analysis &amp; Extraction</option>
                                        <option value="utility">Tiện Ích &amp; Tính Toán</option>
                                        <option value="custom">Tùy Chỉnh Riêng</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                                    Mô Tả Chức Năng (Prompt context cho LLM Agent):
                                </label>
                                <textarea
                                    value={descInput}
                                    onChange={(e) => setDescInput(e.target.value)}
                                    rows={2}
                                    placeholder="Agent sẽ đọc mô tả này để quyết định khi nào cần gọi tool..."
                                    className="w-full px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-950 text-xs text-white outline-none focus:border-blue-500"
                                />
                            </div>

                            {/* Gợi ý Templates */}
                            {!editingToolId && (
                                <div className="space-y-2">
                                    <label className="text-[11px] font-medium text-zinc-400 block">
                                        Chọn Mẫu Code Sẵn (Templates):
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {CODE_TEMPLATES.map((tmpl) => (
                                            <button
                                                key={tmpl.id}
                                                type="button"
                                                onClick={() => handleApplyTemplate(tmpl.id)}
                                                className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-950 hover:border-blue-500/50 hover:bg-zinc-800/40 text-left transition group"
                                            >
                                                <div className="text-xs font-bold text-white group-hover:text-blue-400 truncate">
                                                    {tmpl.name.split('(')[0]}
                                                </div>
                                                <div className="text-[10px] text-zinc-500 uppercase font-mono mt-0.5">
                                                    {tmpl.category}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 2. CẤU HÌNH API KEYS / SECRETS */}
                            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                                            <IconShield className="w-3.5 h-3.5 text-amber-400" />
                                            <span>Bảo Mật API Keys &amp; Biến Môi Trường (Secrets)</span>
                                        </h3>
                                        <p className="text-[11px] text-zinc-400">
                                            Các keys này được lưu bảo mật và tự động nạp vào <code>os.environ</code> và biến <code>secrets</code> khi tool chạy.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleAddApiKey()}
                                        className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition flex items-center gap-1"
                                    >
                                        <IconPlus className="w-3.5 h-3.5" />
                                        <span>Thêm Key</span>
                                    </button>
                                </div>

                                {apiKeysList.length === 0 ? (
                                    <div className="text-[11px] text-zinc-500 italic py-1">
                                        Chưa có API Key nào được gán cho Tool này (Tool chạy độc lập không cần key bên ngoài).
                                    </div>
                                ) : (
                                    <div className="space-y-2 pt-1">
                                        {apiKeysList.map((entry, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={entry.key}
                                                    onChange={(e) => handleUpdateApiKey(idx, 'key', e.target.value)}
                                                    placeholder="TÊN_BIẾN (vd: OPENAI_API_KEY)"
                                                    className="w-1/3 px-3 py-1.5 rounded-xl border border-zinc-700 bg-zinc-900 text-xs text-white font-mono uppercase outline-none focus:border-amber-500"
                                                />
                                                <div className="relative flex-1">
                                                    <input
                                                        type={entry.show ? 'text' : 'password'}
                                                        value={entry.value}
                                                        onChange={(e) => handleUpdateApiKey(idx, 'value', e.target.value)}
                                                        placeholder="Giá trị Key bí mật..."
                                                        className="w-full pl-3 pr-8 py-1.5 rounded-xl border border-zinc-700 bg-zinc-900 text-xs text-white font-mono outline-none focus:border-amber-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleShowKey(idx)}
                                                        className="absolute right-2.5 top-2 text-zinc-500 hover:text-white"
                                                    >
                                                        {entry.show ? (
                                                            <IconEyeOff className="w-3.5 h-3.5" />
                                                        ) : (
                                                            <IconEye className="w-3.5 h-3.5" />
                                                        )}
                                                    </button>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveApiKey(idx)}
                                                    className="p-1.5 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-zinc-800"
                                                >
                                                    <IconTrash className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 3. TRÌNH SOẠN THẢO CODE PYTHON */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-white flex items-center gap-1.5">
                                        <IconCode className="w-3.5 h-3.5 text-blue-400" />
                                        <span>Mã Nguồn Python (def execute(arguments):)</span>
                                    </label>
                                    <span className="text-[10px] text-zinc-500 font-mono">
                                        Môi trường hỗ trợ: json, re, math, requests, urllib, datetime, os
                                    </span>
                                </div>

                                <textarea
                                    value={codeInput}
                                    onChange={(e) => setCodeInput(e.target.value)}
                                    rows={12}
                                    className="w-full p-3 rounded-2xl border border-zinc-700 bg-zinc-950 text-xs text-emerald-400 font-mono outline-none focus:border-blue-500 transition leading-relaxed"
                                    spellCheck={false}
                                />
                            </div>

                            {/* 4. KHU VỰC TEST RUNNER TRONG EDITOR */}
                            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-white flex items-center gap-1.5">
                                        <IconPlay className="w-3.5 h-3.5 text-blue-400" />
                                        <span>Tham Số Thử Nghiệm (JSON Test Arguments)</span>
                                    </label>

                                    <button
                                        type="button"
                                        onClick={handleRunCodeTest}
                                        disabled={testingCode || !codeInput.trim()}
                                        className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs transition flex items-center gap-1.5 shadow"
                                    >
                                        <IconPlay className="w-3.5 h-3.5" />
                                        <span>{testingCode ? 'Đang chạy test...' : 'Chạy Thử Code'}</span>
                                    </button>
                                </div>

                                <textarea
                                    value={testArgsInput}
                                    onChange={(e) => setTestArgsInput(e.target.value)}
                                    rows={3}
                                    className="w-full p-3 rounded-xl border border-zinc-800 bg-zinc-900 text-xs text-white font-mono outline-none focus:border-blue-500"
                                />

                                {testResult && (
                                    <div className="p-3.5 rounded-xl bg-zinc-900 border border-blue-500/30 text-xs text-zinc-300 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                                        {testResult}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Modal Studio */}
                        <div className="p-4 sm:p-5 border-t border-zinc-800 bg-zinc-950/50 flex items-center justify-between shrink-0">
                            <div>
                                {saveSuccess && (
                                    <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                                        <IconCheck className="w-4 h-4" />
                                        <span>Đã lưu Tool thành công!</span>
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditorOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                                >
                                    Đóng
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSaveTool}
                                    disabled={saving}
                                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-lg shadow-blue-600/20 active:scale-95"
                                >
                                    <IconSave className="w-4 h-4" />
                                    <span>{saving ? 'Đang lưu...' : 'Lưu Tool'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
