"""Интеграция с Кинопоиском через неофициальный API «ПоискКино» (api.poiskkino.dev).

Документация: https://poiskkino.dev  ·  ключ: Telegram-бот @poiskkinodev_bot
Бесплатный тариф — 200 запросов в сутки, поэтому топ загружается одним запросом.
"""
from datetime import date

import httpx
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import config, models, schemas
from .database import norm

TIMEOUT = httpx.Timeout(30.0, connect=10.0)
LIST_FIELDS = ["id", "name", "alternativeName", "enName", "year", "rating", "type",
               "genres", "poster"]
FULL_FIELDS = LIST_FIELDS + ["description", "shortDescription", "movieLength",
                             "seriesLength", "totalSeriesLength", "countries", "persons"]


class KinopoiskError(HTTPException):
    pass


def enabled() -> bool:
    return bool(config.KINOPOISK_API_KEY)


def _get(path: str, params: dict | list | None = None) -> dict:
    """GET-запрос к API Кинопоиска с понятными ошибками."""
    if not enabled():
        raise KinopoiskError(503, "Импорт из Кинопоиска не настроен: задайте переменную "
                                  "окружения KINOPOISK_API_KEY")
    try:
        r = httpx.get(f"{config.KINOPOISK_API_URL}{path}", params=params, timeout=TIMEOUT,
                      headers={"X-API-KEY": config.KINOPOISK_API_KEY, "Accept": "application/json"})
    except httpx.HTTPError:
        raise KinopoiskError(502, "Кинопоиск не отвечает, попробуйте позже")
    if r.status_code in (401, 403):
        raise KinopoiskError(502, "Кинопоиск отклонил запрос: ключ недействителен "
                                  "или исчерпан суточный лимит запросов")
    if r.status_code == 429:
        raise KinopoiskError(503, "Слишком много запросов к Кинопоиску, подождите немного")
    if r.status_code == 404:
        raise KinopoiskError(404, "Фильм на Кинопоиске не найден")
    if r.status_code >= 400:
        raise KinopoiskError(502, f"Ошибка Кинопоиска ({r.status_code})")
    return r.json()


def _fields(names: list[str]) -> list[tuple[str, str]]:
    return [("selectFields", f) for f in names]


# ---------------------------------------------------------------- запросы к API
def search(query: str, page: int = 1, limit: int = 12) -> dict:
    return _get("/v1.4/movie/search", {"query": query, "page": page, "limit": limit})


def get_movie(kp_id: int) -> dict:
    return _get(f"/v1.4/movie/{kp_id}")


def top250(limit: int) -> list[dict]:
    params = [("lists", "top250"), ("sortField", "top250"), ("sortType", "1"),
              ("limit", str(limit)), *_fields(FULL_FIELDS)]
    return _get("/v1.4/movie", params).get("docs", [])


# ---------------------------------------------------------------- преобразование данных
def _cut(text: str, limit: int) -> str:
    text = (text or "").strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _title(doc: dict) -> str:
    return doc.get("name") or doc.get("alternativeName") or doc.get("enName") or ""


def _rating(doc: dict) -> float | None:
    rating = doc.get("rating") or {}
    value = rating.get("kp") or rating.get("imdb")
    return round(value, 1) if value else None


def _poster(doc: dict) -> str:
    poster = doc.get("poster") or {}
    url = poster.get("previewUrl") or poster.get("url") or ""
    return url if url.startswith(("http://", "https://")) else ""


def to_search_item(doc: dict, movie_id: int | None) -> schemas.KpSearchItem:
    return schemas.KpSearchItem(
        kp_id=doc["id"],
        title=_title(doc) or "Без названия",
        original_title=doc.get("alternativeName") or doc.get("enName") or "",
        year=doc.get("year"),
        rating=_rating(doc),
        type=doc.get("type") or "",
        genres=[g["name"] for g in doc.get("genres") or []],
        poster_url=_poster(doc),
        movie_id=movie_id,
    )


def to_movie_fields(doc: dict) -> dict:
    """Данные Кинопоиска → поля нашей модели Movie. Бросает ValueError, если данных не хватает."""
    title = _cut(_title(doc), 200)
    year = doc.get("year")
    duration = doc.get("movieLength") or doc.get("seriesLength") or doc.get("totalSeriesLength")
    if not title:
        raise ValueError("у фильма нет названия")
    if not year or not (schemas.MIN_YEAR <= year <= date.today().year + 5):
        raise ValueError("у фильма не указан год выпуска")
    if not duration or duration <= 0:
        raise ValueError("у фильма не указана длительность")
    directors = [p.get("name") or p.get("enName") for p in doc.get("persons") or []
                 if p.get("enProfession") == "director"]
    directors = [d for d in directors if d]
    return {
        "title": title,
        "description": _cut(doc.get("description") or doc.get("shortDescription") or "", 1000),
        "director": _cut(", ".join(directors[:2]), 100) or "Неизвестно",
        "country": _cut(", ".join(c["name"] for c in (doc.get("countries") or [])[:2]), 60),
        "year": year,
        "rating": min(_rating(doc) or 0.0, 10.0),
        "duration": min(int(duration), 1000),
        "poster_url": _cut(_poster(doc), 500),
        "kp_id": doc["id"],
    }


# ---------------------------------------------------------------- работа с базой
def _genre_for(db: Session, kp_genres: list[str]) -> models.Genre:
    """Первый жанр Кинопоиска, который уже есть у нас; иначе создаём жанр из первого."""
    names = [g for g in kp_genres if g] or ["другое"]
    for name in names:
        genre = db.scalar(select(models.Genre).where(func.py_lower(models.Genre.name) == norm(name)))
        if genre:
            return genre
    genre = models.Genre(name=names[0][:1].upper() + names[0][1:50], description="Импортирован из Кинопоиска")
    db.add(genre)
    db.flush()
    return genre


def find_existing(db: Session, kp_id: int, title: str, year: int | None) -> models.Movie | None:
    """Фильм уже в фильмотеке: по id Кинопоиска или по паре «название + год»."""
    movie = db.scalar(select(models.Movie).where(models.Movie.kp_id == kp_id))
    if movie or not title or not year:
        return movie
    return db.scalar(select(models.Movie).where(
        func.py_lower(models.Movie.title) == norm(title), models.Movie.year == year))


def add_from_doc(db: Session, doc: dict) -> tuple[models.Movie, bool]:
    """Добавляет фильм из ответа Кинопоиска. Возвращает (фильм, создан_ли_новый).
    Если фильм уже есть (например, из стартовых данных) — привязывает к нему kp_id."""
    fields = to_movie_fields(doc)
    existing = find_existing(db, fields["kp_id"], fields["title"], fields["year"])
    if existing:
        if existing.kp_id is None:
            existing.kp_id = fields["kp_id"]
        return existing, False
    genre = _genre_for(db, [g["name"] for g in doc.get("genres") or []])
    movie = models.Movie(**fields, genre_id=genre.id)
    db.add(movie)
    db.flush()
    return movie, True


def import_top(db: Session, limit: int) -> tuple[int, int]:
    """Импорт первых `limit` фильмов из топ-250 Кинопоиска одним запросом.
    Возвращает (добавлено, пропущено). Коммит — на вызывающей стороне."""
    imported = skipped = 0
    for doc in top250(limit):
        try:
            _, created = add_from_doc(db, doc)
        except ValueError:
            created = False
        imported += created
        skipped += not created
    return imported, skipped
