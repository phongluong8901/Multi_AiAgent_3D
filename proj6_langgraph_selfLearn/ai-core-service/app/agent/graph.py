from typing import Any, cast
from langgraph.graph import StateGraph, END
from .state import AgentState
from .node import (
    recall_memory_node,
    evaluate_knowledge_node,
    web_search_node,
    synthesize_response_node
)

def should_search(state: AgentState) -> str:
    return "web_search" if state.get("needs_web_search") else "synthesize"

def build_agent_graph():
    workflow = StateGraph(cast(Any, AgentState))

    workflow.add_node("recall", recall_memory_node)
    workflow.add_node("evaluate", evaluate_knowledge_node)
    workflow.add_node("web_search", web_search_node)
    workflow.add_node("synthesize", synthesize_response_node)

    workflow.set_entry_point("recall")
    workflow.add_edge("recall", "evaluate")
    workflow.add_conditional_edges(
        "evaluate",
        should_search,
        {
            "web_search": "web_search",
            "synthesize": "synthesize"
        }
    )
    workflow.add_edge("web_search", "synthesize")
    workflow.add_edge("synthesize", END)

    return workflow.compile()

agent_graph = build_agent_graph()
