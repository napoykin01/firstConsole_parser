import os

from functools import lru_cache
from typing import Generator
from yandex_cloud_ml_sdk import YCloudML

from config import settings
from services.search_history_service import SearchHistory
from services.yandex_search_service import YandexSearchService

USER_AGENT = os.getenv("USER_AGENT", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")


@lru_cache()
def get_yandex_search_service() -> YandexSearchService:
    sdk = YCloudML(
        folder_id=settings.FOLDER_ID,
        auth=settings.YA_API_KEY,
    )

    service = YandexSearchService(
        yandex_sdk=sdk,
        user_agent=USER_AGENT,
        max_results=5
    )

    return service


@lru_cache()
def get_search_history() -> SearchHistory:
    return SearchHistory(max_history_size=1000)


def get_service() -> Generator[YandexSearchService, None, None]:
    service = get_yandex_search_service()
    try:
        yield service
    finally:
        pass


def get_history() -> Generator[SearchHistory, None, None]:
    history = get_search_history()
    yield history