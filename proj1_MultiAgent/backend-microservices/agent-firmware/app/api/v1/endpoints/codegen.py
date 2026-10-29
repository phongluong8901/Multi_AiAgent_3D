from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas.codegen import GenerateFirmwareRequest
from app.services.device_service import device_service

router = APIRouter(prefix="/firmware", tags=["Firmware Code Generator"])


@router.post("/generate")
def generate_firmware(
    req: GenerateFirmwareRequest,
    db: Session = Depends(get_db),
):
    return device_service.generate_and_log_firmware(db, req)

