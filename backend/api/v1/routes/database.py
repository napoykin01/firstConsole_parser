import asyncio
from typing import List, Dict, Any, Sequence
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import event, select, func, delete, column, Integer, values
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from api.v1.routes.auth import get_current_token
from api.v1.routes.categories import fetch_categories
from models.models import Category, Product, Catalog, YandexSource
from schemas.schemas import ProductDetailResponse, YandexSourceResponse, CategoryResponse, CatalogResponse, \
    CategoriesStatsRequest, CategoriesByPriceRequest, PriceType, ProductsByPriceRequest, CategoryPriceFilterResponse, \
    CategoryIdsRequest, UnifiedFilterResponse, CategoryStats, UnifiedFilterRequest

router_write = APIRouter()
router_read = APIRouter()

PRICE_TYPE_COLUMN_MAP = {
    "priceCategoryN": Product.priceCategoryN,
    "priceCategoryF": Product.priceCategoryF,
    "priceCategoryE": Product.priceCategoryE,
    "priceCategoryD": Product.priceCategoryD,
    "priceCategoryC": Product.priceCategoryC,
    "priceCategoryB": Product.priceCategoryB,
    "priceCategoryA": Product.priceCategoryA,
}


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, _):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA temp_store=MEMORY")
    cursor.execute("PRAGMA mmap_size=300000000")
    cursor.execute("PRAGMA cache_size=-64000")
    cursor.close()

def _parse_int(value: str | None, default: int = 0) -> int:
    if not value or not str(value).strip().lstrip('-').isdigit():
        return default
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return default


def _parse_float(value: str | None, default: float = 0.0) -> float:
    if not value:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if not value:
        return default
    return str(value).lower() == 'true'


async def _get_or_create_catalog(db: AsyncSession, catalog_name: str) -> Catalog:
    catalog = await db.scalar(select(Catalog).filter_by(name=catalog_name))
    if not catalog:
        catalog = Catalog(name=catalog_name)
        db.add(catalog)
        await db.flush()
        await db.refresh(catalog)
    return catalog


async def save_categories_to_db(db: AsyncSession, catalog_name: str, categories: list[dict]) -> dict:
    catalog = await _get_or_create_catalog(db, catalog_name)

    ids = [c["id"] for c in categories]

    existing_stmt = select(Category).filter(Category.id.in_(ids))
    existing_categories = await db.scalars(existing_stmt)
    existing_map = {cat.id: cat for cat in existing_categories}

    to_insert = []
    updated = 0
    created = 0

    for cat_data in categories:
        cat_id = cat_data["id"]
        if cat_id in existing_map:
            cat = existing_map[cat_id]
            cat.name = cat_data["name"]
            cat.parent_id = cat_data["parentId"]
            cat.catalog_id = catalog.id
            cat.leaf = cat_data["leaf"]
            updated += 1
        else:
            to_insert.append(Category(
                id=cat_id,
                name=cat_data["name"],
                parent_id=cat_data["parentId"],
                catalog_id=catalog.id,
                leaf=cat_data["leaf"],
            ))
            created += 1

    if to_insert:
        await db.run_sync(lambda sess: sess.bulk_save_objects(to_insert))

    await db.commit()

    return {
        "total": len(categories),
        "created": created,
        "updated": updated,
        "catalog_id": catalog.id
    }


