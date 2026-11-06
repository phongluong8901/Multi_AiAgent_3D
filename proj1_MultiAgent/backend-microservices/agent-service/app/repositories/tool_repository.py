"""
Repository chuyen biet cho thuc the `ToolModel` (`ToolRepository`).
Ke thua tu `BaseRepository` de quan ly cac thao tac them, xoa, sua va tim kiem cong cu.
"""

from app.models.tool import ToolModel
from app.repositories.base_repository import BaseRepository


class ToolRepository(BaseRepository[ToolModel]):
    """
    Repository quan ly bang `tools` trong PostgreSQL.
    """
    def __init__(self):
        super().__init__(ToolModel)


tool_repository = ToolRepository()
