from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.v1.routes.database import save_yandex_sources
from database import get_db
from models.models import Product
from schemas.schemas import YandexSourceResponse, SearchRequest, SearchStatsResponse
from services.search_history_service import SearchHistory
from services.yandex_search_service import YandexSearchService
from api.dependencies import get_service, get_history

router = APIRouter()


@router.post("/search/{search_query}", response_model=list[YandexSourceResponse])
async def search_items(
    request: SearchRequest,
    search_query: str,
    service: YandexSearchService = Depends(get_service),
    db: AsyncSession = Depends(get_db)):
    try:
        results = service.search(
            query=search_query,
            max_pages=request.max_pages
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка при поиске: {str(error)}"
        )

    product = await db.scalar(
        select(Product).where(Product.part_number == search_query) # noqa
    )
    if not product:
        raise HTTPException(404, "Product not found")

    await save_yandex_sources(db, product.id, results)

    return results


@router.post("/search/async/{search_query}", response_model=List[YandexSourceResponse])
async def search_items_async(
        search_query: str,
        service: YandexSearchService = Depends(get_service),
        history: SearchHistory = Depends(get_history),
        db: AsyncSession = Depends(get_db)):
    try:
        results = await service.search_async(search_query)

        history.add_search(search_query, results)

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка при асинхронном поиске: {str(error)}"
        )

    product = await db.scalar(
        select(Product).where(Product.part_number == search_query)  # noqa
    )
    if not product:
        raise HTTPException(404, "Product not found")

    await save_yandex_sources(db, product.id, results)

    return results


@router.get("/history", response_model=List[dict])
async def get_search_history(
        limit: int = Query(default=10, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
        history: SearchHistory = Depends(get_history)):
    all_history = history.get_recent_searches(count=1000)
    return all_history[offset:offset + limit]

@router.get("/history/{query}", response_model=List[dict])
async def get_history_by_query(
    query: str,
    limit: int = Query(default=10, ge=1, le=100),
    history: SearchHistory = Depends(get_history)):
    all_history = history.get_recent_searches(count=1000)

    filtered_history = [
        entry for entry in all_history
        if entry['query'].lower() == query.lower()
    ]

    return filtered_history[:limit]


@router.get("/stats", response_model=SearchStatsResponse)
async def get_search_statistics(
        history: SearchHistory = Depends(get_history)):
    stats = history.get_query_stats()
    all_history = history.get_recent_searches(count=1000)

    total_searches = len(all_history)

    unique_queries = len(stats)

    if total_searches > 0:
        total_results = sum(len(entry['results']) for entry in all_history)
        avg_results = total_results / total_searches
    else:
        avg_results = 0

    most_popular = [
        {"query": query, "count": count}
        for query, count in sorted(
            stats.items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]
    ]

    return SearchStatsResponse(
        total_searches=total_searches,
        unique_queries=unique_queries,
        average_results_per_query=avg_results,
        most_popular_queries=most_popular
    )