import uuid
from datetime import datetime
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from ..core.config import settings

class LongTermMemory:
    def __init__(self):
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model=settings.EMBEDDING_MODEL,
            google_api_key=settings.GOOGLE_API_KEY
        )
        
        # Tự động nhận diện Local hay Qdrant Cloud qua QDRANT_API_KEY
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
        return self.embeddings.embed_query(
            text,
            output_dimensionality=settings.EMBEDDING_DIM,
        )

    def _init_collections(self):
        """Khởi tạo 2 bảng Vector nếu chưa tồn tại"""
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
        vec = self._embed_text(query)
        hits = self.client.search(
            collection_name=self.knowledge_col,
            query_vector=vec,
            limit=n_results
        )
        return [hit.payload["document"] for hit in hits if hit.payload]

    def recall_experiences(self, query: str, n_results: int = 2) -> list[str]:
        vec = self._embed_text(query)
        hits = self.client.search(
            collection_name=self.experience_col,
            query_vector=vec,
            limit=n_results
        )
        return [hit.payload["document"] for hit in hits if hit.payload]

    def upsert_knowledge(self, fact: str, topic: str, source: str = "web_search") -> str:
        """Tự động cập nhật hoặc thêm mới tri thức trên Qdrant (Deduplication)"""
        vec = self._embed_text(fact)
        
        # Tìm vector giống nhất hiện có
        hits = self.client.search(
            collection_name=self.knowledge_col,
            query_vector=vec,
            limit=1
        )
        
        # Với Cosine Similarity: > 0.85 nghĩa là nội dung cực kỳ giống nhau -> Ghi đè ID cũ
        if hits and hits[0].score > 0.85:
            point_id = str(hits[0].id)
            action = "UPDATED_KNOWLEDGE"
        else:
            # Tạo UUID cố định dựa trên nội dung chuỗi
            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, fact))
            action = "INSERTED_KNOWLEDGE"

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
                        "updated_at": datetime.utcnow().isoformat()
                    }
                )
            ]
        )
        return f"{action}: {point_id}"

    def save_experience(self, lesson: str, task_type: str) -> str:
        vec = self._embed_text(lesson)
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

    def list_knowledge(self, limit: int = 100) -> list[dict]:
        points, _ = self.client.scroll(
            collection_name=self.knowledge_col,
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )
        return [
            {
                "id": str(point.id),
                "document": point.payload.get("document", ""),
                "topic": point.payload.get("topic", ""),
                "source": point.payload.get("source", ""),
                "updated_at": point.payload.get("updated_at", ""),
            }
            for point in points
            if point.payload
        ]

    def list_experiences(self, limit: int = 100) -> list[dict]:
        points, _ = self.client.scroll(
            collection_name=self.experience_col,
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )
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
        knowledge = [
            {
                "id": item["id"],
                "kind": "knowledge",
                "category": item["topic"],
                "document": item["document"],
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
                "learned_at": item["learned_at"],
            }
            for item in self.list_experiences(limit=limit)
        ]
        items = knowledge + experiences
        items.sort(key=lambda item: item["learned_at"], reverse=True)
        return items[:limit]

    def get_stats(self) -> dict:
        k_count = self.client.count(collection_name=self.knowledge_col).count
        e_count = self.client.count(collection_name=self.experience_col).count
        return {
            "total_knowledge_facts": k_count,
            "total_experiences": e_count
        }

long_memory = LongTermMemory()