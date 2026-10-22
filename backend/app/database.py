"""Подключение к базе данных SQLite через SQLAlchemy 2.0."""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


@event.listens_for(engine, "connect")
def _on_connect(dbapi_conn, _record):
    # включаем проверку внешних ключей (в SQLite она по умолчанию выключена)
    dbapi_conn.execute("PRAGMA foreign_keys = ON")
    # встроенная LOWER() в SQLite понимает только латиницу,
    # поэтому регистрируем свою функцию для регистронезависимого поиска по-русски
    dbapi_conn.create_function(
        "py_lower", 1, lambda s: norm(s) if isinstance(s, str) else s, deterministic=True
    )


def norm(text: str) -> str:
    """Нормализация для поиска и сравнения: нижний регистр, «ё» = «е»
    («Зеленая миля» с Кинопоиска совпадёт с «Зелёной милей»)."""
    return text.lower().replace("ё", "е")


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """Зависимость FastAPI: одна сессия БД на запрос."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
