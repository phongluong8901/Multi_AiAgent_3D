"""
Long-Term Episodic, Semantic, and Synthesized Vector Memory Management via Qdrant.
Includes belief revision (conflict resolution & deduplication), sleep phase discovery,
multi-tiered memory querying (Tier 1 raw facts, Tier 2 concept bridges, Tier 3 synthesized knowledge,
and Negative Knowledge/Falsified hypotheses).
"""

import json
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from qdrant_client import QdrantClient
from qdrant_client.http.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    PointIdsList,
)
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from ..core.config import settings

def _extract_text_content(res: object) -> str:
    """
    Trích xuất và chuẩn hóa nội dung văn bản (str) từ phản hồi LLM hoặc đối tượng tin nhắn.
    Xử lý an toàn cả kiểu str đơn giản và list các khối nội dung (content blocks / dict).
    """
    raw = getattr(res, "content", res)
    if isinstance(raw, str):
        return raw
    if isinstance(raw, list):
        parts: list[str] = []
        for item in raw:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and "text" in item:
                parts.append(str(item["text"]))
            else:
                parts.append(str(item))
        return "\n".join(parts)
    return str(raw) if raw is not None else ""


class ConflictCheck(BaseModel):
    """
    Schema for structured LLM evaluation of factual contradiction or supersession.
    """
    is_conflict_or_update: bool = Field(
        description="True nếu fact MỚI cập nhật, thay thế hoặc mâu thuẫn trực tiếp với fact CŨ."
    )
    reason: str = Field(default="", description="Lý do mâu thuẫn hoặc thay thế")

class AbductiveHypothesis(BaseModel):
    """
    Schema for abductive reasoning over pairs of facts during offline sleep phase consolidation.
    """
    has_breakthrough: bool = Field(
        description="True nếu phát hiện ra quy luật chung, hệ quả tất yếu hoặc giải pháp mới bắc cầu giữa 2 sự thật độc lập."
    )
    bridge_concept: str = Field(description="Khái niệm hoặc cơ chế trung gian làm cầu nối giữa Fact A và Fact B.")
    new_synthesized_insight: str = Field(description="Định luật hoặc phát hiện mới (X + Z -> W).")
    confidence_score: int = Field(ge=1, le=10, description="Độ tin cậy và giá trị logic từ 1 đến 10.")

