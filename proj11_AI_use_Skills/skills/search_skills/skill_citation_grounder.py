from typing import List, Dict, Tuple
import hashlib
import re

class CitationGrounder:
    def __init__(self):
        self.citations = {}
        self.next_citation_id = 1

    def _generate_citation_id(self, url: str) -> int:
        """Generate a unique citation ID based on the URL."""
        url_hash = hashlib.md5(url.encode()).hexdigest()
        if url_hash not in self.citations:
            self.citations[url_hash] = self.next_citation_id
            self.next_citation_id += 1
        return self.citations[url_hash]

    def build_context(self, chunks: List[Dict]) -> Tuple[str, List[Dict]]:
        """
        Map retrieved evidence chunks to numbered inline citations [1], [2], etc.

        :param chunks: List of evidence chunks with 'text' and 'source' keys.
        :return: A tuple containing the context with inline citations and a list of sources.
        """
        context = []
        sources = []

        for chunk in chunks:
            if not chunk.get('text') or not chunk.get('source'):
                continue

            source = chunk['source']
            citation_id = self._generate_citation_id(source.get('url', ''))
            context.append(f"{chunk['text']} [{citation_id}]")

            if source not in sources:
                sources.append(source)

        return ' '.join(context), sources

    def format_references(self, sources: List[Dict]) -> str:
        """
        Format the reference list from a list of sources.

        :param sources: List of sources with 'title' and 'url' keys.
        :return: A formatted string of references.
        """
        formatted_sources = []
        for source in sources:
            title = source.get('title', 'No Title')
            url = source.get('url', 'No URL')
            formatted_sources.append(f"[{self._generate_citation_id(url)}] {title}. {url}")

        return '\n'.join(formatted_sources)

    def detect_conflicts(self, claims: List[Dict]) -> List[Dict]:
        """
        Detect conflicting numbers/dates across sources.

        :param claims: List of claims with 'number' and 'date' keys.
        :return: A list of conflicts.
        """
        conflicts = []
        seen_numbers = {}
        seen_dates = {}

        for claim in claims:
            number = claim.get('number')
            date = claim.get('date')

            if number:
                if number in seen_numbers:
                    if seen_numbers[number]['date'] != claim['date']:
                        conflicts.append({'type': 'number', 'value': number, 'claims': [seen_numbers[number], claim]})
                seen_numbers[number] = claim

            if date:
                if date in seen_dates:
                    if seen_dates[date]['number'] != claim['number']:
                        conflicts.append({'type': 'date', 'value': date, 'claims': [seen_dates[date], claim]})
                seen_dates[date] = claim

        return conflicts
