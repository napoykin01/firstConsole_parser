import httpx
from lxml import etree
from datetime import datetime
from fastapi import HTTPException, APIRouter

from config import settings
import asyncio

router = APIRouter()

_current_token: str | None = None
_token_expires_at: datetime | None = None
_token_lock = asyncio.Lock()

async def fetch_new_token() -> None:
    global _current_token, _token_expires_at

    url = f"{settings.NETLAB_API_URL}/rest/authentication/token.xml"
    params = {"username": settings.NETLAB_LOGIN, "password": settings.NETLAB_PASSWORD}

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, params=params)

    if response.status_code != 200:
        raise HTTPException(
            status_code=401,
            detail=f"Failed to authenticate: {response.status_code}",
        )

    root = etree.fromstring(response.content)
    ns = {"ns": "http://ws.web.netlab.com/"}

    status_node = root.find(".//ns:status", namespaces=ns)

    if status_node is None:
        raise ValueError("Could not find 'status' node in response XML.")

    code = int(status_node.find("ns:code", namespaces=ns).text)
    message = status_node.find("ns:message", namespaces=ns).text

    if code != 200:
        raise HTTPException(status_code=401, detail=message or "Authentication failed")

    data_node = root.find(".//ns:data", namespaces=ns)

    if data_node is None:
        raise ValueError("Could not find 'data' node in response XML.")

    token = data_node.find("ns:token", namespaces=ns).text
    expires_str = data_node.find("ns:expired_in", namespaces=ns).text

    _current_token = token
    _token_expires_at = datetime.strptime(expires_str, "%d.%m.%Y %H:%M")


async def ensure_valid_token() -> None:
    global _current_token, _token_expires_at

    async with _token_lock:
        now = datetime.now()

        if not _current_token or (_token_expires_at and now >= _token_expires_at):
            await fetch_new_token()


async def get_current_token() -> str:
    await ensure_valid_token()
    return _current_token

@router.get("/auth/token", summary="Получить токен")
async def get_token() -> dict[str, str]:
    token = await get_current_token()

    return {"token": token}