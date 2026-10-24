import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app import __version__
from app.config import settings
from app.database import engine, get_db
from app.routers import applications, auth, bank, cabinet, mock, products
from app.services.ai_service import warmup_ai

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Запуск %s v%s", settings.app_name, __version__)
    warmup_task = asyncio.create_task(warmup_ai())
    yield
    if not warmup_task.done():
        warmup_task.cancel()
    await engine.dispose()
    logger.info("Сервис остановлен")


app = FastAPI(
    title=settings.app_name,
    description=(
        "Сквозной кредитный кабинет для малого и микробизнеса: заявка, "
        "обогащение данными, локальная ИИ-проверка цели, скоринг и решение."
    ),
    version=__version__,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(products.router, prefix=settings.api_prefix)
app.include_router(applications.router, prefix=settings.api_prefix)
app.include_router(bank.router, prefix=settings.api_prefix)
app.include_router(mock.router, prefix=settings.api_prefix)
app.include_router(cabinet.router, prefix=settings.api_prefix)


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "version": __version__}


@app.get("/api/health", tags=["system"])
async def api_health(db: AsyncSession = Depends(get_db)):
    await db.execute(text("SELECT 1"))
    return {"status": "ok", "version": __version__, "database": "connected"}


@app.get("/", tags=["system"])
async def root():
    return {
        "name": settings.app_name,
        "version": __version__,
        "docs": "/docs",
        "health": "/api/health",
    }
