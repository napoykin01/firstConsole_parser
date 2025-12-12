from fastapi import APIRouter, Depends, HTTPException
from lxml import etree
from typing import List

from api.v1.routes.auth import get_current_token
from config import settings

router = APIRouter()

def fetch_catalogs(token: str) -> List[dict]:
    url = f"{settings.NETLAB_API_URL}/rest/catalogsZip/list.xml"
    params = {"oauth_token": token}

    import requests
    response = requests.get(url, params=params)

    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch catalogs")

    root = etree.fromstring(response.content)

    ns = {'ns': 'http://ws.web.netlab.com/'}

    status_node = root.find('.//ns:status', namespaces=ns)
    if status_node is None:
        raise HTTPException(status_code=500, detail="No status found in response")

    code = int(status_node.find('ns:code', namespaces=ns).text)
    message = status_node.find('ns:message', namespaces=ns).text

    if code != 200:
        raise HTTPException(status_code=400, detail=message or "Catalogs fetch failed")

    catalogs_list = []
    catalogs = root.findall('.//ns:catalog', namespaces=ns)

    for catalog in catalogs:
        name = catalog.find('ns:name', namespaces=ns)
        if name is not None:
            catalogs_list.append({"name": name.text})

    return catalogs_list

@router.get("/catalogs", summary="Получить список каталогов")
def get_catalogs(token: str = Depends(get_current_token)) -> List[dict]:
    return fetch_catalogs(token)