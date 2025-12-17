from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from database import engine, Base
from api.v1.routes.auth import router as auth_router
from api.v1.routes.catalogs import router as catalogs_router
from api.v1.routes.categories import router as categories_router
from api.v1.routes.products import router as products_router
from api.v1.routes.database import router_write as database_write
from api.v1.routes.database import router_read as database_read
from api.v1.routes.load_all_data import router as load_all_data_router
from api.v1.routes.search import router as search_router

@asynccontextmanager
async def lifespan(app: FastAPI): # noqa
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

    await engine.dispose()

app = FastAPI(
    title="NetLab Parser API",
    description="API для парсинга товаров и анализа цен",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
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

app.include_router(database_write, prefix="/api/v1", tags=["Загрузка данных с Netlab в БД"])
app.include_router(load_all_data_router, prefix="/api/v1", tags=["Загрузка данных с Netlab в БД"])
app.include_router(database_read, prefix="/api/v1", tags=["Загрузка данных с БД"])

app.include_router(search_router, prefix="/api/v1/yandex-search", tags=["Поиск в Яндекс"])