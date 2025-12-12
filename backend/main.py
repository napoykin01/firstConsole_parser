from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware

from database import engine
from api.v1.routes.auth import router as auth_router
from api.v1.routes.catalogs import router as catalogs_router
from api.v1.routes.categories import router as categories_router
from api.v1.routes.products import router as products_router
from api.v1.routes.database import router as database_router
from api.v1.routes.load_all_data import router as load_all_data_router
from api.v1.routes.yandex_parser import router as yandex_parser_router

from models import models


app = FastAPI(
    title="NetLab Parser API",
    description="API для парсинга товаров и анализа цен",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", include_in_schema=False)
def redirect_to_docs():
    return RedirectResponse(url="/docs")

app.include_router(auth_router, prefix="/api/v1", tags=["Авторизация"])

app.include_router(catalogs_router, prefix="/api/v1", tags=["Данные с Netlab"])
app.include_router(categories_router, prefix="/api/v1", tags=["Данные с Netlab"])
app.include_router(products_router, prefix="/api/v1", tags=["Данные с Netlab"])

app.include_router(database_router, prefix="/api/v1", tags=["Загрузка данных с Netlab"])
app.include_router(load_all_data_router, prefix="/api/v1", tags=["Загрузка данных с Netlab"])

app.include_router(yandex_parser_router, prefix="/api/v1", tags=["Парсинг в Яндекс"])

models.Base.metadata.create_all(bind=engine)