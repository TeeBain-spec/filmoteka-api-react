// Экран 3 (детали объекта): карточка одного фильма
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteMovie, errorMessage, getMovie, patchMovie } from '../api/client.js'
import ConfirmModal from '../components/ConfirmModal.jsx'
import RatingBadge from '../components/RatingBadge.jsx'
import { formatDate, formatDuration, genreIcon } from '../utils.js'

export default function MovieDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [movie, setMovie] = useState(null)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setMovie(null)
    getMovie(id).then(setMovie).catch((e) => setError(errorMessage(e)))
  }, [id])

  const toggleWatched = async () => {
    try {
      setMovie(await patchMovie(id, { is_watched: !movie.is_watched }))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await deleteMovie(id)
      navigate('/', { state: { flash: `Фильм «${movie.title}» удалён` } })
    } catch (e) {
      setError(errorMessage(e))
      setConfirm(false)
      setBusy(false)
    }
  }

  if (error && !movie)
    return (
      <div className="alert alert-danger">
        {error}. <Link to="/">Вернуться к списку</Link>
      </div>
    )
  if (!movie) return <div className="text-secondary">Загрузка…</div>

  const facts = [
    ['Режиссёр', movie.director],
    ['Жанр', movie.genre_name],
    ['Год', movie.year],
    ['Страна', movie.country || '—'],
    ['Длительность', `${formatDuration(movie.duration)} (${movie.duration} мин)`],
    ['Добавлен', formatDate(movie.created_at)],
    ['Изменён', formatDate(movie.updated_at)],
  ]

  return (
    <>
      <Link to="/" className="text-decoration-none small">
        <i className="bi bi-arrow-left" /> К списку фильмов
      </Link>
      {error && <div className="alert alert-danger mt-2">{error}</div>}

      <div className="card mt-2">
        <div className="card-body p-4">
          <div className="row g-4">
            <div className="col-md-auto">
              <div className="poster poster-lg mx-auto">{genreIcon(movie.genre_name)}</div>
            </div>
            <div className="col">
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                <div>
                  <div className="text-secondary small">#{movie.id} · {movie.genre_name}</div>
                  <h1 className="page-title h2 mb-1">{movie.title}</h1>
                  <div className="text-secondary mb-3">{movie.year}, {movie.country}</div>
                </div>
                <RatingBadge rating={movie.rating} large />
              </div>

              <p className="mb-4">
                {movie.description || <i className="text-secondary">Описание не заполнено</i>}
              </p>

              <dl className="row mb-0">
                {facts.map(([k, v]) => (
                  <div className="col-sm-6 col-xl-4 mb-3" key={k}>
                    <dt className="text-secondary small fw-normal">{k}</dt>
                    <dd className="mb-0 fw-semibold">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="d-flex flex-wrap gap-2 mt-2">
                <Link to={`/movies/${movie.id}/edit`} className="btn btn-primary">
                  <i className="bi bi-pencil me-1" /> Редактировать
                </Link>
                <button className={`btn ${movie.is_watched ? 'btn-success' : 'btn-outline-success'}`}
                        onClick={toggleWatched}>
                  <i className={`bi ${movie.is_watched ? 'bi-check2-circle' : 'bi-bookmark'} me-1`} />
                  {movie.is_watched ? 'Просмотрен' : 'Отметить просмотренным'}
                </button>
                <button className="btn btn-outline-danger" onClick={() => setConfirm(true)}>
                  <i className="bi bi-trash me-1" /> Удалить
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {confirm && (
        <ConfirmModal
          title="Удалить фильм?"
          text={<>Фильм <b>«{movie.title}»</b> будет удалён из фильмотеки.</>}
          busy={busy}
          onConfirm={remove}
          onCancel={() => setConfirm(false)}
        />
      )}
    </>
  )
}
