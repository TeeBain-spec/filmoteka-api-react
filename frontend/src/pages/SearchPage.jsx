// Экран 3. Поиск по названию и фильтры по году и рейтингу (параметры хранятся в URL)
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { errorMessage, getGenres, getMovies } from '../api/client.js'
import Pagination from '../components/Pagination.jsx'
import RatingBadge from '../components/RatingBadge.jsx'
import { formatDuration, genreIcon } from '../utils.js'

const FILTER_KEYS = ['q', 'genre_id', 'year_from', 'year_to', 'min_rating', 'max_rating', 'watched']
const SORTS = [
  ['rating:desc', 'Рейтинг ↓'],
  ['rating:asc', 'Рейтинг ↑'],
  ['year:desc', 'Год: сначала новые'],
  ['year:asc', 'Год: сначала старые'],
  ['title:asc', 'Название: А → Я'],
  ['duration:asc', 'Длительность ↑'],
]

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']))
  const sort = `${params.get('sort_by') || 'rating'}:${params.get('order') || 'desc'}`
  const page = Number(params.get('page') || 1)

  const [genres, setGenres] = useState([])
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState(filters.q)

  useEffect(() => {
    getGenres().then(setGenres).catch(() => {})
  }, [])

  // запрос с задержкой 300 мс после окончания ввода, чтобы не дёргать API на каждую букву
  useEffect(() => {
    if (query === filters.q) return
    const t = setTimeout(() => setParam('q', query), 300)
    return () => clearTimeout(t)
  }, [query]) // eslint-disable-line react-hooks/exhaustive-deps

  const paramsKey = params.toString()
  useEffect(() => {
    setError('')
    const [sortBy, order] = sort.split(':')
    getMovies({ ...filters, sort_by: sortBy, order, page, size: 8 })
      .then(setData)
      .catch((e) => setError(errorMessage(e)))
  }, [paramsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function setParam(key, value) {
    const next = new URLSearchParams(params)
    if (value === '' || value === null) next.delete(key)
    else next.set(key, value)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  const setSort = (value) => {
    const [sortBy, order] = value.split(':')
    const next = new URLSearchParams(params)
    next.set('sort_by', sortBy)
    next.set('order', order)
    next.delete('page')
    setParams(next)
  }

  const reset = () => {
    setQuery('')
    setParams({})
  }

  const activeCount = FILTER_KEYS.filter((k) => filters[k]).length

  return (
    <>
      <h1 className="page-title h3 mb-3">Поиск фильмов</h1>
      <div className="row g-4">
        {/* ---- панель фильтров */}
        <aside className="col-lg-3">
          <div className="card card-body filters">
            <label className="form-label fw-semibold" htmlFor="q">Название</label>
            <div className="input-group mb-3">
              <span className="input-group-text"><i className="bi bi-search" /></span>
              <input id="q" className="form-control" placeholder="Например, матрица"
                     value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>

            <span className="form-label fw-semibold d-block">Год выпуска</span>
            <div className="d-flex gap-2 mb-3">
              <input className="form-control" type="number" placeholder="с" aria-label="Год с"
                     value={filters.year_from} onChange={(e) => setParam('year_from', e.target.value)} />
              <input className="form-control" type="number" placeholder="по" aria-label="Год по"
                     value={filters.year_to} onChange={(e) => setParam('year_to', e.target.value)} />
            </div>

            <span className="form-label fw-semibold d-block">Рейтинг</span>
            <div className="d-flex gap-2 mb-3">
              <input className="form-control" type="number" step="0.1" min="0" max="10"
                     placeholder="от" aria-label="Рейтинг от" value={filters.min_rating}
                     onChange={(e) => setParam('min_rating', e.target.value)} />
              <input className="form-control" type="number" step="0.1" min="0" max="10"
                     placeholder="до" aria-label="Рейтинг до" value={filters.max_rating}
                     onChange={(e) => setParam('max_rating', e.target.value)} />
            </div>

            <label className="form-label fw-semibold" htmlFor="genre">Жанр</label>
            <select id="genre" className="form-select mb-3" value={filters.genre_id}
                    onChange={(e) => setParam('genre_id', e.target.value)}>
              <option value="">Все жанры</option>
              {genres.map((g) => (
                <option key={g.id} value={g.id}>{genreIcon(g.name)} {g.name}</option>
              ))}
            </select>

            <label className="form-label fw-semibold" htmlFor="watched">Статус</label>
            <select id="watched" className="form-select mb-3" value={filters.watched}
                    onChange={(e) => setParam('watched', e.target.value)}>
              <option value="">Все</option>
              <option value="true">Просмотренные</option>
              <option value="false">Не просмотренные</option>
            </select>

            <label className="form-label fw-semibold" htmlFor="sort">Сортировка</label>
            <select id="sort" className="form-select mb-3" value={sort}
                    onChange={(e) => setSort(e.target.value)}>
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>

            <button className="btn btn-outline-secondary btn-sm" onClick={reset}
                    disabled={!paramsKey}>
              <i className="bi bi-x-circle me-1" /> Сбросить фильтры
            </button>
          </div>
        </aside>

        {/* ---- результаты */}
        <section className="col-lg-9">
          {error && <div className="alert alert-danger">{error}</div>}
          {data && (
            <p className="text-secondary mb-3">
              Найдено: <b>{data.total}</b>
              {activeCount > 0 && <> · активных фильтров: {activeCount}</>}
            </p>
          )}

          <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-4 g-3">
            {data?.items.map((m) => (
              <div className="col" key={m.id}>
                <Link to={`/movies/${m.id}`} className="text-reset text-decoration-none">
                  <div className="card h-100 movie-card">
                    <div className="card-body d-flex flex-column">
                      <div className="poster mb-3">{genreIcon(m.genre_name)}</div>
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <h2 className="h6 fw-bold mb-1">{m.title}</h2>
                        <RatingBadge rating={m.rating} />
                      </div>
                      <div className="small text-secondary">
                        {m.year} · {m.genre_name} · {formatDuration(m.duration)}
                      </div>
                      <div className="small text-secondary mt-auto pt-2">
                        {m.is_watched
                          ? <><i className="bi bi-check2-circle text-success" /> просмотрен</>
                          : <><i className="bi bi-bookmark" /> посмотреть</>}
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>

          {data && data.items.length === 0 && (
            <div className="text-center text-secondary py-5">
              <div className="fs-1">🔍</div>
              Ничего не найдено. Попробуйте изменить условия поиска.
            </div>
          )}

          {data && (
            <div className="mt-4">
              <Pagination page={page} pages={data.pages} onChange={(p) => setParam('page', p)} />
            </div>
          )}
        </section>
      </div>
    </>
  )
}
