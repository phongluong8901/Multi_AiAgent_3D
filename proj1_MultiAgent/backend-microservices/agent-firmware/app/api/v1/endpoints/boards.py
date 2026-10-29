from fastapi import APIRouter
from app.patterns.codegen_factory import codegen_factory
from app.schemas.connection import ConnectionProfile

router = APIRouter(prefix="/firmware", tags=["Boards & Protocols"])


@router.get("/boards")
def get_supported_boards():
    return codegen_factory.get_catalog()


@router.get("/protocols")
def get_supported_protocols():
    catalog = codegen_factory.get_catalog()
    return {
        "connections": catalog["connections"],
        "transports": catalog["transports"],
        "default_profile": ConnectionProfile().model_dump(),
    }

