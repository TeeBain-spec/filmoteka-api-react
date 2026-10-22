// Экран 1. Главная страница — таблица фильмов с сортировкой и пагинацией
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { deleteMovie, errorMessage, getMovies, patchMovie } from '../api/client.js'
import ConfirmModal from '../components/ConfirmModal.jsx'
import Pagination from '../components/Pagination.jsx'
import Poster from '../components/Poster.jsx'
import RatingBadge from '../components/RatingBadge.jsx'
import { formatDuration } from '../utils.js'

const COLUMNS = [
  { key: 'id', label: '№' },
  { key: 'title', label: 'Название' },
  { key: null, label: 'Жанр' },
  { key: 'year', label: 'Год' },
  { key: 'rating', label: 'Рейтинг' },
  { key: 'duration', label: 'Длительность' },
]

export default function MovieListPage() {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page') || 1)
  const size = Number(params.get('size') || 10)
  const sortBy = params.get('sort_by') || 'id'
  const order = params.get('order') || 'asc'

  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [toDelete, setToDelete] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setError('')
    getMovies({ page, size, sort_by: sortBy, order })
      .then(setData)
      .catch((e) => setError(errorMessage(e)))
  }, [page, size, sortBy, order])

  useEffect(load, [load])

  const update = (patch) => setParams({ page, size, sort_by: sortBy, order, ...patch })

  const sort = (key) => {
    if (!key) return
    const nextOrder = key === sortBy && order === 'asc' ? 'desc' : 'asc'
    update({ sort_by: key, order: nextOrder, page: 1 })
  }

  // PATCH: отметить просмотренным / непросмотренным
  const toggleWatched = async (movie) => {
    try {
      const updated = await patchMovie(movie.id, { is_watched: !movie.is_watched })
      setData((d) => ({ ...d, items: d.items.map((x) => (x.id === movie.id ? updated : x)) }))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const confirmDelete = async () => {
    setBusy(true)
    try {
      await deleteMovie(toDelete.id)
      // если удалили последнюю запись на странице — переходим на предыдущую
      const nextPage = data.items.length === 1 && page > 1 ? page - 1 : page
      setParams(
        { page: nextPage, size, sort_by: sortBy, order },
        { replace: true, state: { flash: `Фильм «${toDelete.title}» удалён` } },
      )
      setToDelete(null)
      if (nextPage === page) load()
    } catch (e) {
      setError(errorMessage(e))
      setToDelete(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
        <div>
          <h1 className="page-title h3 mb-1">Фильмотека</h1>
          <div className="text-secondary">
            {data ? `Всего фильмов: ${data.total}` : 'Загрузка…'}
          </div>
        </div>
        <Link to="/movies/new" className="btn btn-primary">
          <i className="bi bi-plus-lg me-1" /> Добавить фильм
        </Link>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.label} className={c.key ? 'th-sort' : ''} onClick={() => sort(c.key)}
                      title={c.key ? 'Нажмите для сортировки' : undefined}>
                    {c.label}
                    {c.key === sortBy && (
                      <i className={`bi ms-1 ${order === 'asc' ? 'bi-sort-up' : 'bi-sort-down'}`} />
                    )}
                  </th>
                ))}
                <th>Просмотрен</th>
                <th className="text-end">Действия</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((m) => (
                <tr key={m.id}>
                  <td className="text-secondary">{m.id}</td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <Poster url={m.poster_url} genre={m.genre_name} title={m.title} size="thumb" />
                      <div>
                        <Link to={`/movies/${m.id}`} className="fw-semibold text-decoration-none">
                          {m.title}
                        </Link>
                        <div className="small text-secondary">{m.director}</div>
                      </div>
                    </div>
                  </td>
                  <td>{m.genre_name}</td>
                  <td>{m.year}</td>
                  <td><RatingBadge rating={m.rating} /></td>
                  <td className="text-nowrap">{formatDuration(m.duration)}</td>
                  <td>
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" role="switch"
                             checked={m.is_watched} onChange={() => toggleWatched(m)}
                             aria-label="Просмотрен" />
                    </div>
                  </td>
                  <td className="text-end text-nowrap">
                    <Link to={`/movies/${m.id}`} className="btn btn-sm btn-outline-secondary me-1"
                          title="Подробнее">
                      <i className="bi bi-eye" />
                    </Link>
                    <Link to={`/movies/${m.id}/edit`} className="btn btn-sm btn-outline-primary me-1"
                          title="Редактировать">
                      <i className="bi bi-pencil" />
                    </Link>
                    <button className="btn btn-sm btn-outline-danger" title="Удалить"
                            onClick={() => setToDelete(m)}>
                      <i className="bi bi-trash" />
                    </button>
                  </td>
                </tr>
              ))}
              {data && data.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-secondary py-4">
                    Фильмотека пуста
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data && (
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
          <Pagination page={page} pages={data.pages} onChange={(p) => update({ page: p })} />
          <div className="d-flex align-items-center gap-2 ms-auto">
            <label className="text-secondary small" htmlFor="size">На странице:</label>
            <select id="size" className="form-select form-select-sm w-auto" value={size}
                    onChange={(e) => update({ size: e.target.value, page: 1 })}>
              {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      )}

      {toDelete && (
        <ConfirmModal
          title="Удалить фильм?"
          text={<>Фильм <b>«{toDelete.title}»</b> ({toDelete.year}) будет удалён из фильмотеки.</>}
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  )
}
