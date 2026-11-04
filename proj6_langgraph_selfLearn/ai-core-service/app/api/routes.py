# File: ai-core-service/app/api/routes.py
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel
from ..agent.graph import agent_graph
from ..agent.synthesis_graph import synthesis_graph
from ..agent.learner import background_continual_learning
from ..memory.long_term import long_memory

router = APIRouter()

class ChatRequest(BaseModel):
    session_id: str
    message: str

class AutonomousLearnRequest(BaseModel):
    topic: str

class SynthesisQueryRequest(BaseModel):
    query: str

class SandboxRunRequest(BaseModel):
    code: str

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

@router.post("/memory-consolidation")
async def trigger_memory_consolidation():
    """Kích hoạt tiến trình dọn dẹp và nén tri thức (Memory Consolidation / Sleep Phase)"""
    result = long_memory.consolidate_memory()
    return result

@router.get("/memory-stats")
async def memory_stats():
    return long_memory.get_stats()

@router.get("/memory-knowledge")
async def memory_knowledge(limit: int = Query(default=100, ge=1, le=500)):
    return {"items": long_memory.list_knowledge(limit=limit)}

@router.get("/memory-items")
async def memory_items(limit: int = Query(default=100, ge=1, le=500)):
    return {"items": long_memory.list_memory_items(limit=limit)}

# --- Knowledge Synthesis Engine Endpoints ---

@router.post("/synthesis/run-multihop")
async def run_multihop_synthesis(req: SynthesisQueryRequest):
    """Thực thi Agentic Multi-Hop Reasoning qua LangGraph Synthesis Graph"""
    try:
        initial_state = {
            "complex_query": req.query,
            "reasoning_steps": []
        }
        result = await synthesis_graph.ainvoke(initial_state)
        
        # Đồng bộ hóa tất cả các trường dữ liệu cho Frontend
        sub_q = result.get("sub_queries", [])
        init_h = result.get("initial_hypothesis", "")
        new_law = result.get("new_law_or_insight", "")
        bridge = result.get("discovered_bridge", "")
        
        return {
            "complex_query": result.get("complex_query", req.query),
            "sub_queries": sub_q,
            "sub_questions": sub_q,
            "initial_hypothesis": init_h,
            "initial_hypotheses": [init_h] if init_h else [],
            "explored_evidence": result.get("explored_evidence", []),
            "discovered_bridge": bridge,
            "bridge_concepts": [bridge] if bridge else [],
            "synthesized_insight": new_law,
            "new_law_or_insight": new_law,
            "dialectical_analysis": result.get("dialectical_analysis", ""),
            "reasoning_steps": result.get("reasoning_steps", []),
            "validity_score": result.get("validity_score", 9),
            "sandbox_verification": {
                "verification_code": result.get("verification_code", ""),
                "simulation_stdout": result.get("simulation_stdout", ""),
                "simulation_stderr": result.get("simulation_stderr", ""),
                "is_experiment_verified": result.get("is_experiment_verified", True),
                "falsified_reason": result.get("falsified_reason", ""),
                "execution_time_ms": result.get("execution_time_ms", 0.0),
            },
            "status": "success"
        }
    except Exception as e:
        error_msg = str(e)
        if "ResourceExhausted" in error_msg or "429" in error_msg:
            raise HTTPException(
                status_code=429,
                detail="Google Gemini API hết hạn mức tạm thời (429). Vui lòng thử lại sau giây lát."
            )
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi Multi-Hop Synthesis: {error_msg}"
        )

@router.post("/synthesis/sleep-phase-discovery")
async def trigger_sleep_phase_discovery():
    """Kích hoạt tiến trình Giấc mơ AI (Sleep Phase Discovery): Gom cụm & Suy luận Thoái quy (Abductive Synthesis)"""
    try:
        result = long_memory.run_sleep_phase_discovery()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi Sleep Phase Discovery: {str(e)}"
        )

@router.get("/synthesis/tiered-stats")
async def get_tiered_stats():
    """Lấy thống kê dữ liệu phân tầng: Tier 1 (Raw), Tier 2 (Bridge), Tier 3 (Synthesized)"""
    return long_memory.get_tiered_stats()

@router.get("/synthesis/insights")
async def list_synthesized_insights(limit: int = Query(default=50, ge=1, le=200)):
    """Danh sách các định luật / tri thức mới được sinh ra từ Tier 3"""
    return {"insights": long_memory.list_synthesized_insights(limit=limit)}

@router.get("/synthesis/bridges")
async def list_concept_bridges(limit: int = Query(default=50, ge=1, le=200)):
    """Danh sách các cầu nối khái niệm thuộc Tier 2 (Graph triplets)"""
    return {"bridges": long_memory.list_concept_bridges(limit=limit)}

@router.get("/synthesis/falsified")
async def list_falsified_hypotheses(limit: int = Query(default=50, ge=1, le=200)):
    """Danh sách Tri thức Phủ định / Giả thuyết bị Bác bỏ qua Sandbox (Negative Knowledge Memory)"""
    return {"falsified": long_memory.list_falsified_hypotheses(limit=limit)}

@router.post("/synthesis/run-sandbox")
async def run_sandbox_code(req: SandboxRunRequest):
    """Thực thi mã kiểm nghiệm độc lập trong Sandbox cô lập"""
    from ..tools.sandbox import execute_code_sandbox
    return execute_code_sandbox(req.code)
