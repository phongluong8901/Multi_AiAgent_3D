import { StateGraph, START, END, Annotation } from '@langchain/langgraph'
import { ChatGroq } from '@langchain/groq'
import dotenv from 'dotenv'

dotenv.config()

// 1. Định nghĩa cấu trúc State chạy xuyên suốt trong Graph
const OfficeStateAnnotation = Annotation.Root({
    task: Annotation<string>(),
    benOutput: Annotation<string>(),
    lukeReview: Annotation<string>(),
    currentAgent: Annotation<string>(),
    status: Annotation<string>(),
})

export function createOfficeGraph(onAgentActivity: (agentId: string, status: string, speech: string) => void) {
    // Model miễn phí hoạt động ổn định trên Groq Free Tier: 'llama-3.1-8b-instant'
    const modelName = process.env.GROQ_MODEL || 'llama-3.1-8b-instant'
    const model = new ChatGroq({
        apiKey: process.env.GROQ_API_KEY,
        model: modelName,
        temperature: 0.7,
    })

    const callLLM = async (prompt: string, fallbackText: string) => {
        try {
            const response = await model.invoke(prompt)
            return typeof response.content === 'string' ? response.content : JSON.stringify(response.content)
        } catch (error: any) {
            console.error(`[Groq Error with model ${modelName}]:`, error?.message || error)
            return `${fallbackText} (Không thể gọi LLM: ${error?.message || 'Lỗi'})`
        }
    }

    const benNode = async (state: typeof OfficeStateAnnotation.State) => {
        onAgentActivity('ben', 'working', `Đang viết code cho: ${state.task}`)
        // Delay 1.5s để user quan sát được trên giao diện 3D
        await new Promise((r) => setTimeout(r, 1500))

        const codeResult = await callLLM(
            `Bạn là Ben (Frontend Dev). Hãy viết mã hoặc giải pháp rất ngắn gọn (1-2 câu) cho yêu cầu sau: ${state.task}`,
            `// Mã code hoàn thành cho task: ${state.task}`
        )

        onAgentActivity('ben', 'idle', 'Đã code xong, gửi cho Tech Lead Luke review.')
        await new Promise((r) => setTimeout(r, 1500))

        return { benOutput: codeResult, currentAgent: 'ben' }
    }

    const lukeNode = async (state: typeof OfficeStateAnnotation.State) => {
        onAgentActivity('luke', 'meeting', 'Đang review đoạn code của Ben...')
        await new Promise((r) => setTimeout(r, 1500))

        const reviewResult = await callLLM(
            `Bạn là Luke (Tech Lead). Hãy review ngắn gọn đoạn code này của Ben: "${state.benOutput}". Nhận xét 1 câu và báo đạt yêu cầu.`,
            'Đoạn code của Ben đã được kiểm duyệt, cấu trúc chuẩn và đạt yêu cầu.'
        )

        onAgentActivity('luke', 'idle', 'Đã review xong code: Đạt chuẩn!')
        return { lukeReview: reviewResult, currentAgent: 'luke' }
    }

    // Xây dựng StateGraph
    const workflow = new StateGraph(OfficeStateAnnotation)
        .addNode('ben_node', benNode)
        .addNode('luke_node', lukeNode)
        .addEdge(START, 'ben_node')
        .addEdge('ben_node', 'luke_node')
        .addEdge('luke_node', END)

    return workflow.compile()
}
