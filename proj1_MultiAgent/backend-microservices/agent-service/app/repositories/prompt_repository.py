"""
Repository chuyen biet cho thuc the `PromptModel` (`PromptRepository`).
Ke thua tu `BaseRepository` de quan ly cac thao tac voi bang prompts.
"""

from app.models.prompt import PromptModel
from app.repositories.base_repository import BaseRepository


class PromptRepository(BaseRepository[PromptModel]):
    """
    Repository quan ly bang `prompts` trong PostgreSQL.
    """
    def __init__(self):
        super().__init__(PromptModel)


prompt_repository = PromptRepository()
