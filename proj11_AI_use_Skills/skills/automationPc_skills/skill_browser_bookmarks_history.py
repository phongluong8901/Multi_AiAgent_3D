import os
import tempfile
import shutil
import logging
from typing import List, Dict, Any

TOOL_SCHEMA = {
    "name": "skill_browser_bookmarks_history",
    "risk_level": "safe",
    "description": "Safely search Chrome/Edge Bookmarks JSON and History SQLite (copied to temp file to avoid DB lock) by keyword or domain. Tìm kiếm lịch sử duyệt web Chrome Edge, đọc dấu trang bookmarks đã lưu",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["search_bookmarks", "search_history"]
            },
            "query": {
                "type": "string",
                "description": "Keyword or domain to search"
            },
            "browser": {
                "type": "string",
                "enum": ["chrome", "edge"],
                "default": "chrome"
            },
            "limit": {
                "type": "integer",
                "default": 20
            }
        },
        "required": ["action"]
    }
}

def get_chrome_bookmarks_path() -> str:
    import os
    return os.path.join(os.getenv("LOCALAPPDATA"), "Google", "Chrome", "User Data", "Default", "Bookmarks")

def get_edge_bookmarks_path() -> str:
    import os
    return os.path.join(os.getenv("LOCALAPPDATA"), "Microsoft", "Edge", "User Data", "Default", "Bookmarks")

def get_chrome_history_path() -> str:
    import os
    return os.path.join(os.getenv("LOCALAPPDATA"), "Google", "Chrome", "User Data", "Default", "History")

def get_edge_history_path() -> str:
    import os
    return os.path.join(os.getenv("LOCALAPPDATA"), "Microsoft", "Edge", "User Data", "Default", "History")

def search_bookmarks(query: str = '', browser: str = 'chrome', limit: int = 20) -> Dict[str, Any]:
    try:
        import json
        if browser == 'chrome':
            bookmarks_path = get_chrome_bookmarks_path()
        elif browser == 'edge':
            bookmarks_path = get_edge_bookmarks_path()
        else:
            return {"ok": False, "error": "Unsupported browser"}

        with open(bookmarks_path, 'r', encoding='utf-8') as f:
            bookmarks = json.load(f)

        results = []
        def search_bookmark_node(node):
            if 'children' in node:
                for child in node['children']:
                    search_bookmark_node(child)
            elif 'url' in node and (query.lower() in node['name'].lower() or query.lower() in node['url'].lower()):
                results.append({'name': node['name'], 'url': node['url']})

        search_bookmark_node(bookmarks['roots']['bookmark_bar'])
        search_bookmark_node(bookmarks['roots']['other'])

        return {"ok": True, "results": results[:limit]}
    except FileNotFoundError:
        return {"ok": False, "error": "FileNotFoundError"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def search_history(query: str = '', browser: str = 'chrome', limit: int = 20) -> Dict[str, Any]:
    try:
        import sqlite3
        if browser == 'chrome':
            history_path = get_chrome_history_path()
        elif browser == 'edge':
            history_path = get_edge_history_path()
        else:
            return {"ok": False, "error": "Unsupported browser"}

        temp_db = tempfile.NamedTemporaryFile(delete=False)
        shutil.copy2(history_path, temp_db.name)

        conn = sqlite3.connect(temp_db.name)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT url, title, last_visit_time
            FROM urls
            WHERE url LIKE ? OR title LIKE ?
            ORDER BY last_visit_time DESC
            LIMIT ?
        """, (f'%{query}%', f'%{query}%', limit))
        results = [{'url': row[0], 'title': row[1], 'last_visit_time': row[2]} for row in cursor.fetchall()]

        conn.close()
        os.remove(temp_db.name)

        return {"ok": True, "results": results}
    except sqlite3.OperationalError:
        return {"ok": False, "error": "sqlite3.OperationalError"}
    except FileNotFoundError:
        return {"ok": False, "error": "FileNotFoundError"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def execute(action: str = "", **kwargs) -> dict:
    if action == "search_bookmarks":
        return search_bookmarks(**kwargs)
    elif action == "search_history":
        return search_history(**kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
