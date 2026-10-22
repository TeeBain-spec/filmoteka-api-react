"""Эндпоинты жанров."""
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/api/genres", tags=["Жанры"])

DB = Annotated[Session, Depends(get_db)]
GenreId = Annotated[int, Path(gt=0, description="ID жанра")]
NOT_FOUND = {404: {"model": schemas.Message, "description": "Жанр не найден"}}
CONFLICT = {409: {"model": schemas.Message, "description": "Конфликт данных"}}


@router.get("", response_model=list[schemas.GenreOut], summary="Список жанров")
def list_genres(db: DB):
    """Все жанры с количеством фильмов в каждом."""
    return crud.list_genres(db)


@router.get("/{genre_id}", response_model=schemas.GenreOut, responses=NOT_FOUND,
            summary="Жанр по ID")
def get_genre(genre_id: GenreId, db: DB):
    return crud.get_genre(db, genre_id)


@router.post("", response_model=schemas.GenreOut, status_code=status.HTTP_201_CREATED,
             responses=CONFLICT, summary="Создать жанр")
def create_genre(data: schemas.GenreCreate, db: DB):
    return crud.create_genre(db, data)


@router.put("/{genre_id}", response_model=schemas.GenreOut,
            responses={**NOT_FOUND, **CONFLICT}, summary="Обновить жанр")
def update_genre(genre_id: GenreId, data: schemas.GenreUpdate, db: DB):
    return crud.update_genre(db, genre_id, data)


@router.delete("/{genre_id}", status_code=status.HTTP_204_NO_CONTENT,
               responses={**NOT_FOUND, **CONFLICT}, summary="Удалить жанр")
def delete_genre(genre_id: GenreId, db: DB):
    """Удалить можно только жанр, к которому не относится ни один фильм."""
    crud.delete_genre(db, genre_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{genre_id}/movies", response_model=schemas.MoviePage, responses=NOT_FOUND,
            summary="Фильмы жанра")
def genre_movies(
    genre_id: GenreId,
    db: DB,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """Фильмы выбранного жанра, отсортированные по рейтингу."""
    crud.get_genre_or_404(db, genre_id)
    return crud.list_movies(db, schemas.MovieFilter(
        genre_id=genre_id, page=page, size=size, sort_by="rating", order="desc",
    ))
