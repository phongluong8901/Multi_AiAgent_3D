'use client'

import { useEffect, useState, useMemo } from 'react'
import { toolsApi, Tool } from '@/lib/api'
import {
    IconWrench,
    IconCode,
    IconPlus,
    IconSave,
    IconTrash,
    IconPlay,
    IconRefreshCw,
    IconCheck,
    IconAlertCircle,
    IconSearch,
    IconTerminal,
    IconSparkles,
    IconFileText,
    IconX,
    IconCopy,
    IconLayers,
    IconKey,
    IconEye,
    IconEyeOff,
    IconShield,
} from '@/components/ui/icons'

type ApiKeyEntry = {
    key: string
    value: string
    show?: boolean
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
                text: 'Trí tuệ nhân tạo (AI) đang phát triển với tốc độ chóng mặt trên toàn cầu. Các hệ thống đa tác nhân (Multi-Agent Systems) cho phép nhiều mô hình AI chuyên biệt phối hợp cùng nhau để giải quyết các bài toán kỹ thuật phức tạp mà một mô hình đơn lẻ khó lòng đáp ứng. Việc tích hợp các công cụ mở rộng (Tools) giúp Agent có thể tự động duyệt web, tính toán dữ liệu, tóm tắt báo cáo và tương tác với các hệ vi dịch vụ một cách liền mạch.',
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
]

