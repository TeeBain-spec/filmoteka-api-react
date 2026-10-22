"""ORM-модели (таблицы базы данных)."""
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Genre(Base):
    __tablename__ = "genres"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(300), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    movies: Mapped[list["Movie"]] = relationship(back_populates="genre")


class Movie(Base):
    __tablename__ = "movies"
    __table_args__ = (
        UniqueConstraint("title", "year", name="uq_movie_title_year"),
        CheckConstraint("rating >= 0 AND rating <= 10", name="ck_movie_rating"),
        CheckConstraint("year >= 1888", name="ck_movie_year"),
        CheckConstraint("duration > 0", name="ck_movie_duration"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(1000), default="", nullable=False)
    director: Mapped[str] = mapped_column(String(100), nullable=False)
    country: Mapped[str] = mapped_column(String(60), default="", nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    rating: Mapped[float] = mapped_column(Float, nullable=False, index=True)  # 0–10
    duration: Mapped[int] = mapped_column(Integer, nullable=False)  # минуты
    is_watched: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    poster_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)  # обложка
    genre_id: Mapped[int] = mapped_column(
        ForeignKey("genres.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    genre: Mapped[Genre] = relationship(back_populates="movies")

    @property
    def genre_name(self) -> str:
        return self.genre.name if self.genre else ""
