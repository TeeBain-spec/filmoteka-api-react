"""Эндпоинты фильмов: CRUD, поиск, фильтрация, сортировка, пагинация."""
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/api/movies", tags=["Фильмы"])

DB = Annotated[Session, Depends(get_db)]
MovieId = Annotated[int, Path(gt=0, description="ID фильма")]
NOT_FOUND = {404: {"model": schemas.Message, "description": "Фильм не найден"}}
CONFLICT = {409: {"model": schemas.Message, "description": "Такой фильм уже есть"}}


@router.get("", response_model=schemas.MoviePage, summary="Список фильмов с фильтрами")
def list_movies(filters: Annotated[schemas.MovieFilter, Query()], db: DB):
    """
    Возвращает страницу фильмов.

    * **поиск по названию** — `q` (без учёта регистра);
    * **фильтр по году** — `year_from`, `year_to`;
    * **фильтр по рейтингу** — `min_rating`, `max_rating`;
    * прочие фильтры — `genre_id`, `watched`;
    * **сортировка** — `sort_by` (`id`, `title`, `year`, `rating`, `duration`, `created_at`)
      и `order` (`asc` / `desc`);
    * **пагинация** — `page`, `size`.
    """
    return crud.list_movies(db, filters)


@router.get("/top", response_model=list[schemas.MovieOut], summary="Топ фильмов по рейтингу")
def top_movies(
    db: DB,
    limit: Annotated[int, Query(ge=1, le=50, description="Сколько фильмов вернуть")] = 5,
    genre_id: Annotated[Optional[int], Query(gt=0, description="Только этот жанр")] = None,
):
    return crud.top_movies(db, limit, genre_id)


@router.get("/{movie_id}", response_model=schemas.MovieOut, responses=NOT_FOUND,
            summary="Фильм по ID")
def get_movie(movie_id: MovieId, db: DB):
    return crud.get_movie_or_404(db, movie_id)


@router.post("", response_model=schemas.MovieOut, status_code=status.HTTP_201_CREATED,
             responses=CONFLICT, summary="Добавить фильм")
def create_movie(data: schemas.MovieCreate, db: DB):
    return crud.create_movie(db, data)


@router.put("/{movie_id}", response_model=schemas.MovieOut,
            responses={**NOT_FOUND, **CONFLICT}, summary="Обновить фильм целиком")
def update_movie(movie_id: MovieId, data: schemas.MovieUpdate, db: DB):
    return crud.update_movie(db, movie_id, data)


@router.patch("/{movie_id}", response_model=schemas.MovieOut,
              responses={**NOT_FOUND, **CONFLICT}, summary="Частично обновить фильм")
def patch_movie(movie_id: MovieId, data: schemas.MoviePatch, db: DB):
    """Например, `{"is_watched": true}` — отметить фильм просмотренным."""
    return crud.patch_movie(db, movie_id, data)


@router.delete("/{movie_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND,
               summary="Удалить фильм")
def delete_movie(movie_id: MovieId, db: DB):
    crud.delete_movie(db, movie_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
