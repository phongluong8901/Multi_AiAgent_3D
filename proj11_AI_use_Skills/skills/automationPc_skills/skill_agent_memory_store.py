import sqlite3
from typing import List, Dict, Any

TOOL_SCHEMA = {
    "name": "skill_agent_memory_store",
    "description": "Persistent local SQLite key-value & tagged memory store for user preferences, frequent directories, contact aliases (Zalo/Telegram/Email), and machine notes.",
    "risk_level": "safe",
    "parameters": {
        "action": {
            "type": "string",
            "enum": ["remember", "recall", "search_memory", "forget"]
        },
        "key": {
            "type": "string",
            "description": "The key to store or retrieve data."
        },
        "value": {
            "type": "string",
            "description": "The value to store."
        },
        "category": {
            "type": "string",
            "description": "The category of the memory.",
            "default": "general"
        },
        "tags": {
            "type": "string",
            "description": "Tags associated with the memory."
        },
        "query": {
            "type": "string",
            "description": "The search query."
        },
        "limit": {
            "type": "integer",
            "description": "The limit of search results.",
            "default": 20
        },
        "db_path": {
            "type": "string",
            "description": "Path to the SQLite database.",
            "default": "agent_memory.sqlite"
        }
    }
}

def _initialize_db(db_path: str) -> None:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS memory (
            key TEXT PRIMARY KEY,
            value TEXT,
            category TEXT,
            tags TEXT
        )
    ''')
    conn.commit()
    conn.close()

def remember(key: str, value: str, category: str = 'general', tags: str = '', db_path: str = 'agent_memory.sqlite') -> Dict[str, Any]:
    try:
        _initialize_db(db_path)
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute('INSERT OR REPLACE INTO memory (key, value, category, tags) VALUES (?, ?, ?, ?)', (key, value, category, tags))
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def recall(key: str, db_path: str = 'agent_memory.sqlite') -> Dict[str, Any]:
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute('SELECT value FROM memory WHERE key = ?', (key,))
        result = cursor.fetchone()
        conn.close()
        if result:
            return {"ok": True, "value": result[0]}
        else:
            return {"ok": False, "error": "Key not found"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def search_memory(query: str = '', category: str = '', limit: int = 20, db_path: str = 'agent_memory.sqlite') -> Dict[str, Any]:
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        sql = 'SELECT key, value, category, tags FROM memory WHERE 1=1'
        params = []
        if query:
            sql += ' AND (key LIKE ? OR value LIKE ? OR tags LIKE ?)'
            params.extend([f'%{query}%', f'%{query}%', f'%{query}%'])
        if category:
            sql += ' AND category = ?'
            params.append(category)
        sql += ' LIMIT ?'
        params.append(limit)
        cursor.execute(sql, params)
        results = cursor.fetchall()
        conn.close()
        return {"ok": True, "results": results}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def forget(key: str, db_path: str = 'agent_memory.sqlite') -> Dict[str, Any]:
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM memory WHERE key = ?', (key,))
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def execute(action: str = "", **kwargs) -> Dict[str, Any]:
    if action == "remember":
        return remember(**kwargs)
    elif action == "recall":
        return recall(**kwargs)
    elif action == "search_memory":
        return search_memory(**kwargs)
    elif action == "forget":
        return forget(**kwargs)
    else:
        return {"ok": False, "error": "Unknown action"}
