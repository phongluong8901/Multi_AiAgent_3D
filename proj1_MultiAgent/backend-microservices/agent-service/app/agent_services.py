from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import SessionLocal, engine, Base
from app.core.seeders import run_all_seeders
# Import all models so SQLAlchemy registers them with Base.metadata
from app.models import agent, prompt, tool, memory  # noqa: F401
from app.api.v1.api import api_router

import time
from contextlib import asynccontextmanager

def init_db(max_retries: int = 10, delay: int = 2):
    for attempt in range(1, max_retries + 1):
        try:
            Base.metadata.create_all(bind=engine)
            
            # --- Chạy toàn bộ seeders (Prompts, Tools, Agents) ---
            db = SessionLocal()
            try:
                run_all_seeders(db)
            finally:
                db.close()
            # ---------------------------------------------------

            print("[agent-service] Database tables and seeders initialized successfully.")
            return
        except Exception as e:
            if attempt == max_retries:
                print(f"[agent-service] Could not connect to database after {max_retries} attempts: {e}")
                raise e
            print(f"[agent-service] Waiting for database... ({attempt}/{max_retries})")
            time.sleep(delay)

def start_rabbitmq_consumer():
    from app.core.rabbitmq_client import consume_events
    from app.services.agent_runner import agent_runner

    def handle_agent_prompt(data: dict):
        try:
            agent_id = data.get("agentId") or data.get("agent_id")
            room_id = data.get("roomId") or data.get("room_id")
            user_message = data.get("userPrompt") or data.get("message") or ""
            if not agent_id or not user_message:
                print(f"[agent-service MQ] Missing agentId or userPrompt: {data}")
                return

            print(f"[agent-service MQ] Processing prompt for agent '{agent_id}' in room '{room_id}'")
            db = SessionLocal()
            try:
                agent_runner.run_agent(db=db, agent_id=agent_id, user_message=user_message, room_id=room_id)
            finally:
                db.close()
        except Exception as e:
            print(f"[agent-service MQ] Error processing prompt: {e}")

    try:
        consume_events(
            exchange="agent.events",
            routing_key="agent.prompt.#",
            queue_name="agent_prompt_queue",
            callback=handle_agent_prompt,
        )
        print("[agent-service] RabbitMQ consumer thread started for queue 'agent_prompt_queue'")
    except Exception as err:
        print(f"[agent-service] Warning: Could not start RabbitMQ consumer: {err}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    start_rabbitmq_consumer()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gắn toàn bộ v1 router vào app với prefix /api/v1
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "Virtual Office FastAPI Microservice is running successfully!"}