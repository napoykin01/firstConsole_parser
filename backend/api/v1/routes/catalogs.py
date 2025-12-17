import httpx

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from lxml import etree

from api.v1.routes.auth import get_current_token
from config import settings

router = APIRouter()


async def fetch_catalogs(token: str) -> List[dict]:
    url = f"{settings.NETLAB_API_URL}/rest/catalogsZip/list.xml"
    params = {"oauth_token": token}

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, params=params)

    if response.status_code != 200:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to fetch catalogs: {response.status_code}",
        )

    root = etree.fromstring(response.content)
    ns = {"ns": "http://ws.web.netlab.com/"}

    status_node = root.find(".//ns:status", namespaces=ns)

    if status_node is None:
        raise HTTPException(status_code=500, detail="No status found in response")

    code = int(status_node.find("ns:code", namespaces=ns).text)
    message = status_node.find("ns:message", namespaces=ns).text

    if code != 200:
        raise HTTPException(status_code=400, detail=message or "Catalogs fetch failed")

    catalogs_list = [
        {"name": cat.find("ns:name", namespaces=ns).text}
        for cat in root.findall(".//ns:catalog", namespaces=ns)
        if cat.find("ns:name", namespaces=ns) is not None
    ]

    return catalogs_list


@router.get("/catalogs/get", summary="Получить список каталогов")
async def get_catalogs(token: str = Depends(get_current_token)) -> List[dict]:
    return await fetch_catalogs(token)