export default function ToolsStudioPage() {
    const [tools, setTools] = useState<Tool[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [categoryFilter, setCategoryFilter] = useState<string>('all')

    // Modal Studio Editor
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
            console.error('Lỗi tải danh sách tools:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadTools()
    }, [])

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

    // Quản lý API Keys trong modal
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

    // Chạy thử code trên UI (Live Testing)
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

            // Chuyển danh sách API Keys thành dictionary { KEY: VALUE }
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

            setTestResult(`// Kết quả thực thi thành công (Thời gian: ${duration}ms):\n${formatted}`)
        } catch (err: any) {
            setTestResult(`// Lỗi khi chạy thử nghiệm:\n${err.message}`)
        } finally {
            setTestingCode(false)
        }
    }

    // Lưu Tool (Tạo mới hoặc Cập nhật)
    const handleSaveTool = async () => {
        if (!nameInput.trim()) {
            alert('Tên Tool không được để trống.')
            return
        }
        setSaving(true)
        setSaveSuccess(false)
        try {
            const toolId = editingToolId || idInput.trim().toLowerCase().replace(/\s+/g, '_')

            // Đóng gói API Keys thành chuỗi JSON
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
            await loadTools()
            setTimeout(() => {
                setSaveSuccess(false)
                setEditorOpen(false)
            }, 1200)
        } catch (err: any) {
            alert(err.message || 'Lỗi khi lưu tool')
        } finally {
            setSaving(false)
        }
    }

    // Xóa Tool
    const handleDeleteTool = async (toolId: string) => {
        if (!confirm(`Xác nhận xóa tool '${toolId}' khỏi hệ thống?`)) return
        try {
            await toolsApi.remove(toolId)
            await loadTools()
        } catch (err: any) {
            alert(err.message || 'Lỗi khi xóa tool')
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
            return matchSearch && matchCat
        })
    }, [tools, searchQuery, categoryFilter])

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
                        Tự tạo mới, nạp và chỉnh sửa mã nguồn Python của các Tools trực tiếp trên giao diện,
                        kết hợp nạp API Keys bảo mật để trang bị siêu năng lực cho các Agent.
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        onClick={handleOpenCreate}
                        className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
                    >
                        <IconPlus className="w-4 h-4" />
                        <span>Tạo Tool Mới (Nạp Code &amp; API Key)</span>
                    </button>
                </div>
            </div>

            {/* Bộ Lọc & Tìm Kiếm */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-72">
                        <IconSearch className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Tìm kiếm tool theo tên, id..."
                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-700 bg-zinc-950 text-xs text-white placeholder-zinc-500 outline-none focus:border-blue-500 transition"
                        />
                    </div>

                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-950 text-xs text-white outline-none focus:border-blue-500"
                    >
                        <option value="all">Tất cả Tool ({tools.length})</option>
                        <option value="custom">Tool Tự Viết Code</option>
                        <option value="builtin">Tool Hệ Thống Tích Hợp</option>
                        <option value="nlp">NLP / Tóm Tắt</option>
                        <option value="web">Web &amp; API Search</option>
                        <option value="data">Data &amp; Phân Tích</option>
                        <option value="utility">Tiện Ích &amp; Tính Toán</option>
                    </select>
                </div>

                <div className="text-xs text-zinc-500 flex items-center gap-1.5 self-end sm:self-auto">
                    <IconSparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span>Agent trong phòng tự động gọi Tool dựa trên mô tả nhiệm vụ</span>
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
                        Hãy nhấn vào nút <strong>Tạo Tool Mới (Nạp Code &amp; API Key)</strong> để bắt đầu.
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

                        return (
                            <div
                                key={t.id}
                                className="p-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 hover:border-zinc-700 transition flex flex-col justify-between gap-4 shadow-sm"
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
                                            <span
                                                className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${
                                                    hasCustomCode
                                                        ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                                }`}
                                            >
                                                {hasCustomCode ? 'Custom Python' : 'Built-in'}
                                            </span>
                                            {keysCount > 0 && (
                                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono flex items-center gap-0.5">
                                                    <IconKey className="w-2.5 h-2.5" />
                                                    <span>{keysCount} Key</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                                        {t.description || 'Chưa có mô tả chi tiết cho công cụ này.'}
                                    </p>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                                    <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">
                                        {t.category || 'general'}
                                    </span>

                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenEdit(t)}
                                            className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition flex items-center gap-1"
                                            title="Mở trình soạn thảo mã nguồn & API Key của Tool"
                                        >
                                            <IconCode className="w-3.5 h-3.5 text-blue-400" />
                                            <span>Sửa Code</span>
                                        </button>

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
                                    Mô tả nhiệm vụ của Tool (Prompt cho LLM Agent nhận diện lúc nào nên gọi):
                                </label>
                                <input
                                    type="text"
                                    value={descInput}
                                    onChange={(e) => setDescInput(e.target.value)}
                                    placeholder="Tóm tắt văn bản dài hoặc lịch sử chat thành các ý chính súc tích..."
                                    className="w-full px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-950 text-xs text-white outline-none focus:border-blue-500"
                                />
                            </div>

                            {/* 2. KHU VỰC CẤU HÌNH API KEYS / SECRETS */}
                            <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                                            <IconKey className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                                                <span>Cấu Hình API Keys &amp; Biến Môi Trường (Secrets)</span>
                                                <span className="text-[10px] text-zinc-500 font-normal">
                                                    ({apiKeysList.length} Keys)
                                                </span>
                                            </h3>
                                            <p className="text-[10px] text-zinc-400">
                                                Tự động nạp vào <code>os.getenv("KEY")</code> hoặc biến <code>secrets["KEY"]</code> trong code
                                            </p>
                                        </div>
                                    </div>

                                    {/* Nút thêm nhanh */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleAddApiKey('GOOGLE_API_KEY', '')
                                                handleAddApiKey('GOOGLE_CSE_ID', '')
                                            }}
                                            className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-amber-500/40 text-[10px] text-zinc-300 transition"
                                        >
                                            + Google Search Keys
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleAddApiKey('OPENWEATHER_API_KEY', '')}
                                            className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-amber-500/40 text-[10px] text-zinc-300 transition"
                                        >
                                            + Weather Key
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleAddApiKey('CUSTOM_API_KEY', '')}
                                            className="px-2.5 py-1 rounded-lg bg-amber-600/20 border border-amber-500/30 text-amber-300 text-[10px] font-semibold transition flex items-center gap-1"
                                        >
                                            <IconPlus className="w-3 h-3" />
                                            <span>Thêm Key</span>
                                        </button>
                                    </div>
                                </div>

                                {apiKeysList.length === 0 ? (
                                    <div className="text-center py-4 text-[11px] text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                                        Chưa có API Key nào được gắn. Nếu Tool của bạn gọi dịch vụ ngoài (Google Search, Weather, v.v.), hãy nhấn <strong>Thêm Key</strong>.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {apiKeysList.map((entry, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center gap-2 p-2 rounded-xl bg-zinc-900 border border-zinc-800"
                                            >
                                                {/* Tên Biến Key */}
                                                <div className="w-1/3 min-w-[140px]">
                                                    <input
                                                        type="text"
                                                        value={entry.key}
                                                        onChange={(e) =>
                                                            handleUpdateApiKey(idx, 'key', e.target.value)
                                                        }
                                                        placeholder="TÊN_BIẾN (vd: GOOGLE_API_KEY)"
                                                        className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-950 text-xs text-white font-mono uppercase outline-none focus:border-amber-500"
                                                    />
                                                </div>

                                                {/* Giá Trị Secret Value */}
                                                <div className="flex-1 relative">
                                                    <input
                                                        type={entry.show ? 'text' : 'password'}
                                                        value={entry.value}
                                                        onChange={(e) =>
                                                            handleUpdateApiKey(idx, 'value', e.target.value)
                                                        }
                                                        placeholder="Nhập giá trị secret / token / key..."
                                                        className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-950 text-xs text-white font-mono pr-12 outline-none focus:border-amber-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleShowKey(idx)}
                                                        className="absolute right-2 top-1.5 text-zinc-500 hover:text-white text-[10px] px-1 py-0.5 rounded bg-zinc-800"
                                                    >
                                                        {entry.show ? (
                                                            <IconEyeOff className="w-3 h-3" />
                                                        ) : (
                                                            <IconEye className="w-3 h-3" />
                                                        )}
                                                    </button>
                                                </div>

                                                {/* Nút xóa */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveApiKey(idx)}
                                                    className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition"
                                                    title="Xóa Key này"
                                                >
                                                    <IconTrash className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 3. THANH CÔNG CỤ EDITOR & NẠP CODE MẪU */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-zinc-800">
                                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                    <IconTerminal className="w-4 h-4 text-emerald-400" />
                                    <span>Trình Soạn Thảo Mã Python (Python Execution Script)</span>
                                </span>

                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-zinc-500">Mẫu có sẵn:</span>
                                    <select
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                handleApplyTemplate(e.target.value)
                                                e.target.value = ''
                                            }
                                        }}
                                        defaultValue=""
                                        className="px-2.5 py-1 rounded-lg border border-zinc-700 bg-zinc-950 text-xs text-zinc-300 outline-none focus:border-blue-500"
                                    >
                                        <option value="" disabled>
                                            + Nạp Code Mẫu...
                                        </option>
                                        {CODE_TEMPLATES.map((tmpl) => (
                                            <option key={tmpl.id} value={tmpl.id}>
                                                {tmpl.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Ô Code Editor */}
                            <div className="relative rounded-2xl border border-zinc-700 bg-zinc-950 overflow-hidden font-mono shadow-inner">
                                <div className="bg-zinc-900/80 px-4 py-1.5 border-b border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
                                    <span>tool_script.py</span>
                                    <span>Python 3.11</span>
                                </div>
                                <textarea
                                    value={codeInput}
                                    onChange={(e) => setCodeInput(e.target.value)}
                                    rows={12}
                                    className="w-full bg-transparent p-4 text-xs text-emerald-300 font-mono outline-none resize-y leading-relaxed"
                                    spellCheck={false}
                                />
                            </div>

                            {/* 4. KHU VỰC TEST RUNNER */}
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

                                {/* Kết quả chạy test */}
                                {testResult && (
                                    <div className="p-3.5 rounded-xl bg-zinc-900 border border-blue-500/30 text-xs text-zinc-300 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                                        {testResult}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Modal: Nút Lưu */}
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