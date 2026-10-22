"""Операции с данными: CRUD, поиск, фильтрация, сортировка, пагинация, агрегация."""
import math

from fastapi import HTTPException, status
from sqlalchemy import case, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from . import models, schemas
from .database import norm

M = models.Movie
G = models.Genre


def _validation_error(field: str, message: str) -> HTTPException:
    """Ошибка 422 в том же формате, что и ошибки валидации FastAPI."""
    return HTTPException(422, [{"loc": ["body", field], "type": "value_error", "msg": message}])


# ====================================================================== жанры


def _genre_out(genre: models.Genre, movies_count: int) -> schemas.GenreOut:
    out = schemas.GenreOut.model_validate(genre)
    out.movies_count = movies_count
    return out


def _count_movies(db: Session, genre_id: int) -> int:
    return db.scalar(select(func.count(M.id)).where(M.genre_id == genre_id))


def get_genre_or_404(db: Session, genre_id: int) -> models.Genre:
    genre = db.get(G, genre_id)
    if genre is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Жанр с id={genre_id} не найден")
    return genre


def _ensure_genre_name_free(db: Session, name: str, exclude_id: int | None = None):
    stmt = select(G.id).where(func.py_lower(G.name) == norm(name))
    if exclude_id is not None:
        stmt = stmt.where(G.id != exclude_id)
    if db.scalar(stmt) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Жанр «{name}» уже существует")


def list_genres(db: Session) -> list[schemas.GenreOut]:
    stmt = select(G, func.count(M.id)).outerjoin(M).group_by(G.id).order_by(G.id)
    return [_genre_out(genre, cnt) for genre, cnt in db.execute(stmt).all()]


def get_genre(db: Session, genre_id: int) -> schemas.GenreOut:
    return _genre_out(get_genre_or_404(db, genre_id), _count_movies(db, genre_id))


def create_genre(db: Session, data: schemas.GenreCreate) -> schemas.GenreOut:
    _ensure_genre_name_free(db, data.name)
    genre = G(**data.model_dump())
    db.add(genre)
    db.commit()
    db.refresh(genre)
    return _genre_out(genre, 0)


def update_genre(db: Session, genre_id: int, data: schemas.GenreUpdate) -> schemas.GenreOut:
    genre = get_genre_or_404(db, genre_id)
    _ensure_genre_name_free(db, data.name, exclude_id=genre_id)
    for field, value in data.model_dump().items():
        setattr(genre, field, value)
    db.commit()
    db.refresh(genre)
    return _genre_out(genre, _count_movies(db, genre_id))


def delete_genre(db: Session, genre_id: int) -> None:
    genre = get_genre_or_404(db, genre_id)
    count = _count_movies(db, genre_id)
    if count:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Нельзя удалить жанр: к нему относится фильмов — {count}. "
            "Сначала удалите фильмы или смените им жанр.",
        )
    db.delete(genre)
    db.commit()


# ====================================================================== фильмы

SORT_COLUMNS = {
    "id": M.id,
    "title": func.py_lower(M.title),
    "year": M.year,
    "rating": M.rating,
    "duration": M.duration,
    "created_at": M.created_at,
}


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _movie_conditions(f: schemas.MovieFilter) -> list:
    conds = []
    if f.q:
        # поиск по названию без учёта регистра (в т. ч. кириллица — см. database.py)
        conds.append(func.py_lower(M.title).like(f"%{_escape_like(norm(f.q))}%", escape="\\"))
    if f.genre_id is not None:
        conds.append(M.genre_id == f.genre_id)
    if f.year_from is not None:
        conds.append(M.year >= f.year_from)
    if f.year_to is not None:
        conds.append(M.year <= f.year_to)
    if f.min_rating is not None:
        conds.append(M.rating >= f.min_rating)
    if f.max_rating is not None:
        conds.append(M.rating <= f.max_rating)
    if f.watched is not None:
        conds.append(M.is_watched == f.watched)
    return conds


def list_movies(db: Session, f: schemas.MovieFilter) -> schemas.MoviePage:
    conds = _movie_conditions(f)
    total = db.scalar(select(func.count(M.id)).where(*conds))

    column = SORT_COLUMNS[f.sort_by]
    order = column.desc() if f.order == "desc" else column.asc()
    stmt = (
        select(M)
        .options(joinedload(M.genre))
        .where(*conds)
        .order_by(order, M.id)
        .offset((f.page - 1) * f.size)
        .limit(f.size)
    )
    return schemas.MoviePage(
        items=[schemas.MovieOut.model_validate(m) for m in db.scalars(stmt).all()],
        total=total,
        page=f.page,
        size=f.size,
        pages=math.ceil(total / f.size) if total else 0,
    )


