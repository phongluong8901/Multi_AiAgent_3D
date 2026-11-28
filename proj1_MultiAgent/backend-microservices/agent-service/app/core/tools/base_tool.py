from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseTool(ABC):
    name: str = ""
    description: str = ""

    def __init__(self, name: str = "", description: str = ""):
        if name:
            self.name = name
        if description:
            self.description = description
    
    @abstractmethod
    def execute(self, arguments: Dict[str, Any]) -> str:
        pass