async def save_products_to_db(
        db: AsyncSession,
        catalog_name: str,
        category_id: int,
        products: list[dict]) -> dict:
    catalog = await _get_or_create_catalog(db, catalog_name)

    category = await db.get(Category, category_id)
    if not category:
        raise HTTPException(404, f"Category {category_id} not found")

    netlab_ids = [int(p["id"]) for p in products]

    existing_stmt = select(Product).filter(Product.netlab_id.in_(netlab_ids))
    existing_products = await db.scalars(existing_stmt)
    existing_map = {p.netlab_id: p for p in existing_products}

    to_insert = []
    updated = 0
    created = 0

    for pr in products:
        props = pr.get("properties", {})
        netlab_id = int(pr["id"])

        product_data = {
            "part_number": props.get("PN"),
            "name": props.get("название") or "Без названия",
            "availableKurskaya": _parse_float(props.get("количество на Курской")),
            "availableTransit": _parse_float(props.get("количество в транзите")),
            "availableKaluzhskaya": _parse_float(props.get("количество на Калужской")),
            "availableLobnenskaya": _parse_float(props.get("количество на Лобненской")),
            "priceCategoryN": _parse_float(props.get("цена по категории N")),
            "priceCategoryF": _parse_float(props.get("цена по категории F")),
            "priceCategoryE": _parse_float(props.get("цена по категории E")),
            "priceCategoryD": _parse_float(props.get("цена по категории D")),
            "priceCategoryC": _parse_float(props.get("цена по категории C")),
            "priceCategoryB": _parse_float(props.get("цена по категории B")),
            "priceCategoryA": _parse_float(props.get("цена по категории A")),
            "rrc": _parse_float(props.get("РРЦ")),
            "volume": _parse_float(props.get("объём, м^3")),
            "weight": _parse_float(props.get("вес, кг")),
            "guarantee": props.get("гарантия") or "не указано",
            "manufacturer": props.get("производитель") or "не указано",
            "tax": props.get("НДС"),
            "isDiscontinued": _parse_bool(props.get("снят с производства")),
            "isDeleted": _parse_bool(props.get("удален")),
            "traceable_good": _parse_int(props.get("Прослеживаемый товар")),
            "category_id": category_id,
        }

        if netlab_id in existing_map:
            product = existing_map[netlab_id]
            for attr, value in product_data.items():
                setattr(product, attr, value)
            updated += 1
        else:
            to_insert.append(Product(netlab_id=netlab_id, **product_data))
            created += 1

    if to_insert:
        await db.run_sync(lambda sess: sess.bulk_save_objects(to_insert))

    await db.commit()

    return {
        "total": len(products),
        "created": created,
        "updated": updated,
        "category_id": category_id,
        "catalog_id": catalog.id
    }

async def product_to_response(product: Product) -> ProductDetailResponse:
    yandex_sources = []
    if hasattr(product, 'yandex_sources') and product.yandex_sources:
        yandex_sources = [
            YandexSourceResponse(
                id=ys.id,
                retail_price=ys.retail_price,
                legal_entities_price=ys.legal_entities_price,
                before_discount_price=ys.before_discount_price,
                url=ys.url,
                source_name=ys.source_name,
            )
            for ys in product.yandex_sources
        ]

    return ProductDetailResponse(
        id=product.id,
        netlab_id=product.netlab_id,
        availableKurskaya=product.availableKurskaya,
        availableTransit=product.availableTransit,
        availableKaluzhskaya=product.availableKaluzhskaya,
        availableLobnenskaya=product.availableLobnenskaya,
        guarantee=product.guarantee,
        manufacturer=product.manufacturer,
        isDiscontinued=product.isDiscontinued,
        isDeleted=product.isDeleted,
        priceCategoryN=product.priceCategoryN,
        priceCategoryF=product.priceCategoryF,
        priceCategoryE=product.priceCategoryE,
        priceCategoryD=product.priceCategoryD,
        priceCategoryC=product.priceCategoryC,
        priceCategoryB=product.priceCategoryB,
        priceCategoryA=product.priceCategoryA,
        rrc=product.rrc,
        volume=product.volume,
        weight=product.weight,
        tax=product.tax,
        part_number=product.part_number,
        name=product.name,
        traceable_good=product.traceable_good,
        category_id=product.category_id,
        yandex_sources=yandex_sources
    )

async def save_yandex_sources(
    db: AsyncSession,
    product_id: int,
    sources: list[YandexSourceResponse]) -> None:
    sources = sources[:5]

    await db.execute(
        delete(YandexSource).where(YandexSource.product_id == product_id) # noqa
    )

    to_insert = [
        YandexSource(
            product_id=product_id,
            retail_price=src.retail_price,
            legal_entities_price=src.legal_entities_price,
            before_discount_price=src.before_discount_price,
            url=src.url,
            source_name=src.source_name,
        )

        for src in sources
    ]

    if to_insert:
        db.add_all(to_insert)

    await db.commit()


