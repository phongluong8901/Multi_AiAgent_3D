from fastapi import APIRouter
from app.api.v1.endpoints import agents, prompts, tools

api_router = APIRouter()
api_router.include_router(agents.router)
api_router.include_router(prompts.router)
api_router.include_router(tools.router)