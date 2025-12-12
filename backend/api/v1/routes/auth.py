import requests
from lxml import etree
from datetime import datetime
from fastapi import HTTPException, APIRouter

from config import settings

current_token: str | None = None
token_expires_at: datetime | None = None

router = APIRouter()


def fetch_new_token():
    global current_token, token_expires_at

    url = f"{settings.NETLAB_API_URL}/rest/authentication/token.xml"
    params = {"username": settings.NETLAB_LOGIN, "password": settings.NETLAB_PASSWORD}

    response = requests.get(url, params=params)

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail=f"Failed to authenticate: {response.status_code}")

    root = etree.fromstring(response.content)

    ns = {'ns': 'http://ws.web.netlab.com/'}

    status_node = root.find('.//ns:status', namespaces=ns)
    if status_node is None:
        raise ValueError("Could not find 'status' node in response XML.")

    code = int(status_node.find('ns:code', namespaces=ns).text)
    message = status_node.find('ns:message', namespaces=ns).text

    if code != 200:
        raise HTTPException(status_code=401, detail=message or "Authentication failed")

    data_node = root.find('.//ns:data', namespaces=ns)
    if data_node is None:
        raise ValueError("Could not find 'data' node in response XML.")

    token = data_node.find('ns:token', namespaces=ns).text
    expires_str = data_node.find('ns:expired_in', namespaces=ns).text

    current_token = token
    token_expires_at = datetime.strptime(expires_str, "%d.%m.%Y %H:%M")

def ensure_valid_token():
    global current_token, token_expires_at

    now = datetime.now()
    if not current_token or (token_expires_at and now >= token_expires_at):
        print("Token expired or not available. Fetching new one...")
        fetch_new_token()

def get_current_token() -> str:
    ensure_valid_token()
    return current_token

@router.get("/auth/token", summary="Получить токен")
def get_token():
    token = get_current_token()
    return {"token": token}