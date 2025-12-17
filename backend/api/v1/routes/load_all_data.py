import httpx
import asyncio
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from tqdm.asyncio import tqdm
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from api.v1.routes.auth import get_current_token
from api.v1.routes.catalogs import fetch_catalogs
from api.v1.routes.categories import fetch_categories
from api.v1.routes.products import fetch_products
from database import get_db
from models.models import Catalog, Category, Product

logger = logging.getLogger(__name__)

DELAY_TIME: float = 0.030
MAX_RETRIES_ON_NETWORK_ERROR: int = 3
RETRY_DELAY: float = 1.0

router = APIRouter()

def str_to_int(value: str | None, default: int = 0) -> int:
    if not value or not value.strip().lstrip('-').isdigit():
        return default
    return int(float(value))

def str_to_float(value: str | None, default: float = 0.0) -> float:
    if not value:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default

async def retry_on_network_error(coro, *args, max_retries=MAX_RETRIES_ON_NETWORK_ERROR, delay=RETRY_DELAY):
    last_exception = None

    for attempt in range(max_retries + 1):
        try:
            return await coro(*args)

        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            last_exception = exc
            logger.warning(f"Network error on attempt {attempt + 1} for {coro.__name__}: {exc}")

        except httpx.HTTPStatusError as exc:
            last_exception = exc
            logger.warning(f"HTTP error on attempt {attempt + 1} for {coro.__name__}: {exc}")

        except Exception as exc:
            logger.error(f"Unexpected error on attempt {attempt + 1} for {coro.__name__}: {exc}")
            raise

        if attempt < max_retries:
            logger.info(f"Retrying in {delay} seconds...")
            await asyncio.sleep(delay)

    logger.error(f"All {max_retries} attempts failed for {coro.__name__}. Raising last exception.")

    raise last_exception

async def save_categories_to_db(db: AsyncSession, catalog: Catalog, categories: List[dict]) -> None:
    for cat_data in categories:
        cat_id = cat_data["id"]
        name = cat_data["name"]
        parent_id = cat_data["parentId"]
        leaf = cat_data["leaf"]

        existing = await db.get(Category, cat_id)

        if existing:
            existing.name = name
            existing.parent_id = parent_id
            existing.catalog_id = catalog.id
            existing.leaf = leaf
        else:
            db.add(
                Category(
                    id=cat_id,
                    name=name,
                    parent_id=parent_id,
                    catalog_id=catalog.id,
                    leaf=leaf,
                )
            )

    await db.commit()

async def save_products_to_db(db: AsyncSession, category_id: int, products: List[dict]) -> None:
    if not products:
        return

    rows = []
    for p in products:
        props = p["properties"]
        rows.append(
            {
                "netlab_id": int(p["id"]),
                "part_number": props.get("PN") or None,
                "name": props.get("название") or "Без названия",
                "category_id": category_id,
                "availableKurskaya": str_to_float(props.get("количество на Курской")),
                "availableTransit": str_to_float(props.get("количество в транзите")),
                "availableKaluzhskaya": str_to_float(props.get("количество на Калужской")),
                "availableLobnenskaya": str_to_float(props.get("количество на Лобненской")),
                "traceable_good": str_to_int(props.get("Прослеживаемый товар")),
                "priceCategoryN": str_to_float(props.get("цена по категории N")),
                "priceCategoryF": str_to_float(props.get("цена по категории F")),
                "priceCategoryE": str_to_float(props.get("цена по категории E")),
                "priceCategoryD": str_to_float(props.get("цена по категории D")),
                "priceCategoryC": str_to_float(props.get("цена по категории C")),
                "priceCategoryB": str_to_float(props.get("цена по категории B")),
                "priceCategoryA": str_to_float(props.get("цена по категории A")),
                "rrc": str_to_float(props.get("РРЦ")),
                "volume": str_to_float(props.get("объём, м^3")),
                "weight": str_to_float(props.get("вес, кг")),
                "guarantee": props.get("гарантия") or "не указано",
                "manufacturer": props.get("производитель") or "не указано",
                "tax": props.get("НДС") or None,
                "isDiscontinued": (props.get("снят с производства", "false")).lower() == "true",
                "isDeleted": (props.get("удален", "false")).lower() == "true",
            }
        )

    stmt = sqlite_insert(Product).values(rows)
    upsert = stmt.on_conflict_do_update(
        index_elements=[Product.netlab_id],
        set_={c.name: stmt.excluded[c.name] for c in Product.__table__.c if c.name != "netlab_id"},
    )
    await db.execute(upsert)
    await db.commit()

@router.post("/load_all", summary="Загрузить все каталоги, категории и товары в базу")
async def load_all_data(token: str = Depends(get_current_token), db: AsyncSession = Depends(get_db)):
    try:
        catalogs = await retry_on_network_error(fetch_catalogs, token)

    except Exception as exc:
        logger.error(f"Failed to fetch catalogs after retries: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch catalogs: {exc}")

    for catalog_data in tqdm(catalogs, desc="Catalogs", unit="cat"):
        catalog_name = catalog_data["name"] # noqa

        result = await db.execute(Catalog.__table__.select().where(Catalog.name == catalog_name))
        catalog = result.first()

        if not catalog:
            catalog = Catalog(name=catalog_name)
            db.add(catalog)
            await db.commit()
            await db.refresh(catalog)
        else:
            catalog = catalog[0]

        try:
            categories = await retry_on_network_error(fetch_categories, catalog_name, token)

        except Exception as exc:
            logger.error(
                f"Failed to fetch categories for catalog '{catalog_name}' after retries: {exc}. Skipping."
            )
            await db.rollback()
            continue

        await save_categories_to_db(db, catalog, categories)
        await asyncio.sleep(DELAY_TIME)

        leaf_categories = [c for c in categories if c.get("leaf")]

        for cat_data in tqdm(leaf_categories, desc=f"  {catalog_name} categories", unit="cat", leave=False):
            category_id = cat_data["id"]

            try:
                products = await retry_on_network_error(fetch_products, catalog_name, category_id, token)
                await save_products_to_db(db, category_id, products)

            except Exception as exc:
                logger.error(
                    f"Failed to fetch/save products for category {category_id} in catalog '{catalog_name}': {exc}. "
                    f"Skipping."
                )
                await db.rollback()

            await asyncio.sleep(DELAY_TIME)

    return {"message": "Loaded catalogs, categories, and products into DB"}