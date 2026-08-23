from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_db
from .models import Session as RunSession


async def get_session(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RunSession:
    """Fetch a session by ID without any auth checks."""
    stmt = select(RunSession).where(RunSession.id == session_id)
    run = (await db.execute(stmt)).scalar_one_or_none()
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    return run


Db = Annotated[AsyncSession, Depends(get_db)]
OwnedSession = Annotated[RunSession, Depends(get_session)]
