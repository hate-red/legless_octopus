from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Product, User
from app.schemas import ProductOut
from app.security import get_current_user

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
async def list_products(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Product)
        .where(Product.is_active.is_(True))
        .order_by(Product.min_amount, Product.id)
    )
    return [ProductOut.model_validate(product) for product in result.scalars().all()]