async def build_category_tree(categories: Sequence[Category], db: AsyncSession) -> List[Dict[str, Any]]:
    if not categories:
        return []

    category_ids = [cat.id for cat in categories]

    products_stmt = (
        select(Product)
        .filter(Product.category_id.in_(category_ids))
        .options(selectinload(Product.yandex_sources))
    )
    products_result = await db.scalars(products_stmt)
    all_products = products_result.all()

    products_by_category: Dict[int, List[Dict[str, Any]]] = {}

    for product in all_products:
        if product.category_id not in products_by_category:
            products_by_category[product.category_id] = []

        products_by_category[product.category_id].append({
            "id": product.id,
            "netlab_id": product.netlab_id,
            "name": product.name,
            "part_number": product.part_number,
            "yandex_sources": [
                {
                    "id": ys.id,
                    "retail_price": ys.retail_price,
                    "legal_entities_price": ys.legal_entities_price,
                    "url": ys.url,
                    "source_name": ys.source_name,
                }
                for ys in product.yandex_sources
            ] if product.yandex_sources else []
        })

    category_dicts = []
    for cat in categories:
        category_dicts.append({
            "id": cat.id,
            "name": cat.name,
            "parent_id": cat.parent_id,
            "leaf": cat.leaf,
            "products": products_by_category.get(cat.id, []),
            "children": []
        })

    category_map = {cat["id"]: cat for cat in category_dicts}
    roots = []

    for cat_dict in category_dicts:
        parent_id = cat_dict["parent_id"]
        if parent_id is not None and parent_id in category_map:
            category_map[parent_id]["children"].append(cat_dict)
        else:
            roots.append(cat_dict)

    return roots

@router_write.post(
    "/load_categories/{catalog_name}",
    summary="Загрузить категории каталога в базу",
    operation_id="write_load_categories")
async def load_categories_endpoint(
        catalog_name: str,
        token: str = Depends(get_current_token),
        db: AsyncSession = Depends(get_db)) -> dict:
    categories = await fetch_categories(catalog_name, token)
    stats = await save_categories_to_db(db, catalog_name, categories)

    return {
        "message": f"Loaded {stats['total']} categories into catalog '{catalog_name}'",
        "stats": stats
    }

@router_read.get("/public/get-products-by-categoryid/{category_id}",
                 summary="Получить товары по ID категории",
                 operation_id="read_products_by_category_id")
async def get_products_by_category_endpoint(
        category_id: int,
        db: AsyncSession = Depends(get_db)) -> List[ProductDetailResponse]:
    products = await db.scalars(
        select(Product)
        .filter(Product.category_id == category_id) # noqa
        .options(selectinload(Product.yandex_sources))
    )

    product_list = products.all()
    if not product_list:
        raise HTTPException(404, detail="No products found for this category ID")

    responses = await asyncio.gather(*[product_to_response(p) for p in product_list])

    return responses


@router_read.get("/public/get-catalogs",
                 summary="Получить статистику по всем каталогам",
                 operation_id="read_all_data_stats")
