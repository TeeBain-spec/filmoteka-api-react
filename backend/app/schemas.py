"""Pydantic-схемы: валидация входных данных и формат ответов API."""
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MIN_YEAR = 1888  # «Сцена в саду Раундхэй» — первый сохранившийся фильм


def max_year() -> int:
    return date.today().year + 5  # разрешаем анонсированные фильмы


class _Input(BaseModel):
    # обрезаем пробелы по краям строк и запрещаем неизвестные поля
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


# ------------------------------------------------------------------ жанры
class GenreCreate(_Input):
    name: str = Field(..., min_length=2, max_length=50, description="Название жанра",
                      examples=["Фантастика"])
    description: str = Field("", max_length=300, description="Описание",
                             examples=["Космос, будущее, технологии"])


class GenreUpdate(GenreCreate):
    """Полное обновление жанра (PUT)."""


class GenreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    movies_count: int = Field(0, description="Количество фильмов жанра")
    created_at: datetime


# ------------------------------------------------------------------ фильмы
def _check_year(value):
    if value is not None and not (MIN_YEAR <= value <= max_year()):
        raise ValueError(f"Год должен быть в диапазоне {MIN_YEAR}–{max_year()}")
    return value


class MovieBase(_Input):
    title: str = Field(..., min_length=1, max_length=200, description="Название",
                       examples=["Интерстеллар"])
    description: str = Field("", max_length=1000, description="Краткое описание",
                             examples=["Экспедиция сквозь червоточину в поисках нового дома"])
    director: str = Field(..., min_length=2, max_length=100, description="Режиссёр",
                          examples=["Кристофер Нолан"])
    country: str = Field("", max_length=60, description="Страна", examples=["США"])
    year: int = Field(..., description="Год выпуска", examples=[2014])
    rating: float = Field(..., ge=0, le=10, description="Рейтинг 0–10", examples=[8.7])
    duration: int = Field(..., gt=0, le=1000, description="Длительность, мин", examples=[169])
    is_watched: bool = Field(False, description="Просмотрен")
    genre_id: int = Field(..., gt=0, description="ID жанра", examples=[3])

    validate_year = field_validator("year")(_check_year)

    @field_validator("rating")
    @classmethod
    def _round_rating(cls, v: float) -> float:
        return round(v, 1)


class MovieCreate(MovieBase):
    """Добавление фильма (POST)."""


class MovieUpdate(MovieBase):
    """Полное обновление фильма (PUT): передаются все поля."""


class MoviePatch(_Input):
    """Частичное обновление (PATCH): передаются только изменяемые поля."""

    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    director: Optional[str] = Field(None, min_length=2, max_length=100)
    country: Optional[str] = Field(None, max_length=60)
    year: Optional[int] = None
    rating: Optional[float] = Field(None, ge=0, le=10)
    duration: Optional[int] = Field(None, gt=0, le=1000)
    is_watched: Optional[bool] = None
    genre_id: Optional[int] = Field(None, gt=0)

    validate_year = field_validator("year")(_check_year)

    @model_validator(mode="after")
    def _not_empty(self):
        if not self.model_fields_set:
            raise ValueError("Нужно передать хотя бы одно поле для изменения")
        return self


class MovieOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    director: str
    country: str
    year: int
    rating: float
    duration: int
    is_watched: bool
    genre_id: int
    genre_name: str
    created_at: datetime
    updated_at: datetime


SortField = Literal["id", "title", "year", "rating", "duration", "created_at"]


class MovieFilter(BaseModel):
    """Query-параметры списка фильмов: поиск, фильтры, сортировка, пагинация."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    q: Optional[str] = Field(None, max_length=100, description="Поиск по названию")
    genre_id: Optional[int] = Field(None, gt=0, description="Фильтр по жанру")
    year_from: Optional[int] = Field(None, ge=MIN_YEAR, description="Год от")
    year_to: Optional[int] = Field(None, ge=MIN_YEAR, description="Год до")
    min_rating: Optional[float] = Field(None, ge=0, le=10, description="Рейтинг от")
    max_rating: Optional[float] = Field(None, ge=0, le=10, description="Рейтинг до")
    watched: Optional[bool] = Field(None, description="true — просмотренные, false — нет")
    sort_by: SortField = Field("id", description="Поле сортировки")
    order: Literal["asc", "desc"] = Field("asc", description="Направление сортировки")
    page: int = Field(1, ge=1, description="Номер страницы")
    size: int = Field(10, ge=1, le=100, description="Записей на странице (1–100)")

    @model_validator(mode="after")
    def _ranges(self):
        if self.year_from and self.year_to and self.year_from > self.year_to:
            raise ValueError("year_from не может быть больше year_to")
        if (self.min_rating is not None and self.max_rating is not None
                and self.min_rating > self.max_rating):
            raise ValueError("min_rating не может быть больше max_rating")
        return self


class MoviePage(BaseModel):
    items: list[MovieOut]
    total: int = Field(..., description="Всего найдено записей")
    page: int
    size: int
    pages: int = Field(..., description="Всего страниц")


# ------------------------------------------------------------------ статистика
class GenreStats(BaseModel):
    genre_id: int
    genre_name: str
    movies_count: int
    avg_rating: Optional[float]
    max_rating: Optional[float]


class DecadeStats(BaseModel):
    decade: int = Field(..., description="Десятилетие, например 1990")
    movies_count: int
    avg_rating: float


class LibraryStats(BaseModel):
    total_movies: int
    watched_movies: int
    avg_rating: Optional[float]
    min_year: Optional[int]
    max_year: Optional[int]
    total_duration: int = Field(..., description="Суммарная длительность, мин")
    by_genre: list[GenreStats]
    by_decade: list[DecadeStats]


class Message(BaseModel):
    detail: str
