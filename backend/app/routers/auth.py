from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import IndividualEntrepreneur, LLCCompany, User
from app.schemas import LoginRequest, TokenResponse, UserOut
from app.security import create_access_token, get_current_user, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.llc_company),
            selectinload(User.individual_entrepreneur),
        )
        .outerjoin(LLCCompany, LLCCompany.user_id == User.id)
        .outerjoin(IndividualEntrepreneur, IndividualEntrepreneur.user_id == User.id)
        .where(
            User.email == payload.email.lower().strip()
            if payload.email
            else or_(LLCCompany.inn == payload.inn, IndividualEntrepreneur.inn == payload.inn)
        )
    )
    users = result.scalars().unique().all()
    user = users[0] if len(users) == 1 else None
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(user_id=user.id, role=user.role)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)
