from enum import Enum
from typing import List
from pydantic import BaseModel, ConfigDict, Field


class YandexSourceResponse(BaseModel):
    id: int
    retail_price: float
    legal_entities_price: float | None = 0.0
    before_discount_price: float | None = 0.0
    url: str
    source_name: str | None

    class Config:
        from_attributes = True

class YandexSourceCreate(BaseModel):
    product_id: int
    retail_price: float = Field(..., gt=0)
    legal_entities_price: float | None = Field(None, gt=0)
    before_discount_price: float | None = Field(None, gt=0)
    url: str = Field(..., min_length=10)
    source_name: str | None = None


class YandexSourceUpdate(BaseModel):
    retail_price: float | None = Field(None, gt=0)
    legal_entities_price: float | None = Field(None, gt=0)
    before_discount_price: float | None = Field(None, gt=0)
    url: str | None = Field(None, min_length=10)
    source_name: str | None = None

class ProductResponse(BaseModel):
    id: int
    netlab_id: int
    part_number: str | None
    name: str
    netlab_price: float | None
    yandex_sources: List[YandexSourceResponse] = []

    class Config:
        from_attributes = True

class ProductDetailResponse(BaseModel):
    id: int
    netlab_id: int
    availableKurskaya: float
    availableTransit: float
    availableKaluzhskaya: float
    availableLobnenskaya: float
    guarantee: str | None
    manufacturer: str | None
    isDiscontinued: bool
    isDeleted: bool
    priceCategoryN: float | None
    priceCategoryF: float | None
    priceCategoryE: float | None
    priceCategoryD: float | None
    priceCategoryC: float | None
    priceCategoryB: float | None
    priceCategoryA: float | None
    rrc: float | None
    volume: float | None
    weight: float | None
    tax: str | None
    part_number: str | None
    name: str
    traceable_good: int | None
    category_id: int = None

    yandex_sources: List[YandexSourceResponse] = []

    class Config:
        from_attributes = True

class CategoryResponse(BaseModel):
    id: int
    name: str
    parent_id: int | None = None
    leaf: bool
    children: List["CategoryResponse"] = []
    products: List[ProductDetailResponse] = []

    model_config = ConfigDict(from_attributes=True)

CategoryResponse.model_rebuild()

class CatalogResponse(BaseModel):
    id: int
    name: str
    categories: List[CategoryResponse] = []

    class Config:
        from_attributes = True

class ProgressOut(BaseModel):
    status: str
    current: int
    total: int
    percent: int
    message: str

class SearchRequest(BaseModel):
    max_results: int | None = Field(
        default=5,
        ge=1,
        le=10,
        description="Максимальное количество результатов (от 1 до 10)"
    )
    max_pages: int | None = Field(
        default=2,
        ge=1,
        le=5,
        description="Максимальное количество страниц для поиска (от 1 до 5)"
    )

class BatchSearchRequest(BaseModel):
    queries: List[str] = Field(..., description="Список поисковых запросов")
    max_results: int | None = Field(
        default=5,
        ge=1,
        le=10,
        description="Максимальное количество результатов на запрос"
    )


class SearchStatsResponse(BaseModel):
    total_searches: int
    unique_queries: int
    average_results_per_query: float
    most_popular_queries: List[dict]


class CategoriesStatsRequest(BaseModel):
    category_ids: List[int]

class PriceType(str, Enum):
    N = "priceCategoryN"
    F = "priceCategoryF"
    E = "priceCategoryE"
    D = "priceCategoryD"
    C = "priceCategoryC"
    B = "priceCategoryB"
    A = "priceCategoryA"

class CategoriesByPriceRequest(BaseModel):
    catalog_id: int
    rub_cost: float
    exchange_rate: float
    price_type: PriceType
    category_ids: List[int]

class ProductsByPriceRequest(BaseModel):
    catalog_id: int
    rub_cost: float
    exchange_rate: float
    price_type: PriceType
    category_ids: List[int]

class CategoryPriceFilterResponse(BaseModel):
    category_id: int
    category_name: str
    products_count: int