import sqlite3
import hashlib
import time
from typing import Optional, Dict, Union

class LocalCrawlCache:
    def __init__(self, db_path: str = ':memory:', default_ttl: int = 3600):
        """
        Initialize the LocalCrawlCache with a SQLite database.

        :param db_path: Path to the SQLite database file. Use ':memory:' for an in-memory database.
        :param default_ttl: Default time-to-live in seconds for cached entries.
        """
        self.db_path = db_path
        self.default_ttl = default_ttl
        self.conn = sqlite3.connect(self.db_path)
        self._create_table()

    def _create_table(self):
        """Create the cache table if it doesn't exist."""
        with self.conn:
            self.conn.execute('''
                CREATE TABLE IF NOT EXISTS cache (
                    url TEXT PRIMARY KEY,
                    content TEXT NOT NULL,
                    status_code INTEGER NOT NULL,
                    etag TEXT,
                    last_modified TEXT,
                    content_hash TEXT,
                    expires_at REAL
                )
            ''')

    def get(self, url: str) -> Optional[Dict[str, Union[str, int]]]:
        """
        Retrieve the cached content for a given URL.

        :param url: The URL to retrieve.
        :return: A dictionary containing the content, status_code, etag, and last_modified if the entry is valid, otherwise None.
        """
        with self.conn:
            cursor = self.conn.execute('SELECT * FROM cache WHERE url = ?', (url,))
            row = cursor.fetchone()
            if row:
                expires_at = row[6]
                if expires_at > time.time():
                    return {
                        'content': row[1],
                        'status_code': row[2],
                        'etag': row[3],
                        'last_modified': row[4]
                    }
        return None

    def set(self, url: str, content: str, status_code: int = 200, etag: str = '', ttl: Optional[int] = None):
        """
        Set the cache for a given URL.

        :param url: The URL to cache.
        :param content: The content to cache.
        :param status_code: The HTTP status code.
        :param etag: The ETag header value.
        :param ttl: Time-to-live in seconds for this entry. If None, use the default TTL.
        """
        content_hash = hashlib.sha256(content.encode()).hexdigest()
        expires_at = time.time() + (ttl if ttl is not None else self.default_ttl)
        with self.conn:
            self.conn.execute('''
                INSERT OR REPLACE INTO cache (url, content, status_code, etag, last_modified, content_hash, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (url, content, status_code, etag, '', content_hash, expires_at))

    def purge_expired(self) -> int:
        """
        Purge expired entries from the cache.

        :return: The number of entries purged.
        """
        with self.conn:
            cursor = self.conn.execute('DELETE FROM cache WHERE expires_at < ?', (time.time(),))
            return cursor.rowcount

    def stats(self) -> Dict[str, int]:
        """
        Get cache statistics.

        :return: A dictionary containing the number of entries and the number of expired entries.
        """
        with self.conn:
            cursor = self.conn.execute('SELECT COUNT(*) FROM cache')
            total_entries = cursor.fetchone()[0]
            cursor = self.conn.execute('SELECT COUNT(*) FROM cache WHERE expires_at < ?', (time.time(),))
            expired_entries = cursor.fetchone()[0]
        return {
            'total_entries': total_entries,
            'expired_entries': expired_entries
        }
