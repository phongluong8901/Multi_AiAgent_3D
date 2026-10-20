from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseTool(ABC):
    name: str
    description: str
    
    @abstractmethod
    def execute(self, arguments: Dict[str, Any]) -> str:
        pass