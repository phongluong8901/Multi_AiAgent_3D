from app.models.tool import ToolModel
from app.repositories.base_repository import BaseRepository

class ToolRepository(BaseRepository[ToolModel]):
    def __init__(self):
        super().__init__(ToolModel)

tool_repository = ToolRepository()