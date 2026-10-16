from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas.prompt_schema import PromptCreate, PromptUpdate
from app.services.prompt_service import prompt_service

router = APIRouter(prefix="/prompts", tags=["Prompts Management"])

@router.get("")
def list_prompts(db: Session = Depends(get_db)):
    return prompt_service.get_prompts(db)

@router.post("")
def create_prompt(data: PromptCreate, db: Session = Depends(get_db)):
    return prompt_service.create_prompt(db, data)

@router.put("/{prompt_id}")
def update_prompt(prompt_id: str, data: PromptUpdate, db: Session = Depends(get_db)):
    return prompt_service.update_prompt(db, prompt_id, data)

@router.delete("/{prompt_id}")
def delete_prompt(prompt_id: str, db: Session = Depends(get_db)):
    return prompt_service.delete_prompt(db, prompt_id)