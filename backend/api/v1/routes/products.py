from typing import List, Dict, Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from lxml import etree

from api.v1.routes.auth import get_current_token
from config import settings

router = APIRouter()


async def fetch_products(
    catalog_name: str,
    category_id: int,
    token: str) -> List[Dict[str, Any]]:
    url = f"{settings.NETLAB_API_URL}/rest/catalogsZip/{catalog_name}/{category_id}.xml"
    params = {"oauth_token": token}

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, params=params)

    if response.status_code != 200:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to fetch products for catalog '{catalog_name}' and category '{category_id}'",
        )

    root = etree.fromstring(response.content)
    ns = {"ns": "http://ws.web.netlab.com/"}

    status_node = root.find(".//ns:status", namespaces=ns)

    if status_node is None:
        raise HTTPException(status_code=500, detail="No status found in response")

    code = int(status_node.find("ns:code", namespaces=ns).text)
    message = status_node.find("ns:message", namespaces=ns).text

    if code != 200:
        raise HTTPException(status_code=400, detail=message or "Products fetch failed")

    goods_list = []

    for good in root.findall(".//ns:goods", namespaces=ns):
        good_id = good.find("ns:id", namespaces=ns).text

        properties = {}

        for prop in good.findall(".//ns:property", namespaces=ns):
            name = prop.find("ns:name", namespaces=ns).text
            value = prop.find("ns:value", namespaces=ns).text
            if value is not None:
                properties[name] = value

        goods_list.append({"id": int(good_id), "properties": properties})

    return goods_list


@router.get("/products/{catalog_name}/{category_id}", summary="Получить список товаров категории")
async def get_products(
    catalog_name: str,
    category_id: int,
    token: str = Depends(get_current_token)) -> List[Dict[str, Any]]:
    """Возвращает информацию о ценах, НДС, объём, вес, количество..."""
    return await fetch_products(catalog_name, category_id, token)