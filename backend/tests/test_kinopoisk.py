"""Тесты интеграции с Кинопоиском. Внешний API подменяется (monkeypatch),
поэтому тесты не тратят суточный лимит и работают без интернета."""
import pytest

from app import config, kinopoisk

GREEN_MILE = {  # уже есть в стартовых данных как «Зелёная миля» (с «ё»)
    "id": 435, "name": "Зеленая миля", "year": 1999, "movieLength": 189, "type": "movie",
    "rating": {"kp": 9.08, "imdb": 8.6}, "genres": [{"name": "драма"}, {"name": "криминал"}],
    "countries": [{"name": "США"}], "description": "Пол Эджкомб — начальник блока смертников.",
    "persons": [{"name": "Фрэнк Дарабонт", "enProfession": "director"},
                {"name": "Том Хэнкс", "enProfession": "actor"}],
    "poster": {"previewUrl": "https://img.example/435.jpg"},
}
OPPENHEIMER = {
    "id": 4664634, "name": "Оппенгеймер", "year": 2023, "movieLength": 180, "type": "movie",
    "rating": {"kp": 8.06}, "genres": [{"name": "биография"}, {"name": "драма"}],
    "countries": [{"name": "США"}, {"name": "Великобритания"}, {"name": "Франция"}],
    "persons": [{"name": "Кристофер Нолан", "enProfession": "director"}],
    "poster": {"previewUrl": "https://img.example/4664634.jpg"}, "description": "История физика.",
}
ANIME = {
    "id": 777, "name": "Тестовое аниме", "year": 2004, "movieLength": 119, "type": "anime",
    "rating": {"kp": 8.2}, "genres": [{"name": "аниме"}], "countries": [{"name": "Япония"}],
    "persons": [], "poster": {},
}
NO_LENGTH = {"id": 9, "name": "Без длительности", "year": 2020, "rating": {"kp": 7.0},
             "genres": [{"name": "драма"}]}
DOCS = {d["id"]: d for d in (GREEN_MILE, OPPENHEIMER, ANIME, NO_LENGTH)}


@pytest.fixture()
def kp(monkeypatch):
    """Включает импорт с фиктивным ключом и подменяет HTTP-запросы к Кинопоиску."""
    calls = []

    def fake_get(path, params=None):
        calls.append(path)
        if path == "/v1.4/movie/search":
            return {"docs": [GREEN_MILE, OPPENHEIMER], "total": 2, "page": 1, "pages": 1}
        if path == "/v1.4/movie":
            limit = int(dict(params)["limit"])
            return {"docs": [GREEN_MILE, OPPENHEIMER, NO_LENGTH][:limit]}
        kp_id = int(path.rsplit("/", 1)[-1])
        if kp_id not in DOCS:
            raise kinopoisk.KinopoiskError(404, "Фильм на Кинопоиске не найден")
        return DOCS[kp_id]

    monkeypatch.setattr(config, "KINOPOISK_API_KEY", "test-key")
    monkeypatch.setattr(kinopoisk, "_get", fake_get)
    return calls


def test_disabled_without_key(client):
    assert client.get("/api/kinopoisk/status").json()["enabled"] is False
    r = client.get("/api/kinopoisk/search", params={"q": "матрица"})
    assert r.status_code == 503 and "KINOPOISK_API_KEY" in r.json()["detail"]


def test_search_marks_existing(client, kp):
    items = client.get("/api/kinopoisk/search", params={"q": "миля"}).json()["items"]
    green, opp = items
    assert green["movie_id"] == 2  # «Зеленая» с Кинопоиска = наша «Зелёная миля»
    assert opp["movie_id"] is None and opp["rating"] == 8.1 and opp["genres"] == ["биография", "драма"]


def test_import_movie(client, kp):
    r = client.post("/api/kinopoisk/import/4664634")
    assert r.status_code == 201
    m = r.json()
    assert m["title"] == "Оппенгеймер" and m["kp_id"] == 4664634
    assert m["director"] == "Кристофер Нолан" and m["country"] == "США, Великобритания"
    assert m["genre_name"] == "Драма"  # «биографии» у нас нет — взят следующий жанр
    assert m["poster_url"] == "https://img.example/4664634.jpg" and m["rating"] == 8.1
    assert client.post("/api/kinopoisk/import/4664634").status_code == 409


def test_import_links_existing_seed_movie(client, kp):
    r = client.post("/api/kinopoisk/import/435")
    assert r.status_code == 409
    assert client.get("/api/movies/2").json()["kp_id"] == 435


def test_import_creates_genre(client, kp):
    m = client.post("/api/kinopoisk/import/777").json()
    assert m["genre_name"] == "Аниме" and m["director"] == "Неизвестно"
    assert any(g["name"] == "Аниме" for g in client.get("/api/genres").json())


def test_import_errors(client, kp):
    assert client.post("/api/kinopoisk/import/9").status_code == 422  # нет длительности
    assert client.post("/api/kinopoisk/import/123").status_code == 404


def test_import_top(client, kp):
    r = client.post("/api/kinopoisk/import-top", params={"limit": 3})
    assert r.json() == {"imported": 1, "skipped": 2, "total": 22}
    assert kp.count("/v1.4/movie") == 1  # весь топ — одним запросом


def test_search_yo_insensitive(client):
    r = client.get("/api/movies", params={"q": "зеленая"})
    assert [m["title"] for m in r.json()["items"]] == ["Зелёная миля"]
