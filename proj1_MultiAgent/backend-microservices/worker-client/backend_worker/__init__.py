"""
Backend Worker Package for Multi-Agent Distributed Hardware Node.
Provides modular hardware scanning, LLM status monitoring, and network telemetry relay.
"""

from .main import run

__version__ = "1.1.0"
__all__ = ["run"]
