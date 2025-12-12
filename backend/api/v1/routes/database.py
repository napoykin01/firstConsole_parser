from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import event
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.engine import Engine
from typing import List, Dict

from api.v1.routes.auth import get_current_token
from api.v1.routes.categories import fetch_categories
from api.v1.routes.products import fetch_products
from models.models import Category, Product, Catalog
from database import get_db
from schemas.schemas import CategoryResponse, CatalogResponse, ProductResponse

router = APIRouter()


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, _):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA temp_store=MEMORY")
    cursor.execute("PRAGMA mmap_size=300000000")
    cursor.close()

def save_categories_to_db(db: Session, catalog_name: str, categories: list):
    catalog = db.query(Catalog).filter_by(name=catalog_name).first()
    if not catalog:
        catalog = Catalog(name=catalog_name)
        db.add(catalog)
        db.flush()
        db.refresh(catalog)

    existing = {
        c.id: c for c in
        db.query(Category).filter(Category.id.in_([c["id"] for c in categories]))
    }

    to_insert = []
    for cat in categories:
        if cat["id"] in existing:
            obj = existing[cat["id"]]
            obj.name       = cat["name"]
            obj.parent_id  = cat["parentId"]
            obj.catalog_id = catalog.id
            obj.leaf       = cat["leaf"]
        else:
            to_insert.append(
                Category(
                    id        = cat["id"],
                    name      = cat["name"],
                    parent_id = cat["parentId"],
                    catalog_id= catalog.id,
                    leaf      = cat["leaf"]
                )
            )

    if to_insert:
        db.bulk_save_objects(to_insert)
    db.commit()

def save_products_to_db(db: Session,
                        catalog_name: str,
                        category_id: int,
                        products: List[dict]):
    catalog = db.query(Catalog).filter_by(name=catalog_name).first()
    if not catalog:
        catalog = Catalog(name=catalog_name)
        db.add(catalog)
        db.flush()
        db.refresh(catalog)

    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(404, f"Category {category_id} not found")

    netlab_ids = [p["id"] for p in products]
    existing = {
        p.netlab_id: p for p in
        db.query(Product).filter(Product.netlab_id.in_(netlab_ids))
    }

    to_insert = []
    for pr in products:
        props = pr["properties"]
        price = float(props.get("цена по категории A") or 0)

        if pr["id"] in existing:
            obj = existing[pr["id"]]
            obj.part_number     = props.get("PN")
            obj.name            = props.get("название")
            obj.netlab_price    = price
            obj.additional_info = props
        else:
            to_insert.append(
                Product(
                    netlab_id      = pr["id"],
                    part_number    = props.get("PN"),
                    name           = props.get("название"),
                    netlab_price   = price,
                    category_id    = category_id,
                    additional_info= props
                )
            )

    if to_insert:
        db.bulk_save_objects(to_insert)
    db.commit()


def build_category_tree(categories_list: List[Category]) -> List[CategoryResponse]:
    category_map: Dict[int, CategoryResponse] = {
        cat.id: CategoryResponse.model_validate(cat) for cat in categories_list
    }

    root_nodes: List[CategoryResponse] = []

    for cat in categories_list:
        cat_resp = category_map[cat.id]

        if cat.parent_id is not None and cat.parent_id in category_map:
            parent = category_map[cat.parent_id]
            parent.children.append(cat_resp)
        else:
            root_nodes.append(cat_resp)

    return root_nodes

@router.post("/load_products/{catalog_name}/{category_id}",
             summary="Загрузить товары из API в базу")
def load_products(
    catalog_name: str,
    category_id: int,
    token: str = Depends(get_current_token),
    db: Session = Depends(get_db)
):
    products = fetch_products(catalog_name, category_id, token)
    save_products_to_db(db, catalog_name, category_id, products)
    return {"message": f"Loaded {len(products)} products into category {category_id} of catalog '{catalog_name}'"}

@router.post("/load_categories/{catalog_name}", summary="Загрузить категории каталога в базу")
def load_categories(
    catalog_name: str,
    token: str = Depends(get_current_token),
    db: Session = Depends(get_db)
):
    categories = fetch_categories(catalog_name, token)
    save_categories_to_db(db, catalog_name, categories)
    return {"message": f"Loaded {len(categories)} categories into catalog '{catalog_name}'"}


@router.get("/all_data", summary="Получить всё дерево: каталоги → категории → товары")
def get_all_data(db: Session = Depends(get_db)) -> List[CatalogResponse]:
    catalogs = (
        db.query(Catalog)
        .options(selectinload(Catalog.categories).selectinload(Category.products))
        .all()
    )

    result = []

    for catalog_orm in catalogs:
        catalog_pydantic = CatalogResponse.model_validate(catalog_orm)
        catalog_pydantic.categories = build_category_tree(catalog_orm.categories)
        result.append(catalog_pydantic)

    return result


@router.get("/products_by_category/{category_id}", summary="Получить товары по ID категории")
def get_products_by_category(
        category_id: int,
        db: Session = Depends(get_db)
) -> List[ProductResponse]:
    products = db.query(Product).filter(Product.category_id == category_id).all()
    if not products:
        raise HTTPException(status_code=404, detail="No products found for this category ID")

    return [ProductResponse.model_validate(p, from_attributes=True) for p in products]


@router.get("/catalog/{catalog_name}", summary="Получить все категории и товары по имени каталога")
def get_catalog_data(
    catalog_name: str,
    db: Session = Depends(get_db)
) -> CatalogResponse:
    catalog_orm = (
        db.query(Catalog)
        .filter(Catalog.name == catalog_name)
        .options(selectinload(Catalog.categories).selectinload(Category.products))
        .first()
    )
    if not catalog_orm:
        raise HTTPException(404, detail="Catalog not found")

    print(catalog_orm)

    catalog_pydantic = CatalogResponse.model_validate(catalog_orm)
    catalog_pydantic.categories = build_category_tree(catalog_orm.categories)

    return catalog_pydantic