"""Агрегация данных и служебные эндпоинты."""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/api", tags=["Статистика"])

DB = Annotated[Session, Depends(get_db)]


@router.get("/stats", response_model=schemas.LibraryStats, summary="Статистика фильмотеки")
def stats(db: DB):
    """Агрегация: число фильмов, средний рейтинг, разбивка по жанрам и десятилетиям."""
    return crud.library_stats(db)


@router.get("/health", summary="Проверка работоспособности")
def health(db: DB):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
