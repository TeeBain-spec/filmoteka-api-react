"""Точка входа REST API «Фильмотека» (вариант 5).

Запуск:        uvicorn app.main:app --reload
Документация:  http://127.0.0.1:8000/docs (Swagger UI),  http://127.0.0.1:8000/redoc (ReDoc)
"""
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse

from .database import Base, SessionLocal, engine
from .routers import genres, movies, stats
from .seed import seed_if_empty


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)  # создаём таблицы, если их нет
    with SessionLocal() as db:
        seed_if_empty(db)  # стартовые данные
    yield


app = FastAPI(
    title="Movie Library API",
    description=(
        "REST API фильмотеки (вариант 5).\n\n"
        "Фильмы и жанры: CRUD-операции, поиск по названию, фильтры по году и рейтингу, "
        "сортировка, пагинация, топ по рейтингу и статистика."
    ),
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=[
        {"name": "Фильмы", "description": "Основная сущность"},
        {"name": "Жанры", "description": "Справочник жанров"},
        {"name": "Статистика", "description": "Агрегированные данные"},
    ],
)

# CORS: разрешаем запросы с фронтенда (Vite dev-сервер по умолчанию на порту 5173)
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o.strip()],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)

app.include_router(movies.router)
app.include_router(genres.router)
app.include_router(stats.router)

# ---------------------------------------------------------------------------
# Онлайн-демо: если рядом лежит собранный React (frontend/dist), FastAPI отдаёт
# его сам — приложение, API и Swagger работают по одному адресу.
# Локально (без сборки) корень просто перенаправляет на /docs.
# ---------------------------------------------------------------------------
STATIC_DIR = Path(os.getenv("FRONTEND_DIST", Path(__file__).resolve().parents[2] / "frontend" / "dist"))
INDEX_HTML = STATIC_DIR / "index.html"
API_PREFIXES = ("api/", "docs", "redoc", "openapi.json")


@app.get("/", include_in_schema=False)
def root():
    if INDEX_HTML.is_file():
        return FileResponse(INDEX_HTML)
    return RedirectResponse(url="/docs")


@app.get("/{full_path:path}", include_in_schema=False)
def spa(full_path: str):
    """Файлы сборки React + маршруты SPA (/search, /movies/5 …) → index.html."""
    if not INDEX_HTML.is_file() or full_path.startswith(API_PREFIXES):
        raise HTTPException(status_code=404, detail="Not Found")
    file = (STATIC_DIR / full_path).resolve()
    if file.is_file() and STATIC_DIR.resolve() in file.parents:
        return FileResponse(file)
    return FileResponse(INDEX_HTML)
