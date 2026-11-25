import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.router import router as rl_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("rltrain-service")

app = FastAPI(
    title="Multi-Agent RL Training Service",
    description="Microservice huấn luyện Reinforcement Learning (Q-Learning / 3D Navigation) cho Agent di chuyển Three.js",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rl_router)

@app.get("/")
def root():
    return {
        "message": "Multi-Agent RL Training Service (Port 5009) is running!",
        "endpoints": {
            "health": "/api/v1/rl/health",
            "docs": "/docs",
            "start": "/api/v1/rl/train/start",
            "status": "/api/v1/rl/train/status"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
