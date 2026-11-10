"""
FastAPI HTTP REST API Route Definitions for AI Core Service.
Exposes conversational chat with background learning, autonomous research triggers,
memory inspection/consolidation endpoints, multi-hop knowledge synthesis,
offline sleep-phase discovery, tiered statistics, and isolated sandbox code execution.
"""

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel, Field
from ..agent.graph import agent_graph
from ..agent.synthesis_graph import synthesis_graph
from ..agent.learner import background_continual_learning
from ..memory.long_term import long_memory

router = APIRouter()

class ChatRequest(BaseModel):
    """
    Payload for interactive conversational queries.
    """
    session_id: str = Field(description="Unique conversation session identifier")
    message: str = Field(description="User message or query")

class AutonomousLearnRequest(BaseModel):
    """
    Payload for autonomous topical exploration triggered by background schedulers.
    """
    topic: str = Field(description="Domain topic to autonomously investigate")

class SynthesisQueryRequest(BaseModel):
    """
    Payload for complex multi-hop research queries requiring deep synthesis.
    """
    query: str = Field(description="Complex research query to decompose and synthesize")

class SandboxRunRequest(BaseModel):
    """
    Payload for executing standalone benchmark scripts in the sandbox.
    """
    code: str = Field(description="Python source code to execute inside the sandbox")

@router.post("/chat")
async def chat_endpoint(req: ChatRequest, background_tasks: BackgroundTasks):
    """
    Processes chat queries through the LangGraph cognitive loop (recall -> evaluate -> search -> synthesize -> critique).
    Schedules asynchronous continual learning in the background to digest conversation insights.
    """
    initial_state = {
        "session_id": req.session_id,
        "query": req.message,
        "reasoning_trace": []
    }
    
    try:
        # Execute the compiled LangGraph cognitive workflow
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
    
    # Enqueue background continual learning without blocking client response
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
    """
    Endpoint triggered by scheduled background jobs to perform self-directed research on novel topics.
    """
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
    """
    Triggers maintenance cycle to purge deprecated/superseded memories and optimize indices.
    """
    result = long_memory.consolidate_memory()
    return result

@router.get("/memory-stats")
async def memory_stats():
    """
    Returns aggregate counts of stored knowledge facts and procedural experiences.
    """
    return long_memory.get_stats()

@router.get("/memory-knowledge")
async def memory_knowledge(limit: int = Query(default=100, ge=1, le=500)):
    """
    Retrieves active declarative knowledge facts from Qdrant vector database.
    """
    return {"items": long_memory.list_knowledge(limit=limit)}

@router.get("/memory-items")
async def memory_items(limit: int = Query(default=100, ge=1, le=500)):
    """
    Returns unified chronological memory stream merging knowledge facts and experiences.
    """
    return {"items": long_memory.list_memory_items(limit=limit)}

# --- Knowledge Synthesis Engine Endpoints ---

@router.post("/synthesis/run-multihop")
async def run_multihop_synthesis(req: SynthesisQueryRequest):
    """
    Executes 5-stage Multi-Hop Knowledge Synthesis pipeline via LangGraph:
    decomposes queries, gathers evidence across hops, discovers conceptual bridges,
    derives new laws, and executes empirical sandbox verification before write-back.
    """
    try:
        initial_state = {
            "complex_query": req.query,
            "reasoning_steps": []
        }
        result = await synthesis_graph.ainvoke(initial_state)
        
        # Synchronize response fields for frontend consumption
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
    """
    Triggers offline sleep-phase discovery and abductive knowledge synthesis
    to infer emergent patterns across disparate stored facts.
    """
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
    """
    Retrieves statistics broken down by tiered memory hierarchy:
    Tier 1 (Raw), Tier 2 (Bridge), Tier 3 (Synthesized), and Negative Memory.
    """
    return long_memory.get_tiered_stats()

@router.get("/synthesis/insights")
async def list_synthesized_insights(limit: int = Query(default=50, ge=1, le=200)):
    """
    Returns list of verified Tier 3 synthesized knowledge insights with simulation logs.
    """
    return {"insights": long_memory.list_synthesized_insights(limit=limit)}

@router.get("/synthesis/bridges")
async def list_concept_bridges(limit: int = Query(default=50, ge=1, le=200)):
    """
    Returns list of relational concept bridges in Tier 2.
    """
    return {"bridges": long_memory.list_concept_bridges(limit=limit)}

@router.get("/synthesis/falsified")
async def list_falsified_hypotheses(limit: int = Query(default=50, ge=1, le=200)):
    """
    Returns list of refuted negative knowledge hypotheses that failed empirical verification.
    """
    return {"falsified": long_memory.list_falsified_hypotheses(limit=limit)}

@router.post("/synthesis/run-sandbox")
async def run_sandbox_code(req: SandboxRunRequest):
    """
    Executes test code directly inside the isolated execution sandbox.
    """
    from ..tools.sandbox import execute_code_sandbox
    return execute_code_sandbox(req.code)

