"""Автотесты REST API фильмотеки (pytest + TestClient)."""

NEW_MOVIE = {
    "title": "Оппенгеймер",
    "description": "История создателя атомной бомбы",
    "director": "Кристофер Нолан",
    "country": "США",
    "year": 2023,
    "rating": 8.1,
    "duration": 180,
    "is_watched": False,
    "genre_id": 1,
}
TOTAL = 21  # фильмов в стартовых данных


# ------------------------------------------------------------------ жанры
def test_list_genres(client):
    data = client.get("/api/genres").json()
    assert len(data) == 7
    assert data[0]["name"] == "Драма" and data[0]["movies_count"] == 4


def test_genre_crud(client):
    r = client.post("/api/genres", json={"name": "Документальный", "description": "Нон-фикшн"})
    assert r.status_code == 201
    gid = r.json()["id"]
    assert client.get(f"/api/genres/{gid}").json()["name"] == "Документальный"

    r = client.put(f"/api/genres/{gid}", json={"name": "Документалистика", "description": ""})
    assert r.status_code == 200 and r.json()["name"] == "Документалистика"

    assert client.delete(f"/api/genres/{gid}").status_code == 204
    assert client.get(f"/api/genres/{gid}").status_code == 404


def test_genre_duplicate_name(client):
    assert client.post("/api/genres", json={"name": "драма"}).status_code == 409


def test_cannot_delete_genre_with_movies(client):
    assert client.delete("/api/genres/1").status_code == 409


def test_genre_movies(client):
    r = client.get("/api/genres/7/movies")
    titles = [m["title"] for m in r.json()["items"]]
    assert titles == ["Король Лев", "Унесённые призраками", "ВАЛЛ·И"]  # по рейтингу


# ------------------------------------------------------------------ фильмы: CRUD
def test_movie_crud(client):
    r = client.post("/api/movies", json=NEW_MOVIE)
    assert r.status_code == 201
    movie = r.json()
    assert movie["genre_name"] == "Драма"

    assert client.get(f"/api/movies/{movie['id']}").json()["title"] == "Оппенгеймер"

    r = client.put(f"/api/movies/{movie['id']}", json={**NEW_MOVIE, "rating": 8.4})
    assert r.status_code == 200 and r.json()["rating"] == 8.4

    r = client.patch(f"/api/movies/{movie['id']}", json={"is_watched": True})
    assert r.status_code == 200 and r.json()["is_watched"] is True

    assert client.delete(f"/api/movies/{movie['id']}").status_code == 204
    assert client.get(f"/api/movies/{movie['id']}").status_code == 404


def test_movie_duplicate(client):
    dup = {**NEW_MOVIE, "title": "матрица", "year": 1999}
    assert client.post("/api/movies", json=dup).status_code == 409


def test_not_found(client):
    assert client.get("/api/movies/9999").status_code == 404
    assert client.delete("/api/movies/9999").status_code == 404


# ------------------------------------------------------------------ валидация
def test_validation_errors(client):
    bad = {**NEW_MOVIE, "title": "", "rating": 11, "year": 1500, "duration": 0}
    r = client.post("/api/movies", json=bad)
    assert r.status_code == 422
    fields = {e["loc"][-1] for e in r.json()["detail"]}
    assert {"title", "rating", "year", "duration"} <= fields


def test_missing_required(client):
    r = client.post("/api/movies", json={"title": "Без режиссёра"})
    assert r.status_code == 422


def test_unknown_genre(client):
    r = client.post("/api/movies", json={**NEW_MOVIE, "genre_id": 999})
    assert r.status_code == 422
    assert r.json()["detail"][0]["loc"] == ["body", "genre_id"]


def test_extra_field_forbidden(client):
    assert client.post("/api/movies", json={**NEW_MOVIE, "budget": 100}).status_code == 422


def test_empty_patch(client):
    assert client.patch("/api/movies/1", json={}).status_code == 422


def test_bad_ranges(client):
    assert client.get("/api/movies", params={"year_from": 2010, "year_to": 2000}).status_code == 422
    assert client.get("/api/movies", params={"min_rating": 9, "max_rating": 5}).status_code == 422


# ------------------------------------------------------------------ поиск / фильтры
def test_search_by_title_case_insensitive(client):
    r = client.get("/api/movies", params={"q": "МАТРИ"})
    assert [m["title"] for m in r.json()["items"]] == ["Матрица"]


def test_filter_by_year(client):
    r = client.get("/api/movies", params={"year_from": 1990, "year_to": 1999, "size": 100})
    years = [m["year"] for m in r.json()["items"]]
    assert years and all(1990 <= y <= 1999 for y in years)
    assert r.json()["total"] == 8


def test_filter_by_rating(client):
    r = client.get("/api/movies", params={"min_rating": 8.8, "size": 100})
    titles = {m["title"] for m in r.json()["items"]}
    assert titles == {"Побег из Шоушенка", "Зелёная миля", "Форрест Гамп",
                      "Иван Васильевич меняет профессию", "1+1", "Король Лев"}


def test_combined_filters(client):
    r = client.get("/api/movies", params={
        "genre_id": 3, "year_from": 2000, "min_rating": 8, "watched": "false",
    })
    assert [m["title"] for m in r.json()["items"]] == ["Начало"]


# ------------------------------------------------------------------ сортировка / пагинация
def test_sorting(client):
    r = client.get("/api/movies", params={"sort_by": "year", "order": "desc", "size": 3})
    years = [m["year"] for m in r.json()["items"]]
    assert years == [2021, 2015, 2014]


def test_pagination(client):
    body = client.get("/api/movies", params={"page": 3, "size": 5}).json()
    assert body["total"] == TOTAL and body["pages"] == 5
    assert body["page"] == 3 and len(body["items"]) == 5
    assert body["items"][0]["id"] == 11


def test_bad_sort_field(client):
    assert client.get("/api/movies", params={"sort_by": "budget"}).status_code == 422


def test_top(client):
    top = client.get("/api/movies/top", params={"limit": 3}).json()
    assert [m["rating"] for m in top] == [9.1, 9.1, 8.9]


# ------------------------------------------------------------------ агрегация / CORS
def test_stats(client):
    s = client.get("/api/stats").json()
    assert s["total_movies"] == TOTAL
    assert s["watched_movies"] == 11
    assert s["min_year"] == 1968 and s["max_year"] == 2021
    assert sum(g["movies_count"] for g in s["by_genre"]) == TOTAL
    assert {d["decade"] for d in s["by_decade"]} == {1960, 1970, 1990, 2000, 2010, 2020}


def test_cors_preflight(client):
    r = client.options("/api/movies", headers={
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173"
