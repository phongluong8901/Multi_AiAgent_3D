"""
LangGraph StateGraph construction and compilation for the cognitive self-learning agent.
Defines the state machine, routing conditional edges, and executes the cognitive feedback loop.
"""

from typing import Any, cast
from langgraph.graph import StateGraph, END
from .state import AgentState
from .node import (
    recall_memory_node,
    evaluate_knowledge_node,
    web_search_node,
    synthesize_response_node,
    critique_response_node
)

def should_search(state: AgentState) -> str:
    """
    Conditional routing function to determine whether the graph branches to web_search
    or proceeds directly to synthesize based on knowledge evaluation results.

    Args:
        state: Current AgentState.

    Returns:
        Next node identifier: 'web_search' or 'synthesize'.
    """
    return "web_search" if state.get("needs_web_search") else "synthesize"

def build_agent_graph():
    """
    Assembles the LangGraph workflow with memory recall, evaluation,
    conditional retrieval, synthesis, and self-critique nodes.

    Returns:
        Compiled LangGraph runnable graph.
    """
    workflow = StateGraph(cast(Any, AgentState))

    # Register cognitive execution nodes
    workflow.add_node("recall", recall_memory_node)
    workflow.add_node("evaluate", evaluate_knowledge_node)
    workflow.add_node("web_search", web_search_node)
    workflow.add_node("synthesize", synthesize_response_node)
    workflow.add_node("critique", critique_response_node)

    # Establish execution control flow with conditional routing and self-critique
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
    workflow.add_edge("synthesize", "critique")
    workflow.add_edge("critique", END)

    return workflow.compile()

# Global compiled agent graph instance
agent_graph = build_agent_graph()
