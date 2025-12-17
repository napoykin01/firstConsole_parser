from datetime import datetime
from typing import List, Dict

from schemas.schemas import YandexSourceResponse


class SearchHistory:
    def __init__(self, max_history_size: int):
        self.history = []
        self.max_history_size = max_history_size

    def add_search(self, query: str, results: List[YandexSourceResponse]):
        entry = {
            'query': query,
            'timestamp': datetime.now(),
            'results_count': len(results),
            'results': results
        }
        self.history.append(entry)

        if len(self.history) > self.max_history_size:
            self.history = self.history[-self.max_history_size:]

    def get_recent_searches(self, count: int = 10) -> List[dict]:
        return self.history[-count:]

    def get_query_stats(self) -> Dict[str, int]:
        stats = {}

        for entry in self.history:
            query = entry['query']
            stats[query] = stats.get(query, 0) + 1
        return stats