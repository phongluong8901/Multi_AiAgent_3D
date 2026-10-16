from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1.api import api_router

import time
from contextlib import asynccontextmanager

def init_db(max_retries: int = 10, delay: int = 2):
    for attempt in range(1, max_retries + 1):
        try:
            Base.metadata.create_all(bind=engine)
            print("[agent-service] Database tables initialized successfully.")
            return
        except Exception as e:
            if attempt == max_retries:
                print(f"[agent-service] Could not connect to database after {max_retries} attempts: {e}")
                raise e
            print(f"[agent-service] Waiting for database... ({attempt}/{max_retries})")
            time.sleep(delay)

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
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