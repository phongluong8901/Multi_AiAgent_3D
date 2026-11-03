# File: ai-core-service/app/api/routes.py
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel
from ..agent.graph import agent_graph
from ..agent.learner import background_continual_learning
from ..memory.long_term import long_memory

router = APIRouter()

class ChatRequest(BaseModel):
    session_id: str
    message: str

class AutonomousLearnRequest(BaseModel):
    topic: str

@router.post("/chat")
async def chat_endpoint(req: ChatRequest, background_tasks: BackgroundTasks):
    initial_state = {
        "session_id": req.session_id,
        "query": req.message,
        "reasoning_trace": []
    }
    
    try:
        # Chạy luồng LangGraph
        result = await agent_graph.ainvoke(initial_state)
    except Exception as e:
        error_msg = str(e)
        if "ResourceExhausted" in error_msg or "429" in error_msg:
            raise HTTPException(
                status_code=429,
                detail="Google Gemini đã hết hạn mức (Quota Exceeded 429). Hệ thống đã tự động chuyển sang mô hình gemini-1.5-flash với hạn mức cao hơn. Vui lòng thử lại!"
            )
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi xử lý tại AI Core: {error_msg}"
        )
    
    # Kích hoạt tiến trình Tự Học chạy ngầm (Không làm chậm phản hồi của User)
    background_tasks.add_task(
        background_continual_learning,
        req.session_id,
        req.message,
        result.get("web_results", ""),
        result["final_answer"]
    )
    
    return {
        "answer": result["final_answer"],
        "used_web_search": result.get("needs_web_search", False),
        "recalled_facts_count": len(result.get("recalled_knowledge", [])),
        "reasoning_trace": result.get("reasoning_trace", []),
        "memory_stats": long_memory.get_stats()
    }

@router.post("/autonomous-learn")
async def trigger_autonomous_learning(req: AutonomousLearnRequest, background_tasks: BackgroundTasks):
    """Endpoint để Node.js Cronjob gọi định kỳ giúp AI tự nghiên cứu chủ đề mới"""
    query = f"Tìm hiểu các thông tin, cập nhật hoặc xu hướng mới nhất về: {req.topic}"
    try:
        result = await agent_graph.ainvoke({"session_id": "system_cron", "query": query, "reasoning_trace": []})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi tự học chủ đề {req.topic}: {str(e)}")
    
    background_tasks.add_task(
        background_continual_learning,
        "system_cron",
        query,
        result.get("web_results", ""),
        result["final_answer"]
    )
    return {"status": "learned", "topic": req.topic, "summary": result["final_answer"]}

@router.get("/memory-stats")
async def memory_stats():
    return long_memory.get_stats()

@router.get("/memory-knowledge")
async def memory_knowledge(limit: int = Query(default=100, ge=1, le=500)):
    return {"items": long_memory.list_knowledge(limit=limit)}

@router.get("/memory-items")
async def memory_items(limit: int = Query(default=100, ge=1, le=500)):
    return {"items": long_memory.list_memory_items(limit=limit)}
