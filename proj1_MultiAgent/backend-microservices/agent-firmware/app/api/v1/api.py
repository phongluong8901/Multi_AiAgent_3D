from fastapi import APIRouter
from app.api.v1.endpoints import boards, codegen, devices, histories, stream_bridge

api_router = APIRouter()
api_router.include_router(boards.router)
api_router.include_router(devices.router)
api_router.include_router(codegen.router)
api_router.include_router(stream_bridge.router)
api_router.include_router(histories.router)

