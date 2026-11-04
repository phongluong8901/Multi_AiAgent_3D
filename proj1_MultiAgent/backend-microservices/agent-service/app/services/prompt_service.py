from sqlalchemy.orm import Session
from app.repositories.prompt_repository import prompt_repository
from app.schemas.prompt_schema import PromptCreate, PromptUpdate
from fastapi import HTTPException

class PromptService:
    def get_prompts(self, db: Session):
        return prompt_repository.get_all(db)

    def get_prompt(self, db: Session, prompt_id: str):
        prompt = prompt_repository.get(db, prompt_id)
        if not prompt:
            raise HTTPException(status_code=404, detail="Prompt not found")
        return prompt

    def create_prompt(self, db: Session, data: PromptCreate):
        existing = prompt_repository.get(db, data.id)
        if existing:
            raise HTTPException(status_code=400, detail="Prompt ID already exists")
        return prompt_repository.create(db, data.model_dump())

    def update_prompt(self, db: Session, prompt_id: str, data: PromptUpdate):
        prompt = prompt_repository.get(db, prompt_id)
        if not prompt:
            raise HTTPException(status_code=404, detail="Prompt not found")
        return prompt_repository.update(db, prompt, data.model_dump(exclude_unset=True))

    def delete_prompt(self, db: Session, prompt_id: str):
        success = prompt_repository.delete(db, prompt_id)
        if not success:
            raise HTTPException(status_code=404, detail="Prompt not found")
        return {"success": True, "message": f"Prompt {prompt_id} deleted"}

prompt_service = PromptService()