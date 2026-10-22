// Импорт с Кинопоиска: поиск фильмов во внешнем API и добавление в фильмотеку
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage, kpImport, kpImportTop, kpSearch, kpStatus } from '../api/client.js'
import Pagination from '../components/Pagination.jsx'
import Poster from '../components/Poster.jsx'
import RatingBadge from '../components/RatingBadge.jsx'

const TYPES = {
  movie: 'Фильм', 'tv-series': 'Сериал', cartoon: 'Мультфильм',
  'animated-series': 'Мультсериал', anime: 'Аниме',
}

export default function ImportPage() {
  const [enabled, setEnabled] = useState(null) // null — ещё не знаем
  const [query, setQuery] = useState('')
  const [lastQuery, setLastQuery] = useState('')
  const [result, setResult] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState({}) // kp_id → true, пока идёт запрос
  const [added, setAdded] = useState({}) // kp_id → movie_id
  const [topLimit, setTopLimit] = useState(50)
  const [topBusy, setTopBusy] = useState(false)
  const [topResult, setTopResult] = useState(null)

  useEffect(() => {
    kpStatus().then((s) => setEnabled(s.enabled)).catch((e) => setError(errorMessage(e)))
  }, [])

  const search = async (q, p = 1) => {
    if (!q.trim()) return
    setLoading(true)
    setError('')
    try {
      setResult(await kpSearch(q.trim(), p))
      setLastQuery(q.trim())
      setPage(p)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const add = async (item) => {
    setAdding((a) => ({ ...a, [item.kp_id]: true }))
    setError('')
    try {
      const movie = await kpImport(item.kp_id)
      setAdded((a) => ({ ...a, [item.kp_id]: movie.id }))
    } catch (e) {
      setError(`«${item.title}»: ${errorMessage(e)}`)
    } finally {
      setAdding((a) => ({ ...a, [item.kp_id]: false }))
    }
  }

  const importTop = async () => {
    setTopBusy(true)
    setTopResult(null)
    setError('')
    try {
      setTopResult(await kpImportTop(topLimit))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setTopBusy(false)
    }
  }

  return (
    <>
      <h1 className="page-title h3 mb-1">Импорт с Кинопоиска</h1>
      <p className="text-secondary mb-3">
        Данные приходят из внешнего API «ПоискКино» через наш бэкенд — ключ хранится только на сервере.
      </p>

      {enabled === false && (
        <div className="alert alert-warning">
          <b>Импорт не настроен.</b> Задайте на сервере переменную окружения{' '}
          <code>KINOPOISK_API_KEY</code> (ключ выдаёт Telegram-бот @poiskkinodev_bot) и перезапустите
          бэкенд.
        </div>
      )}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-4">
        <div className="col-lg-8">
          <form className="card card-body mb-3"
                onSubmit={(e) => { e.preventDefault(); search(query) }}>
            <label className="form-label fw-semibold" htmlFor="kp-q">Найти фильм на Кинопоиске</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-search" /></span>
              <input id="kp-q" className="form-control" placeholder="Например, Дюна"
                     value={query} onChange={(e) => setQuery(e.target.value)} disabled={!enabled} />
              <button className="btn btn-primary" disabled={!enabled || loading || !query.trim()}>
                {loading ? 'Поиск…' : 'Найти'}
              </button>
            </div>
          </form>

          {result && (
            <p className="text-secondary">
              По запросу «{lastQuery}» на Кинопоиске найдено: <b>{result.total}</b>
            </p>
          )}

          <div className="row row-cols-1 row-cols-md-2 g-3">
            {result?.items.map((item) => {
              const movieId = added[item.kp_id] ?? item.movie_id
              return (
                <div className="col" key={item.kp_id}>
                  <div className="card h-100">
                    <div className="card-body d-flex gap-3">
                      <Poster url={item.poster_url} genre={item.genres[0]} title={item.title}
                              size="preview" className="kp-poster" />
                      <div className="d-flex flex-column flex-grow-1 min-w-0">
                        <h2 className="h6 fw-bold mb-1">{item.title}</h2>
                        {item.original_title && item.original_title !== item.title && (
                          <div className="small text-secondary text-truncate">{item.original_title}</div>
                        )}
                        <div className="small text-secondary mb-2">
                          {[TYPES[item.type] || item.type, item.year].filter(Boolean).join(', ')}
                        </div>
                        <div className="mb-2"><RatingBadge rating={item.rating} /></div>
                        <div className="small text-secondary mb-3">{item.genres.slice(0, 3).join(', ')}</div>
                        <div className="mt-auto">
                          {movieId ? (
                            <Link to={`/movies/${movieId}`} className="btn btn-sm btn-success">
                              <i className="bi bi-check2 me-1" /> В фильмотеке
                            </Link>
                          ) : !item.year ? (
                            <span className="small text-secondary">
                              Не указан год — импорт невозможен
                            </span>
                          ) : (
                            <button className="btn btn-sm btn-primary" disabled={adding[item.kp_id]}
                                    onClick={() => add(item)}>
                              <i className="bi bi-plus-lg me-1" />
                              {adding[item.kp_id] ? 'Добавляю…' : 'Добавить'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {result && result.items.length === 0 && (
            <div className="text-center text-secondary py-4">Ничего не найдено</div>
          )}
          {result && (
            <div className="mt-3">
              <Pagination page={page} pages={Math.min(result.pages, 10)}
                          onChange={(p) => search(lastQuery, p)} />
            </div>
          )}
        </div>

        <aside className="col-lg-4">
          <div className="card card-body filters">
            <h2 className="h5">Топ-250 Кинопоиска</h2>
            <p className="small text-secondary">
              Загрузить сразу много фильмов из рейтинга Кинопоиска. Уже добавленные пропускаются.
              Один запрос к API.
            </p>
            <label className="form-label" htmlFor="top-limit">Сколько фильмов</label>
            <select id="top-limit" className="form-select mb-3" value={topLimit}
                    onChange={(e) => setTopLimit(Number(e.target.value))} disabled={!enabled}>
              {[25, 50, 100, 250].map((n) => <option key={n} value={n}>первые {n}</option>)}
            </select>
            <button className="btn btn-warning fw-semibold" onClick={importTop}
                    disabled={!enabled || topBusy}>
              <i className="bi bi-cloud-download me-1" />
              {topBusy ? 'Загружаю…' : 'Загрузить топ'}
            </button>
            {topResult && (
              <div className="alert alert-success mt-3 mb-0 small">
                Добавлено: <b>{topResult.imported}</b>, пропущено: {topResult.skipped}.
                Всего в фильмотеке: <b>{topResult.total}</b>. <Link to="/">К списку</Link>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}
