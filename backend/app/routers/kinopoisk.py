"""Интеграция с внешним API: поиск фильмов на Кинопоиске и импорт в фильмотеку."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import config, crud, kinopoisk, models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/kinopoisk", tags=["Кинопоиск"])

DB = Annotated[Session, Depends(get_db)]
ERRORS = {
    502: {"model": schemas.Message, "description": "Кинопоиск недоступен или отклонил ключ"},
    503: {"model": schemas.Message, "description": "Импорт не настроен (нет ключа) или лимит"},
}


@router.get("/status", response_model=schemas.KpStatus, summary="Доступен ли импорт")
def kp_status():
    return schemas.KpStatus(enabled=kinopoisk.enabled(), source=config.KINOPOISK_API_URL)


@router.get("/search", response_model=schemas.KpSearchPage, responses=ERRORS,
            summary="Поиск фильмов на Кинопоиске")
def kp_search(
    db: DB,
    q: Annotated[str, Query(min_length=1, max_length=100, description="Название фильма")],
    page: Annotated[int, Query(ge=1, le=10)] = 1,
    limit: Annotated[int, Query(ge=1, le=30)] = 12,
):
    """Ищет фильмы по названию на Кинопоиске. Для уже добавленных фильмов
    в ответе есть `movie_id` — их id в нашей фильмотеке."""
    data = kinopoisk.search(q.strip(), page, limit)
    items = []
    for doc in data.get("docs", []):
        existing = kinopoisk.find_existing(db, doc["id"], kinopoisk._title(doc), doc.get("year"))
        items.append(kinopoisk.to_search_item(doc, existing.id if existing else None))
    return schemas.KpSearchPage(items=items, total=data.get("total", len(items)),
                                page=data.get("page", page), pages=data.get("pages", 1))


@router.post("/import/{kp_id}", response_model=schemas.MovieOut,
             status_code=status.HTTP_201_CREATED,
             responses={**ERRORS, 409: {"model": schemas.Message, "description": "Уже добавлен"}},
             summary="Импортировать фильм с Кинопоиска")
def kp_import(kp_id: Annotated[int, Path(gt=0, description="ID фильма на Кинопоиске")], db: DB):
    """Загружает полную карточку фильма и сохраняет её в фильмотеку:
    название, описание, режиссёр, страна, год, рейтинг Кинопоиска, длительность, постер, жанр."""
    doc = kinopoisk.get_movie(kp_id)
    try:
        movie, created = kinopoisk.add_from_doc(db, doc)
    except ValueError as exc:
        raise HTTPException(422, f"Не удалось импортировать: {exc}")
    db.commit()
    if not created:
        raise HTTPException(409, f"Фильм «{movie.title}» уже есть в фильмотеке (id={movie.id})")
    return crud.get_movie_or_404(db, movie.id)


@router.post("/import-top", response_model=schemas.KpImportResult, responses=ERRORS,
             summary="Импортировать топ Кинопоиска")
def kp_import_top(
    db: DB,
    limit: Annotated[int, Query(ge=1, le=250, description="Сколько фильмов из топ-250")] = 50,
):
    """Добавляет первые `limit` фильмов из топ-250 Кинопоиска (один запрос к API).
    Фильмы, которые уже есть в фильмотеке, пропускаются."""
    imported, skipped = kinopoisk.import_top(db, limit)
    db.commit()
    total = db.scalar(select(func.count(models.Movie.id)))
    return schemas.KpImportResult(imported=imported, skipped=skipped, total=total)
