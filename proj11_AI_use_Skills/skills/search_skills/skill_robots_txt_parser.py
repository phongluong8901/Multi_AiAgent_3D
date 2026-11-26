import re
from typing import Optional
from urllib.parse import urlparse, urljoin
import httpx
from bs4 import BeautifulSoup

class RobotsTxtChecker:
    def __init__(self, user_agent: str = 'Generic') -> None:
        self.user_agent = user_agent
        self.rules = {}
        self.crawl_delay = None

    def fetch_robots_txt(self, base_url: str) -> str:
        try:
            response = httpx.get(urljoin(base_url, '/robots.txt'))
            response.raise_for_status()
            return response.text
        except httpx.RequestError:
            return ""

    def parse_robots_txt(self, content: str) -> None:
        self.rules = {}
        self.crawl_delay = None
        lines = content.splitlines()
        current_agent = None

        for line in lines:
            line = line.strip()
            if not line or line.startswith('#'):
                continue

            if line.lower().startswith('user-agent:'):
                current_agent = line.split(':', 1)[1].strip().lower()
                if current_agent not in self.rules:
                    self.rules[current_agent] = []
            elif line.lower().startswith('disallow:'):
                if current_agent is not None:
                    disallow_path = line.split(':', 1)[1].strip()
                    self.rules[current_agent].append((re.compile(disallow_path), False))
            elif line.lower().startswith('allow:'):
                if current_agent is not None:
                    allow_path = line.split(':', 1)[1].strip()
                    self.rules[current_agent].append((re.compile(allow_path), True))
            elif line.lower().startswith('crawl-delay:'):
                if current_agent is not None:
                    try:
                        self.crawl_delay = int(line.split(':', 1)[1].strip())
                    except ValueError:
                        self.crawl_delay = None

    def is_allowed(self, url: str) -> bool:
        parsed_url = urlparse(url)
        path = parsed_url.path

        user_agent_rules = self.rules.get(self.user_agent.lower(), [])
        generic_rules = self.rules.get('*', [])

        # Combine rules and prioritize Allow over Disallow
        combined_rules = user_agent_rules + generic_rules
        combined_rules.sort(key=lambda x: (x[1], len(x[0].pattern)), reverse=True)

        for pattern, allowed in combined_rules:
            if pattern.match(path):
                return allowed

        return True

    def get_crawl_delay(self) -> Optional[int]:
        return self.crawl_delay