class LongTermMemory:
    """
    High-capacity long-term memory engine backed by Qdrant vector database.
    Supports semantic embeddings via Google Gemini text-embedding models,
    belief revision upon detecting conflicting assertions, multi-tier knowledge
    categorization, sleep-phase offline dreaming/synthesis, and empirical failure tracking.
    """
    def __init__(self):
        """
        Initializes Google Gemini embedding generator, chat model for memory operations,
        and connects to Qdrant vector store.
        """
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model=settings.EMBEDDING_MODEL,
            google_api_key=settings.GOOGLE_API_KEY
        )
        
        self.llm = ChatGoogleGenerativeAI(
            model=settings.FAST_MODEL,
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=0.1
        )
        
        # Connect to local or cloud Qdrant instance
        api_key = settings.QDRANT_API_KEY if settings.QDRANT_API_KEY else None
        self.client = QdrantClient(
            url=settings.QDRANT_URL,
            api_key=api_key,
            timeout=30,
        )

        self.knowledge_col = "knowledge_base"
        self.experience_col = "agent_experiences"
        self._init_collections()

    def _embed_text(self, text: str) -> list[float]:
        """
        Computes dense semantic embedding vector for input text with configured dimensions.

        Args:
            text: Raw input text.

        Returns:
            List of floating-point embedding values.
        """
        return self.embeddings.embed_query(
            text,
            output_dimensionality=settings.EMBEDDING_DIM,
        )

    def _init_collections(self):
        """
        Initializes Qdrant vector collections for knowledge base and agent experiences
        if they do not currently exist.
        """
        existing = [col.name for col in self.client.get_collections().collections]
        
        for col_name in [self.knowledge_col, self.experience_col]:
            if col_name not in existing:
                self.client.create_collection(
                    collection_name=col_name,
                    vectors_config=VectorParams(
                        size=settings.EMBEDDING_DIM,
                        distance=Distance.COSINE
                    )
                )

    def recall_knowledge(self, query: str, n_results: int = 4) -> list[str]:
        """
        Retrieves top relevant knowledge facts from Qdrant, filtering out deprecated facts.

        Args:
            query: Semantic search query string.
            n_results: Maximum number of active facts to retrieve.

        Returns:
            List of matching document texts.
        """
        vec = self._embed_text(query)
        
        active_filter = Filter(
            must_not=[
                FieldCondition(
                    key="status",
                    match=MatchValue(value="deprecated")
                )
            ]
        )
        
        hits = self.client.search(
            collection_name=self.knowledge_col,
            query_vector=vec,
            query_filter=active_filter,
            limit=n_results
        )
        return [hit.payload["document"] for hit in hits if hit.payload and hit.payload.get("document")]

    def recall_experiences(self, query: str, n_results: int = 2) -> list[str]:
        """
        Retrieves top relevant procedural lessons and past experiences from Qdrant.

        Args:
            query: Search query string.
            n_results: Number of experiences to recall.

        Returns:
            List of past lesson document strings.
        """
        vec = self._embed_text(query)
        hits = self.client.search(
            collection_name=self.experience_col,
            query_vector=vec,
            limit=n_results
        )
        return [hit.payload["document"] for hit in hits if hit.payload and hit.payload.get("document")]

    def _detect_conflict(self, new_fact: str, old_fact: str) -> bool:
        """
        Uses structured LLM prompting to detect factual conflicts, negation,
        or state updates between a proposed new fact and an existing memory fact.

        Args:
            new_fact: Incoming candidate fact.
            old_fact: Existing stored fact from memory.

        Returns:
            True if new_fact supersedes or contradicts old_fact, False otherwise.
        """
        try:
            checker = self.llm.with_structured_output(ConflictCheck)
            prompt = f"""
            Đánh giá xem phát biểu MỚI có mâu thuẫn, phủ định hoặc CẬP NHẬT thay thế phát biểu CŨ không:
            - CŨ: "{old_fact}"
            - MỚI: "{new_fact}"

            QUY TẮC:
            - Trả về True nếu cả 2 phát biểu cùng nói về một đối tượng/thuộc tính nhưng phát biểu MỚI khiến phát biểu CŨ trở nên lỗi thời hoặc sai lệch (ví dụ: chuyển chỗ ở, thay đổi phiên bản, thay đổi sở thích).
            - Trả về False nếu đây là 2 dữ kiện độc lập hoặc bổ trợ cho nhau.
            """
            result = checker.invoke(prompt)
            if isinstance(result, ConflictCheck):
                return result.is_conflict_or_update
            if isinstance(result, dict):
                return bool(result.get("is_conflict_or_update", False))
            return False
        except Exception:
            return False

    def _save_knowledge_point(self, point_id: str, vec: list[float], fact: str, topic: str, source: str, memory_tier: str = "tier_1_raw", status: str = "active"):
        """
        Internal helper to insert or replace a vector point in the knowledge base collection.

        Args:
            point_id: Unique deterministic point UUID.
            vec: Vector embedding list.
            fact: Text document string.
            topic: Category or domain subject.
            source: Ingestion source origin.
            memory_tier: Memory categorization tier.
            status: Active or deprecated lifecycle state.
        """
        self.client.upsert(
            collection_name=self.knowledge_col,
            points=[
                PointStruct(
                    id=point_id,
                    vector=vec,
                    payload={
                        "document": fact,
                        "topic": topic,
                        "source": source,
                        "memory_tier": memory_tier,
                        "status": status,
                        "updated_at": datetime.utcnow().isoformat()
                    }
                )
            ]
        )

    def _deprecate_point(self, point_id: str, superseded_by: str, reason: str):
        """
        Marks an existing knowledge point as deprecated due to supersession by newer information.

        Args:
            point_id: Target point UUID to mark as deprecated.
            superseded_by: UUID of the replacement point.
            reason: Human/machine readable justification for deprecation.
        """
        try:
            points = self.client.retrieve(collection_name=self.knowledge_col, ids=[point_id], with_payload=True)
            if points and points[0].payload:
                payload = points[0].payload
                payload["status"] = "deprecated"
                payload["superseded_by"] = superseded_by
                payload["deprecated_reason"] = reason
                payload["deprecated_at"] = datetime.utcnow().isoformat()
                self.client.set_payload(collection_name=self.knowledge_col, payload=payload, points=[point_id])
        except Exception as e:
            print(f"[Deprecate Point Warning]: {e}")

    def upsert_knowledge(self, fact: str, topic: str, source: str = "web_search", memory_tier: str = "tier_1_raw") -> str:
        """
        Inserts new knowledge with automated belief revision and semantic deduplication.
        If similarity > 0.85, updates in place; if neighboring memories conflict (0.65-0.85),
        deprecates the obsolete memories.

        Args:
            fact: Knowledge statement to commit.
            topic: Knowledge domain topic.
            source: Source of the fact (web, conversation, synthesis).
            memory_tier: Knowledge hierarchy tier.

        Returns:
            Status indicator string with point ID.
        """
        vec = self._embed_text(fact)
        
        hits = self.client.search(
            collection_name=self.knowledge_col,
            query_vector=vec,
            limit=3
        )
        
        # Deduplication: overwrite existing point if semantic similarity > 0.85
        if hits and hits[0].score > 0.85:
            point_id = str(hits[0].id)
            self._save_knowledge_point(point_id, vec, fact, topic, source, memory_tier=memory_tier, status="active")
            return f"UPDATED_KNOWLEDGE: {point_id}"
            
        point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, fact))
        
        # Belief Revision: detect and deprecate obsolete conflicting facts
        for hit in hits:
            if 0.65 <= hit.score <= 0.85 and hit.payload and hit.payload.get("status") != "deprecated":
                old_doc = hit.payload.get("document", "")
                old_id = str(hit.id)
                if self._detect_conflict(new_fact=fact, old_fact=old_doc):
                    self._deprecate_point(
                        point_id=old_id,
                        superseded_by=point_id,
                        reason=f"Đã bị thay thế bởi dữ liệu mới: '{fact}'"
                    )
                    
        self._save_knowledge_point(point_id, vec, fact, topic, source, memory_tier=memory_tier, status="active")
        return f"INSERTED_KNOWLEDGE: {point_id}"

    def save_synthesized_insight(
        self,
        insight: str,
        topic: str,
        bridge_concept: str,
        analysis: str = "",
        confidence: float = 0.85,
        new_law: str = "",
        contradiction_resolved: str = "",
        causal_chain: Optional[list[str]] = None,
        verification_code: str = "",
        benchmark_output: str = ""
    ) -> str:
        """
        Stores higher-order synthesized knowledge (Tier 3) deduced from multi-hop reasoning
        and verified through empirical sandbox execution.

        Args:
            insight: Primary thesis or synthesized principle.
            topic: Domain topic.
            bridge_concept: Discovered intermediate bridge.
            analysis: Dialectical reasoning breakdown.
            confidence: Estimated confidence metric.
            new_law: Short formulaic law description.
            contradiction_resolved: Description of resolved dialectical tensions.
            causal_chain: Multi-step inference sequence.
            verification_code: Python code executed to verify the insight.
            benchmark_output: Execution stdout/metric logs.

        Returns:
            Deterministic Qdrant point UUID string.
        """
        vec = self._embed_text(insight)
        point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"synth_{insight}"))
        law_title = new_law or topic or insight[:80]
        chain = causal_chain or ([bridge_concept] if bridge_concept else ["Liên kết đa chặng"])
        contradiction = contradiction_resolved or "Tổng hợp biện chứng và liên kết đa chặng"
        
        self.client.upsert(
            collection_name=self.knowledge_col,
            points=[
                PointStruct(
                    id=point_id,
                    vector=vec,
                    payload={
                        "document": insight,
                        "topic": topic,
                        "new_law": law_title,
                        "core_thesis": insight,
                        "confidence_score": confidence,
                        "causal_chain": chain,
                        "contradiction_resolved": contradiction,
                        "memory_tier": "tier_3_synthesized",
                        "bridge_concept": bridge_concept,
                        "dialectical_analysis": analysis,
                        "verification_code": verification_code,
                        "benchmark_output": benchmark_output,
                        "source": "knowledge_synthesis_engine",
                        "status": "verified",
                        "updated_at": datetime.utcnow().isoformat()
                    }
                )
            ]
        )
        return point_id

    def save_falsified_hypothesis(
        self,
        hypothesis: str,
        topic: str,
        falsified_reason: str,
        failed_code: str = "",
        execution_output: str = ""
    ) -> str:
        """
        Stores Negative Knowledge Memory (Falsified Hypothesis).
        Documents empirically refuted hypotheses from failed sandbox simulations,
        preventing future iterations from repeating invalidated reasoning paths.

        Args:
            hypothesis: The refuted hypothesis text.
            topic: Problem domain topic.
            falsified_reason: Failure reason or assertion message.
            failed_code: The simulation script that failed.
            execution_output: Execution trace or error output.

        Returns:
            Deterministic Qdrant point UUID string.
        """
        doc = f"[GIẢ THUYẾT BÁC BỎ]: {hypothesis}. Lý do bác bỏ: {falsified_reason}"
        vec = self._embed_text(doc)
        point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"falsified_{hypothesis}"))
        self.client.upsert(
            collection_name=self.knowledge_col,
            points=[
                PointStruct(
                    id=point_id,
                    vector=vec,
                    payload={
                        "document": doc,
                        "topic": topic,
                        "hypothesis": hypothesis,
                        "falsified_reason": falsified_reason,
                        "failed_code": failed_code,
                        "execution_output": execution_output,
                        "memory_tier": "falsified_hypothesis",
                        "status": "falsified",
                        "source": "sandbox_code_verifier",
                        "updated_at": datetime.utcnow().isoformat()
                    }
                )
            ]
        )
        return point_id

    def save_concept_bridge(
        self,
        entity_a: str,
        relation: str,
        entity_b: str,
        context: str = "",
        confidence: float = 0.90,
        bridge_node: str = ""
    ) -> str:
        """
        Stores conceptual relational bridges (Tier 2) mapping relations between disparate entities.

        Args:
            entity_a: Origin entity or concept.
            relation: Semantic or causal link.
            entity_b: Destination entity or concept.
            context: Supporting context or source statement.
            confidence: Confidence score.
            bridge_node: Identifying intermediary node.

        Returns:
            Deterministic Qdrant point UUID string.
        """
        text = f"{entity_a} -> {relation} -> {entity_b}. {context}"
        vec = self._embed_text(text)
        point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"bridge_{entity_a}_{entity_b}"))
        self.client.upsert(
            collection_name=self.knowledge_col,
            points=[
                PointStruct(
                    id=point_id,
                    vector=vec,
                    payload={
                        "document": f"[Cầu nối]: {entity_a} --({relation})--> {entity_b}",
                        "topic": "Concept Bridge",
                        "memory_tier": "tier_2_bridge",
                        "entity_a": entity_a,
                        "relation": relation,
                        "entity_b": entity_b,
                        "bridge_node": bridge_node or relation,
                        "confidence": confidence,
                        "source": "graph_bridge_discovery",
                        "status": "active",
                        "updated_at": datetime.utcnow().isoformat()
                    }
                )
            ]
        )
        return point_id

    def run_sleep_phase_discovery(self, sample_limit: int = 15) -> dict:
        """
        Executes offline memory consolidation (Sleep Phase / AI Dreaming).
        1. Samples active non-synthesized facts in Qdrant.
        2. Compares fact pairs for potential latent bridges across disparate contexts.
        3. Invokes LLM Abductive Synthesis to deduce new laws (X + Z -> W).
        4. Persists verified discoveries into Tier 3 knowledge and Tier 2 concept bridges.

        Args:
            sample_limit: Maximum number of candidate facts to cross-reference.

        Returns:
            Dictionary summary with status, count of new insights, and insight details.
        """
        points, _ = self.client.scroll(
            collection_name=self.knowledge_col,
            limit=50,
            with_payload=True,
            with_vectors=True
        )
        
        # Collect valid active facts excluding existing synthesized tier 3 items
        raw_facts = [
            p for p in points 
            if p.payload and p.payload.get("status") != "deprecated" and p.payload.get("memory_tier") != "tier_3_synthesized"
        ]
        
        if len(raw_facts) < 2:
            return {
                "status": "insufficient_data",
                "discovered_insights_count": 0,
                "discovered_count": 0,
                "details": [],
                "new_insights": [],
                "message": "Chưa đủ số lượng dữ kiện để tiến hành bốc thăm chéo (cần tối thiểu 2 facts trong bộ nhớ)."
            }
            
        synthesizer = self.llm.with_structured_output(AbductiveHypothesis)
        new_insights = []
        
        # Scan cross-product pairs of facts
        for i in range(min(len(raw_facts), sample_limit)):
            for j in range(i + 1, min(len(raw_facts), sample_limit)):
                fact_a = raw_facts[i].payload.get("document", "")
                fact_b = raw_facts[j].payload.get("document", "")
                
                # Skip facts that are too short to hold meaningful context
                if len(fact_a) < 15 or len(fact_b) < 15:
                    continue
                    
                prompt = f"""
                Bạn là hệ thống 'Giấc mơ AI' (Sleep Phase Discovery).
                Nhiệm vụ: Phân tích 2 sự thật độc lập sau đây xem có điểm giao cắt ẩn, quy luật nhân quả hoặc giải pháp mới nào chưa được viết tường minh:
                - Fact A: "{fact_a}"
                - Fact B: "{fact_b}"
                
                QUY TẮC:
                - Nếu Fact A và B chỉ nói về 2 việc hoàn toàn không liên quan -> has_breakthrough = False.
                - Nếu Fact A và B cùng hội tụ về một cơ chế trung gian để giải quyết bài toán mới (ví dụ A nói X gây Y, B nói Y kết hợp Z ra W -> X + Z ra W) -> has_breakthrough = True.
                
                Trả về JSON:
                {{
                    "has_breakthrough": true,
                    "bridge_concept": "Cơ chế hoặc điểm giao cắt trung gian",
                    "new_synthesized_insight": "Định luật hoặc kiến trúc đột phá mới",
                    "confidence_score": 8
                }}
                """
                try:
                    res = synthesizer.invoke(prompt)
                    breakthrough = False
                    new_law = ""
                    bridge = ""
                    score = 8
                    
                    if isinstance(res, AbductiveHypothesis):
                        breakthrough = res.has_breakthrough
                        new_law = res.new_synthesized_insight
                        bridge = res.bridge_concept
                        score = res.confidence_score
                    elif isinstance(res, dict):
                        breakthrough = bool(res.get("has_breakthrough"))
                        new_law = res.get("new_synthesized_insight", "")
                        bridge = res.get("bridge_concept", "")
                        score = int(res.get("confidence_score", 8))
                    else:
                        plain = self.llm.invoke(prompt)
                        content = _extract_text_content(plain)
                        cleaned = content.replace("```json", "").replace("```", "").strip()
                        data = json.loads(cleaned)
                        breakthrough = bool(data.get("has_breakthrough"))
                        new_law = data.get("new_synthesized_insight", "")
                        bridge = data.get("bridge_concept", "")
                        score = int(data.get("confidence_score", 8))
                        
                    if breakthrough and new_law and score >= 6:
                        conf_val = score / 10.0 if score > 1 else float(score)
                        pid = self.save_synthesized_insight(
                            insight=new_law,
                            topic=f"Cầu nối: {bridge}",
                            bridge_concept=bridge,
                            analysis=f"Suy diễn từ hai mảnh tri thức: '{fact_a[:60]}' & '{fact_b[:60]}'",
                            confidence=conf_val,
                            new_law=new_law[:80],
                            contradiction_resolved="Tổng hợp bắc cầu liên mảnh tri thức",
                            causal_chain=[bridge] if bridge else ["Liên kết ẩn"]
                        )
                        self.save_concept_bridge(
                            entity_a=fact_a[:40],
                            relation=bridge or "liên kết với",
                            entity_b=fact_b[:40],
                            context=new_law,
                            confidence=conf_val,
                            bridge_node=bridge
                        )
                        new_insights.append({
                            "id": pid,
                            "new_law": new_law[:80],
                            "core_thesis": new_law,
                            "bridge_concept": bridge,
                            "confidence_score": conf_val,
                            "insight": new_law,
                            "bridge": bridge,
                            "confidence": score
                        })
                        if len(new_insights) >= 3:
                            break
                except Exception:
                    continue
            if len(new_insights) >= 3:
                break
                
        return {
            "status": "success",
            "discovered_insights_count": len(new_insights),
            "discovered_count": len(new_insights),
            "details": new_insights,
            "new_insights": new_insights,
            "message": f"Đã hoàn thành pha ngủ: phát hiện {len(new_insights)} tri thức mới qua cầu nối ẩn."
        }

    def save_experience(self, lesson: str, task_type: str) -> str:
        """
        Saves a procedural experience lesson with semantic deduplication (threshold > 0.80).

        Args:
            lesson: Text description of the procedural lesson.
            task_type: Categorical identifier of the task domain.

        Returns:
            Point UUID in the experience collection.
        """
        vec = self._embed_text(lesson)
        hits = self.client.search(collection_name=self.experience_col, query_vector=vec, limit=1)
        if hits and hits[0].score > 0.80:
            point_id = str(hits[0].id)
        else:
            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, lesson))
        
        self.client.upsert(
            collection_name=self.experience_col,
            points=[
                PointStruct(
                    id=point_id,
                    vector=vec,
                    payload={
                        "document": lesson,
                        "task_type": task_type,
                        "learned_at": datetime.utcnow().isoformat()
                    }
                )
            ]
        )
        return point_id

    def consolidate_memory(self) -> dict:
        """
        Prunes all deprecated facts from Qdrant storage and refreshes collection statistics.

        Returns:
            Dictionary with count of purged facts, remaining active count, and overall status.
        """
        points, _ = self.client.scroll(collection_name=self.knowledge_col, limit=200, with_payload=True)
        deprecated_ids = [str(p.id) for p in points if p.payload and p.payload.get("status") == "deprecated"]
        if deprecated_ids:
            self.client.delete(collection_name=self.knowledge_col, points_selector=PointIdsList(points=deprecated_ids))
            
        stats = self.get_stats()
        return {
            "purged_deprecated_facts": len(deprecated_ids),
            "remaining_active_knowledge": stats["total_knowledge_facts"],
            "total_experiences": stats["total_experiences"],
            "status": "consolidated_successfully"
        }

    def get_tiered_stats(self) -> dict:
        """
        Computes detailed point counts partitioned by memory tier:
        Tier 1 raw facts, Tier 2 concept bridges, Tier 3 synthesized knowledge,
        and Negative Knowledge (falsified hypotheses).

        Returns:
            Dictionary of tier counts and totals.
        """
        points, _ = self.client.scroll(collection_name=self.knowledge_col, limit=500, with_payload=True)
        active_points = [p for p in points if p.payload and p.payload.get("status") != "deprecated"]
        
        tier_3 = sum(1 for p in active_points if p.payload.get("memory_tier") == "tier_3_synthesized")
        tier_2 = sum(1 for p in active_points if p.payload.get("memory_tier") == "tier_2_bridge")
        tier_falsified = sum(1 for p in active_points if p.payload.get("memory_tier") == "falsified_hypothesis")
        tier_1 = sum(1 for p in active_points if p.payload.get("memory_tier") not in ("tier_2_bridge", "tier_3_synthesized", "falsified_hypothesis"))
        total_active = tier_1 + tier_2 + tier_3 + tier_falsified
        
        return {
            "tier_1_raw": tier_1,
            "tier_2_bridge": tier_2,
            "tier_3_synthesized": tier_3,
            "tier_falsified": tier_falsified,
            "falsified_hypotheses": tier_falsified,
            "total_active": total_active,
            "tier_1_raw_facts": tier_1,
            "tier_2_concept_bridges": tier_2,
            "tier_3_synthesized_knowledge": tier_3,
            "total_experiences": self.client.count(collection_name=self.experience_col).count,
            "status": "active"
        }

    def list_synthesized_insights(self, limit: int = 50) -> list[dict]:
        """
        Retrieves recent Tier 3 synthesized knowledge insights with verification logs.

        Args:
            limit: Maximum items to return.

        Returns:
            List of insight dictionaries sorted by updated_at descending.
        """
        points, _ = self.client.scroll(collection_name=self.knowledge_col, limit=500, with_payload=True)
        insights = []
        for p in points:
            if p.payload and p.payload.get("memory_tier") == "tier_3_synthesized" and p.payload.get("status") != "deprecated":
                doc = p.payload.get("document", "")
                topic = p.payload.get("topic", "")
                conf = p.payload.get("confidence_score")
                if conf is None:
                    conf = 0.85
                elif isinstance(conf, (int, float)) and conf > 1:
                    conf = conf / 10.0
                    
                chain = p.payload.get("causal_chain")
                if not chain:
                    chain = [p.payload.get("bridge_concept", "Liên kết đa chặng")]
                elif isinstance(chain, str):
                    chain = [chain]
                    
                insights.append({
                    "id": str(p.id),
                    "new_law": p.payload.get("new_law") or topic or doc[:80],
                    "core_thesis": p.payload.get("core_thesis") or doc,
                    "bridge_concept": p.payload.get("bridge_concept", ""),
                    "causal_chain": chain,
                    "contradiction_resolved": p.payload.get("contradiction_resolved") or "Tổng hợp biện chứng hai chiều",
                    "verification_code": p.payload.get("verification_code", ""),
                    "benchmark_output": p.payload.get("benchmark_output", ""),
                    "confidence_score": float(conf),
                    "status": p.payload.get("status", "verified"),
                    "created_at": p.payload.get("updated_at", ""),
                })
        insights.sort(key=lambda x: x["created_at"], reverse=True)
        return insights[:limit]

    def list_falsified_hypotheses(self, limit: int = 50) -> list[dict]:
        """
        Retrieves list of empirically refuted hypotheses (Negative Knowledge Memory).

        Args:
            limit: Maximum items to return.

        Returns:
            List of falsified hypothesis items sorted by updated_at descending.
        """
        points, _ = self.client.scroll(collection_name=self.knowledge_col, limit=500, with_payload=True)
        items = []
        for p in points:
            if p.payload and p.payload.get("memory_tier") == "falsified_hypothesis":
                items.append({
                    "id": str(p.id),
                    "hypothesis": p.payload.get("hypothesis", ""),
                    "topic": p.payload.get("topic", ""),
                    "falsified_reason": p.payload.get("falsified_reason", ""),
                    "failed_code": p.payload.get("failed_code", ""),
                    "execution_output": p.payload.get("execution_output", ""),
                    "created_at": p.payload.get("updated_at", "")
                })
        items.sort(key=lambda x: x["created_at"], reverse=True)
        return items[:limit]

    def list_concept_bridges(self, limit: int = 50) -> list[dict]:
        """
        Retrieves list of active Tier 2 relational concept bridges.

        Args:
            limit: Maximum items to return.

        Returns:
            List of concept bridge dictionaries sorted descending by created_at.
        """
        points, _ = self.client.scroll(collection_name=self.knowledge_col, limit=500, with_payload=True)
        bridges = []
        for p in points:
            if p.payload and p.payload.get("memory_tier") == "tier_2_bridge" and p.payload.get("status") != "deprecated":
                conf = p.payload.get("confidence", 0.90)
                if isinstance(conf, (int, float)) and conf > 1:
                    conf = conf / 10.0
                bridges.append({
                    "id": str(p.id),
                    "document": p.payload.get("document", ""),
                    "entity_a": p.payload.get("entity_a", ""),
                    "relation": p.payload.get("relation", ""),
                    "entity_b": p.payload.get("entity_b", ""),
                    "bridge_node": p.payload.get("bridge_node") or p.payload.get("relation", "Trực tiếp"),
                    "confidence": float(conf),
                    "created_at": p.payload.get("updated_at", ""),
                })
        bridges.sort(key=lambda x: x["created_at"], reverse=True)
        return bridges[:limit]

    def list_knowledge(self, limit: int = 100) -> list[dict]:
        """
        Lists active knowledge facts from the knowledge base collection.

        Args:
            limit: Maximum records to return.

        Returns:
            List of raw knowledge records.
        """
        points, _ = self.client.scroll(collection_name=self.knowledge_col, limit=limit, with_payload=True, with_vectors=False)
        return [
            {
                "id": str(point.id),
                "document": point.payload.get("document", ""),
                "topic": point.payload.get("topic", ""),
                "source": point.payload.get("source", ""),
                "memory_tier": point.payload.get("memory_tier", "tier_1_raw"),
                "status": point.payload.get("status", "active"),
                "updated_at": point.payload.get("updated_at", ""),
            }
            for point in points
            if point.payload and point.payload.get("status") != "deprecated"
        ]

    def list_experiences(self, limit: int = 100) -> list[dict]:
        """
        Lists stored experiences and procedural lessons.

        Args:
            limit: Maximum items to return.

        Returns:
            List of experience records.
        """
        points, _ = self.client.scroll(collection_name=self.experience_col, limit=limit, with_payload=True, with_vectors=False)
        return [
            {
                "id": str(point.id),
                "document": point.payload.get("document", ""),
                "task_type": point.payload.get("task_type", ""),
                "learned_at": point.payload.get("learned_at", ""),
            }
            for point in points
            if point.payload
        ]

    def list_memory_items(self, limit: int = 100) -> list[dict]:
        """
        Returns combined chronological feed of knowledge facts and procedural experiences.

        Args:
            limit: Maximum total items.

        Returns:
            Merged list sorted by learned_at descending.
        """
        knowledge = [
            {
                "id": item["id"],
                "kind": "knowledge",
                "category": item["topic"],
                "document": item["document"],
                "memory_tier": item.get("memory_tier", "tier_1_raw"),
                "learned_at": item["updated_at"],
            }
            for item in self.list_knowledge(limit=limit)
        ]
        experiences = [
            {
                "id": item["id"],
                "kind": "experience",
                "category": item["task_type"],
                "document": item["document"],
                "memory_tier": "experience",
                "learned_at": item["learned_at"],
            }
            for item in self.list_experiences(limit=limit)
        ]
        items = knowledge + experiences
        items.sort(key=lambda item: item["learned_at"], reverse=True)
        return items[:limit]

    def get_stats(self) -> dict:
        """
        Retrieves aggregate counts of active knowledge facts and total experiences.

        Returns:
            Dictionary containing 'total_knowledge_facts' and 'total_experiences'.
        """
        points, _ = self.client.scroll(collection_name=self.knowledge_col, limit=500, with_payload=True)
        active_k_count = sum(1 for p in points if p.payload and p.payload.get("status") != "deprecated")
        e_count = self.client.count(collection_name=self.experience_col).count
        return {
            "total_knowledge_facts": active_k_count,
            "total_experiences": e_count
        }

long_memory = LongTermMemory()
