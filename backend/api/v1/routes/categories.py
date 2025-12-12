from fastapi import APIRouter, Depends, HTTPException
from lxml import etree
from typing import List, Dict, Any

from api.v1.routes.auth import get_current_token
from config import settings

router = APIRouter()

def fetch_categories(catalog_name: str, token: str) -> List[Dict[str, Any]]:
    url = f"{settings.NETLAB_API_URL}/rest/catalogsZip/{catalog_name}.xml"
    params = {"oauth_token": token}

    import requests
    response = requests.get(url, params=params)

    if response.status_code != 200:
        raise HTTPException(status_code=400, detail=f"Failed to fetch categories for catalog '{catalog_name}'")

    root = etree.fromstring(response.content)

    ns = {'ns': 'http://ws.web.netlab.com/'}

    status_node = root.find('.//ns:status', namespaces=ns)

    if status_node is None:
        raise HTTPException(status_code=500, detail="No status found in response")

    code = int(status_node.find('ns:code', namespaces=ns).text)
    message = status_node.find('ns:message', namespaces=ns).text

    if code != 200:
        raise HTTPException(status_code=400,
                            detail=message or f"Categories fetch failed for catalog '{catalog_name}'")

    categories_list = []
    categories = root.findall('.//ns:category', namespaces=ns)

    for cat in categories:
        cat_id = cat.find('ns:id', namespaces=ns).text
        name = cat.find('ns:name', namespaces=ns).text
        parent_id_elem = cat.find('ns:parentId', namespaces=ns)
        parent_id = parent_id_elem.text if parent_id_elem is not None and parent_id_elem.text != '' else None
        leaf = cat.find('ns:leaf', namespaces=ns).text.lower() == 'true'

        categories_list.append({
            "id": int(cat_id),
            "name": name,
            "parentId": parent_id,
            "leaf": leaf
        })

    return categories_list

@router.get("/categories/{catalog_name}", summary="Получить список категорий каталога")
def get_categories(catalog_name: str, token: str = Depends(get_current_token)) -> List[Dict[str, Any]]:
    return fetch_categories(catalog_name, token)