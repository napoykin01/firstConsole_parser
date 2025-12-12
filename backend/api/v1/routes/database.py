from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from api.v1.routes.auth import get_current_token
from api.v1.routes.categories import fetch_categories
from api.v1.routes.products import fetch_products
from models.models import Category, Product, Catalog
from database import get_db

router = APIRouter()


def save_categories_to_db(db: Session, catalog_name: str, categories: list):
    catalog = db.query(Catalog).filter(Catalog.name == catalog_name).first()
    if not catalog:
        catalog = Catalog(name=catalog_name)
        db.add(catalog)
        db.commit()
        db.refresh(catalog)

    for cat_data in categories:
        cat_id = cat_data["id"]
        name = cat_data["name"]
        parent_id = cat_data["parentId"]
        leaf = cat_data["leaf"]

        category = db.query(Category).filter(Category.id == cat_id).first()
        if not category:
            category = Category(
                id=cat_id,
                name=name,
                parent_id=parent_id,
                catalog_id=catalog.id,
                leaf=leaf
            )
            db.add(category)
        else:
            category.name = name
            category.parent_id = parent_id
            category.catalog_id = catalog.id
            category.leaf = leaf

    db.commit()

def save_products_to_db(db: Session, catalog_name: str, category_id: int, products: List[dict]):
    catalog = db.query(Catalog).filter(Catalog.name == catalog_name).first()
    if not catalog:
        catalog = Catalog(name=catalog_name)
        db.add(catalog)
        db.commit()
        db.refresh(catalog)

    category = db.query(Category).filter(Category.id == category_id).first()

    if not category:
        raise HTTPException(status_code=404,
                            detail=f"Category with id {category_id} not found in DB")

    for netlab_product in products:
        props = netlab_product["properties"]
        pn = props.get("PN")
        name = props.get("название")
        netlab_price_str = props.get("цена по категории A", "0")
        netlab_price = float(netlab_price_str) if netlab_price_str else 0.0

        existing_product = db.query(Product).filter(Product.netlab_id == netlab_product["id"]).first()
        if existing_product:
            existing_product.part_number = pn
            existing_product.name = name
            existing_product.netlab_price = netlab_price
            existing_product.additional_info = props
        else:
            product = Product(
                netlab_id=netlab_product["id"],
                part_number=pn,
                name=name,
                netlab_price=netlab_price,
                category_id=category.id,
                additional_info=props
            )
            db.add(product)

    db.commit()

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