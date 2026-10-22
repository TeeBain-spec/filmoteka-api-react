// Статистика фильмотеки (агрегация на бэкенде) + топ по рейтингу
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage, getStats, getTopMovies } from '../api/client.js'
import RatingBadge from '../components/RatingBadge.jsx'
import { formatDuration, genreIcon } from '../utils.js'

export default function StatsPage() {
  const [stats, setStats] = useState(null)
  const [top, setTop] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getStats(), getTopMovies(5)])
      .then(([s, t]) => {
        setStats(s)
        setTop(t)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [])

  if (error) return <div className="alert alert-danger">{error}</div>
  if (!stats) return <div className="text-secondary">Загрузка…</div>

  const maxGenre = Math.max(1, ...stats.by_genre.map((g) => g.movies_count))
  const maxDecade = Math.max(1, ...stats.by_decade.map((d) => d.movies_count))
  const tiles = [
    ['Фильмов', stats.total_movies],
    ['Просмотрено', `${stats.watched_movies} из ${stats.total_movies}`],
    ['Средний рейтинг', stats.avg_rating ?? '—'],
    ['Годы', stats.min_year ? `${stats.min_year}–${stats.max_year}` : '—'],
    ['Общая длительность', formatDuration(stats.total_duration)],
  ]

  return (
    <>
      <h1 className="page-title h3 mb-3">Статистика</h1>

      <div className="row row-cols-2 row-cols-md-3 row-cols-xl-5 g-3 mb-4">
        {tiles.map(([label, value]) => (
          <div className="col" key={label}>
            <div className="card card-body h-100">
              <div className="text-secondary small">{label}</div>
              <div className="stat-value">{value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card card-body h-100">
            <h2 className="h5 mb-3">По жанрам</h2>
            {stats.by_genre.map((g) => (
              <div key={g.genre_id} className="mb-3">
                <div className="d-flex justify-content-between small mb-1">
                  <span>{genreIcon(g.genre_name)} {g.genre_name}</span>
                  <span className="text-secondary">
                    {g.movies_count} шт. · средний {g.avg_rating ?? '—'}
                  </span>
                </div>
                <div className="bar-track">
                  <div className="bar" style={{ width: `${(g.movies_count / maxGenre) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card card-body mb-4">
            <h2 className="h5 mb-3">Топ-5 по рейтингу</h2>
            <ol className="list-group list-group-numbered list-group-flush">
              {top.map((m) => (
                <li key={m.id} className="list-group-item d-flex align-items-center gap-2 px-0">
                  <Link to={`/movies/${m.id}`} className="text-decoration-none flex-grow-1">
                    {m.title} <span className="text-secondary small">({m.year})</span>
                  </Link>
                  <RatingBadge rating={m.rating} />
                </li>
              ))}
            </ol>
          </div>

          <div className="card card-body">
            <h2 className="h5 mb-3">По десятилетиям</h2>
            {stats.by_decade.map((d) => (
              <div key={d.decade} className="d-flex align-items-center gap-2 mb-2 small">
                <span style={{ width: 52 }}>{d.decade}-е</span>
                <div className="bar-track flex-grow-1">
                  <div className="bar" style={{ width: `${(d.movies_count / maxDecade) * 100}%` }} />
                </div>
                <span className="text-secondary text-nowrap" style={{ width: 110 }}>
                  {d.movies_count} шт. · ★ {d.avg_rating}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
