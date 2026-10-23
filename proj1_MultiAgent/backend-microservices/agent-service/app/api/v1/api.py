from fastapi import APIRouter
from app.api.v1.endpoints import agents, prompts, tools, executors, agent_chat, memory, models

api_router = APIRouter()
api_router.include_router(agents.router)
api_router.include_router(agent_chat.router)
api_router.include_router(prompts.router)
api_router.include_router(tools.router)
api_router.include_router(models.router)
api_router.include_router(executors.router)
api_router.include_router(memory.router)