"""Настройки из переменных окружения.

Локально их удобно положить в файл backend/.env (он в .gitignore, в репозиторий не попадает):

    KINOPOISK_API_KEY=ваш-ключ

На Render переменные задаются в разделе Environment у сервиса.
"""
import os
from pathlib import Path


def _load_dotenv(path: Path) -> None:
    """Минимальная загрузка .env: строки KEY=VALUE, уже заданные переменные не перезаписываются."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./movies.db")

# Кинопоиск: неофициальный API «ПоискКино» (бывший kinopoisk.dev), ключ — в Telegram @poiskkinodev_bot
KINOPOISK_API_KEY = os.getenv("KINOPOISK_API_KEY", "").strip()
KINOPOISK_API_URL = os.getenv("KINOPOISK_API_URL", "https://api.poiskkino.dev").rstrip("/")
# Сколько фильмов из топ-250 Кинопоиска загрузить в пустую базу при старте (0 — не загружать)
KINOPOISK_SEED_TOP = int(os.getenv("KINOPOISK_SEED_TOP", "100"))
