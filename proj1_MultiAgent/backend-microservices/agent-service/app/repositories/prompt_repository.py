from app.models.prompt import PromptModel
from app.repositories.base_repository import BaseRepository

class PromptRepository(BaseRepository[PromptModel]):
    def __init__(self):
        super().__init__(PromptModel)

prompt_repository = PromptRepository()