async def get_all_data_stats(db: AsyncSession = Depends(get_db)) -> List[Dict[str, Any]]:
    stmt = (
        select(
            Catalog.id,
            Catalog.name,
            func.count(Category.id.distinct()).label("categories_count"),
            func.count(Product.id.distinct()).label("products_count")
        )
        .outerjoin(Category, Category.catalog_id == Catalog.id) # noqa
        .outerjoin(Product, Product.category_id == Category.id)
        .group_by(Catalog.id, Catalog.name)
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [
        {
            "id": row.id,
            "name": row.name,
            "categories_count": row.categories_count or 0,
            "products_count": row.products_count or 0,
        }
        for row in rows
    ]


@router_read.get("/public/get-categories-and-products/{catalog_name}",
                 summary="Получить все категории и товары по имени каталога",
                 operation_id="read_catalog_data")
async def get_catalog_data_endpoint(
        catalog_name: str,
        db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    catalog = await db.scalar(select(Catalog).filter(Catalog.name == catalog_name)) # noqa

    if not catalog:
        raise HTTPException(404, detail=f"Catalog '{catalog_name}' not found")

    categories = await db.scalars(
        select(Category).filter(Category.catalog_id == catalog.id) # noqa
    )
    all_categories = categories.all()

    category_tree = await build_category_tree(all_categories, db)

    return {
        "catalog": {
            "id": catalog.id,
            "name": catalog.name
        },
        "categories": category_tree
    }


@router_read.get("/catalog/{catalog_name}/category/{category_id}",
                 operation_id="read_category_with_products")
async def get_category_with_products_endpoint(
        catalog_name: str,
        category_id: int,
        db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    catalog = await db.scalar(select(Catalog).filter(Catalog.name == catalog_name)) # noqa

    if not catalog:
        raise HTTPException(404, detail=f"Catalog '{catalog_name}' not found")

    category = await db.scalar(
        select(Category)
        .filter(Category.id == category_id, Category.catalog_id == catalog.id) # noqa
    )

    if not category:
        raise HTTPException(
            404,
            detail=f"Category with ID {category_id} not found in catalog '{catalog_name}'"
        )

    products = await db.scalars(
        select(Product)
        .filter(Product.category_id == category_id) # noqa
        .options(selectinload(Product.yandex_sources))
    )
    product_list = products.all()

    product_responses = await asyncio.gather(
        *[product_to_response(p) for p in product_list]
    )

    catalog_response = CatalogResponse(
        id=catalog.id,
        name=catalog.name,
        categories=[]
    )

    category_response = CategoryResponse(
        id=category.id,
        name=category.name,
        parent_id=category.parent_id,
        leaf=category.leaf,
        products=product_responses,
        children=[]
    )

    return {
        "catalog": catalog_response,
        "category": category_response,
        "products_count": len(product_responses)
    }

@router_read.get("/public/get-categories/{catalog_name}",
                 summary="Получить все категории по имени каталога",
                 operation_id="read_categories_only")
async def get_categories_only_endpoint(
        catalog_name: str,
        db: AsyncSession = Depends(get_db)) -> List[Dict[str, Any]]:
    catalog = await db.scalar(select(Catalog).filter(Catalog.name == catalog_name)) # noqa

    if not catalog:
        raise HTTPException(status_code=404, detail=f"Catalog '{catalog_name}' not found")

    categories = await db.scalars(
        select(Category)
        .filter(Category.catalog_id == catalog.id) # noqa
        .options(selectinload(Category.children))
    )
    all_categories = categories.all()

    result = []
    for cat in all_categories:
        children_data = [
            {
                "id": child.id,
                "name": child.name,
                "parent_id": child.parent_id,
                "leaf": child.leaf
            }
            for child in cat.children
        ]
        result.append({
            "id": cat.id,
            "name": cat.name,
            "parent_id": cat.parent_id,
            "leaf": cat.leaf,
            "children": children_data
        })

    return result


@router_read.post("/public/get-specific-categories-with-products/{catalog_id}",
                  summary="Получить конкретные категории с товарами по ID для каталога",
                  operation_id="read_specific_categories_with_products")
async def get_specific_categories_with_products_endpoint(
        catalog_id: int,
        request: CategoryIdsRequest,  # ← получаем объект модели
        db: AsyncSession = Depends(get_db)
) -> List[Dict[str, Any]]:
    # Извлекаем список ID из модели
    category_ids = request.category_ids

    if not category_ids:
        raise HTTPException(status_code=400, detail="Список category_ids не может быть пустым")

    catalog = await db.scalar(select(Catalog).filter(Catalog.id == catalog_id))

    if not catalog:
        raise HTTPException(status_code=404, detail=f"Catalog '{catalog_id}' not found")

    categories_result = await db.scalars(
        select(Category).filter(
            Category.id.in_(category_ids),  # ← используем список
            Category.catalog_id == catalog.id
        )
    )
    found_categories = categories_result.all()

    found_ids = {cat.id for cat in found_categories}
    not_found_ids = set(category_ids) - found_ids
    if not_found_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Categories with IDs {list(not_found_ids)} not found in catalog '{catalog_id}'"
        )

    sorted_found_categories = sorted(found_categories, key=lambda x: category_ids.index(x.id))
    all_product_categories_ids = [cat.id for cat in sorted_found_categories]

    products_result = await db.scalars(
        select(Product)
        .filter(Product.category_id.in_(all_product_categories_ids))
        .options(selectinload(Product.yandex_sources))
    )
    all_products = products_result.all()

    products_by_category_id: Dict[int, List[Product]] = {}
    for product in all_products:
        if product.category_id not in products_by_category_id:
            products_by_category_id[product.category_id] = []
        products_by_category_id[product.category_id].append(product)

    result = []

    for cat in sorted_found_categories:
        category_products = products_by_category_id.get(cat.id, [])
        product_responses = await asyncio.gather(*[product_to_response(p) for p in category_products])

        result.append({
            "id": cat.id,
            "name": cat.name,
            "parent_id": cat.parent_id,
            "leaf": cat.leaf,
            "products": product_responses
        })

    return result


@router_read.post(
    "/public/get-categories-stats/{catalog_name}",
    summary="Получить статистику по количеству товаров и товаров с Яндекс источниками по ID категорий",
    operation_id="read_categories_stats",
)
async def get_categories_stats_endpoint(
        catalog_name: str,
        request: CategoriesStatsRequest,
        db: AsyncSession = Depends(get_db),
) -> List[Dict[str, int]]:
    unique_ids = list(set(request.category_ids))

    if not unique_ids:
        raise HTTPException(status_code=400, detail="Список category_ids не может быть пустым")

    catalog_id = await db.scalar(select(Catalog.id).filter_by(name=catalog_name))
    if not catalog_id:
        raise HTTPException(status_code=404, detail=f"Catalog '{catalog_name}' not found")

    id_col = column("id", Integer)
    wanted = values(id_col).data([(i,) for i in unique_ids]).cte("wanted_ids")

    rows = await db.execute(
        select(
            wanted.c.id,
            func.count(Product.id).label("total_products"),
            func.count(YandexSource.id).label("has_yandex_sources"),
        )
        .select_from(wanted)
        .outerjoin(Product, Product.category_id == wanted.c.id) # noqa
        .outerjoin(YandexSource, YandexSource.product_id == Product.id)
        .group_by(wanted.c.id)
    )

    stats = {r.id: (r.total_products, r.has_yandex_sources) for r in rows}

    return [
        {
            "category_id": cid,
            "total_products": stats.get(cid, (0, 0))[0],
            "has_yandex_sources": stats.get(cid, (0, 0))[1],
        }
        for cid in unique_ids
    ]

@router_read.post(
    "/public/filter/categories-by-price",
    summary="Категории и количество товаров дороже заданной цены",
    operation_id="filter_categories_by_price",
)
async def filter_categories_by_price_endpoint(
    request: CategoriesByPriceRequest,
    db: AsyncSession = Depends(get_db),
) -> List[CategoryPriceFilterResponse]:

    if not request.category_ids:
        raise HTTPException(400, detail="category_ids не может быть пустым")

    price_column = PRICE_TYPE_COLUMN_MAP[request.price_type]

    stmt = (
        select(
            Category.id.label("category_id"),
            Category.name.label("category_name"),
            func.count(Product.id).label("products_count"),
        )
        .join(Product, Product.category_id == Category.id) # noqa
        .where(
            Category.catalog_id == request.catalog_id,
            Category.id.in_(request.category_ids),
            price_column.isnot(None),
            (price_column * request.exchange_rate) > request.rub_cost,
        )
        .group_by(Category.id, Category.name)
    )

    rows = (await db.execute(stmt)).all()

    return [
        CategoryPriceFilterResponse(
            category_id=row.category_id,
            category_name=row.category_name,
            products_count=row.products_count,
        )
        for row in rows
    ]

@router_read.post(
    "/public/filter/products-by-price",
    summary="Товары дороже заданной цены",
    operation_id="filter_products_by_price",
)
async def filter_products_by_price_endpoint(
    request: ProductsByPriceRequest,
    db: AsyncSession = Depends(get_db),
) -> List[ProductDetailResponse]:

    if not request.category_ids:
        raise HTTPException(400, detail="category_ids не может быть пустым")

    price_column = PRICE_TYPE_COLUMN_MAP[request.price_type]

    stmt = (
        select(Product)
        .join(Category, Category.id == Product.category_id) # noqa
        .where(
            Category.catalog_id == request.catalog_id,
            Product.category_id.in_(request.category_ids),
            price_column.isnot(None),
            (price_column * request.exchange_rate) > request.rub_cost,
        )
        .options(selectinload(Product.yandex_sources))
    )

    products = (await db.scalars(stmt)).all()

    if not products:
        return []

    return await asyncio.gather(
        *[product_to_response(product) for product in products]
    )


@router_read.post(
    "/public/unified-filter",
    summary="Универсальный фильтр с поддержкой всех параметров",
    operation_id="unified_filter",
    response_model=UnifiedFilterResponse
)
async def unified_filter_endpoint(
    request: UnifiedFilterRequest,
    db: AsyncSession = Depends(get_db),
) -> UnifiedFilterResponse:
    """
    Универсальный фильтр, который заменяет несколько ручек:
    1. Если указаны category_ids - работает как get-specific-categories-with-products
    2. Если указан min_price_rub - применяет фильтрацию по цене
    3. Поддерживает разные форматы возврата (категории с товарами или просто товары)
    4. Возвращает статистику
    """

    # Проверяем каталог
    catalog = await db.scalar(
        select(Catalog).where(Catalog.id == request.catalog_id)
    )
    if not catalog:
        raise HTTPException(404, detail=f"Catalog with ID {request.catalog_id} not found")

    print(f"Found catalog: {catalog.name}")

    # Получаем категории
    categories_query = select(Category).where(
        Category.catalog_id == request.catalog_id
    )

    if request.category_ids and len(request.category_ids) > 0:
        categories_query = categories_query.where(
            Category.id.in_(request.category_ids)
        )

    categories_result = await db.scalars(categories_query)
    categories = categories_result.all()

    if not categories:
        return UnifiedFilterResponse(
            success=True,
            catalog_id=request.catalog_id,
            catalog_name=catalog.name,
            categories=[],
            products=[],
            applied_filters=request.model_dump(exclude_none=True)
        )

    category_ids = [cat.id for cat in categories]

    products_query = (
        select(Product)
        .where(Product.category_id.in_(category_ids))
        .options(selectinload(Product.yandex_sources))
    )

    if request.min_price_rub is not None and request.min_price_rub > 0:
        price_type_str = request.price_type.value if hasattr(request.price_type, 'value') else str(request.price_type)
        price_column = PRICE_TYPE_COLUMN_MAP.get(request.price_type, Product.priceCategoryA)
        min_price_usd = request.min_price_rub / request.exchange_rate

        products_query = products_query.where(
            price_column >= min_price_usd
        )

    offset = (request.page - 1) * request.limit
    products_query = products_query.offset(offset).limit(request.limit)

    products_result = await db.scalars(products_query)
    filtered_products = products_result.all()

    all_products_query = (
        select(Product)
        .where(Product.category_id.in_(category_ids))
        .options(selectinload(Product.yandex_sources))
    )

    if request.min_price_rub is not None and request.min_price_rub > 0:
        price_type_str = request.price_type.value if hasattr(request.price_type, 'value') else str(request.price_type)
        price_column = PRICE_TYPE_COLUMN_MAP.get(price_type_str, Product.priceCategoryA)
        min_price_usd = request.min_price_rub / request.exchange_rate
        all_products_query = all_products_query.where(price_column >= min_price_usd)

    all_products_result = await db.scalars(all_products_query)
    all_products = all_products_result.all()

    product_responses = await asyncio.gather(
        *[product_to_response(p) for p in filtered_products]
    )

    total_products = len(all_products)
    products_with_sources = sum(
        1 for p in all_products if p.yandex_sources and len(p.yandex_sources) > 0
    )
    total_sources = sum(
        len(p.yandex_sources) for p in all_products if p.yandex_sources
    )

    coverage_percentage = (
        (products_with_sources / total_products * 100) if total_products > 0 else 0.0
    )

    response_data = {
        "success": True,
        "catalog_id": request.catalog_id,
        "catalog_name": catalog.name,
        "total_categories": len(categories),
        "total_products": total_products,
        "total_filtered_products": len(filtered_products),
        "products_with_sources": products_with_sources,
        "total_sources": total_sources,
        "coverage_percentage": round(coverage_percentage, 2),
        "applied_filters": request.model_dump(exclude_none=True),
        "pagination": {
            "page": request.page,
            "limit": request.limit,
            "total_items": total_products,
            "total_pages": (total_products + request.limit - 1) // request.limit
        }
    }

    if request.include_stats:
        category_stats = []
        for category in categories:
            category_products = [p for p in all_products if p.category_id == category.id]
            cat_products_with_sources = sum(
                1 for p in category_products if p.yandex_sources and len(p.yandex_sources) > 0
            )
            cat_coverage = (
                (cat_products_with_sources / len(category_products) * 100)
                if category_products else 0.0
            )

            category_stats.append(CategoryStats(
                category_id=category.id,
                category_name=category.name,
                total_products=len(category_products),
                products_with_sources=cat_products_with_sources,
                coverage_percentage=round(cat_coverage, 2)
            ))

        response_data["category_stats"] = category_stats

    if request.return_format == "categories":
        # 1. товары, прошедшие фильтр, разбиты по категориям
        products_by_category: Dict[int, List[Product]] = {
            cat_id: [] for cat_id in category_ids
        }
        for p in filtered_products:
            products_by_category[p.category_id].append(p)

        # 2. строим ответ ровно один раз
        response_categories = []
        for category in categories:
            prods = products_by_category.get(category.id, [])
            product_responses = await asyncio.gather(
                *[product_to_response(p) for p in prods]
            )
            response_categories.append({
                "id": category.id,
                "name": category.name,
                "parent_id": category.parent_id,
                "leaf": category.leaf,
                "products": product_responses,
                "children": []
            })

        response_data["categories"] = response_categories
        response_data["products"] = None

    return UnifiedFilterResponse(**response_data)