def top_movies(db: Session, limit: int, genre_id: int | None) -> list[models.Movie]:
    stmt = select(M).options(joinedload(M.genre))
    if genre_id is not None:
        stmt = stmt.where(M.genre_id == genre_id)
    stmt = stmt.order_by(M.rating.desc(), M.year.desc(), M.id).limit(limit)
    return list(db.scalars(stmt).all())


def get_movie_or_404(db: Session, movie_id: int) -> models.Movie:
    movie = db.get(M, movie_id, options=[joinedload(M.genre)])
    if movie is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Фильм с id={movie_id} не найден")
    return movie


def _check_movie(db: Session, title: str, year: int, genre_id: int,
                 exclude_id: int | None = None):
    if db.get(G, genre_id) is None:
        raise _validation_error("genre_id", f"Жанр с id={genre_id} не существует")
    stmt = select(M.id).where(func.py_lower(M.title) == norm(title), M.year == year)
    if exclude_id is not None:
        stmt = stmt.where(M.id != exclude_id)
    if db.scalar(stmt) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f"Фильм «{title}» ({year}) уже есть в фильмотеке")


def _commit(db: Session):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Нарушено ограничение целостности данных")


def create_movie(db: Session, data: schemas.MovieCreate) -> models.Movie:
    _check_movie(db, data.title, data.year, data.genre_id)
    movie = M(**data.model_dump())
    db.add(movie)
    _commit(db)
    return get_movie_or_404(db, movie.id)


def update_movie(db: Session, movie_id: int, data: schemas.MovieUpdate) -> models.Movie:
    movie = get_movie_or_404(db, movie_id)
    _check_movie(db, data.title, data.year, data.genre_id, exclude_id=movie_id)
    for field, value in data.model_dump().items():
        setattr(movie, field, value)
    _commit(db)
    db.refresh(movie)
    return movie


def patch_movie(db: Session, movie_id: int, data: schemas.MoviePatch) -> models.Movie:
    movie = get_movie_or_404(db, movie_id)
    changes = data.model_dump(exclude_unset=True)
    for key, value in changes.items():
        if value is None:
            raise _validation_error(key, "Поле не может быть null")
    if {"title", "year", "genre_id"} & changes.keys():
        _check_movie(db, changes.get("title", movie.title), changes.get("year", movie.year),
                     changes.get("genre_id", movie.genre_id), exclude_id=movie_id)
    if "rating" in changes:
        changes["rating"] = round(changes["rating"], 1)
    for field, value in changes.items():
        setattr(movie, field, value)
    _commit(db)
    db.refresh(movie)
    return movie


def delete_movie(db: Session, movie_id: int) -> None:
    db.delete(get_movie_or_404(db, movie_id))
    db.commit()


# ====================================================================== агрегация


def _r(value, digits=2):
    return round(value, digits) if value is not None else None


def library_stats(db: Session) -> schemas.LibraryStats:
    row = db.execute(select(
        func.count(M.id),
        func.count(case((M.is_watched, 1))),
        func.avg(M.rating),
        func.min(M.year),
        func.max(M.year),
        func.coalesce(func.sum(M.duration), 0),
    )).one()

    by_genre = db.execute(
        select(G.id, G.name, func.count(M.id), func.avg(M.rating), func.max(M.rating))
        .outerjoin(M)
        .group_by(G.id)
        .order_by(func.count(M.id).desc(), G.id)
    ).all()

    decade = ((M.year // 10) * 10).label("decade")  # целочисленное деление
    by_decade = db.execute(
        select(decade, func.count(M.id), func.avg(M.rating)).group_by(decade).order_by(decade)
    ).all()

    return schemas.LibraryStats(
        total_movies=row[0],
        watched_movies=row[1],
        avg_rating=_r(row[2]),
        min_year=row[3],
        max_year=row[4],
        total_duration=row[5],
        by_genre=[
            schemas.GenreStats(genre_id=gid, genre_name=name, movies_count=cnt,
                               avg_rating=_r(avg), max_rating=mx)
            for gid, name, cnt, avg, mx in by_genre
        ],
        by_decade=[
            schemas.DecadeStats(decade=int(d), movies_count=cnt, avg_rating=_r(avg))
            for d, cnt, avg in by_decade
        ],
    )
