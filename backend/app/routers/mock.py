from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import mock_data

router = APIRouter(prefix="/mock", tags=["mock-integrations"])


@router.get("/egrul/{inn}")
async def egrul(inn: str):
    """Mock ЕГРЮЛ: карточка организации."""
    data = mock_data.get_egrul(inn)
    data["requested_at"] = datetime.now(timezone.utc).isoformat()
    return data


@router.get("/girbo/{inn}")
async def girbo(inn: str):
    """Mock ГИР БО: официальная бухгалтерская отчётность."""
    data = mock_data.get_girbo(inn)
    data["requested_at"] = datetime.now(timezone.utc).isoformat()
    return data


@router.get("/bki/{inn}")
async def bki(inn: str):
    """Mock БКИ: кредитная история и рейтинг."""
    data = mock_data.get_bki(inn)
    data["requested_at"] = datetime.now(timezone.utc).isoformat()
    return data
