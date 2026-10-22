import { Link, NavLink } from 'react-router-dom'
import { API_URL } from '../api/client.js'

const links = [
  { to: '/', label: 'Фильмы', icon: 'bi-film', end: true },
  { to: '/search', label: 'Поиск', icon: 'bi-search' },
  { to: '/genres', label: 'Жанры', icon: 'bi-tags' },
  { to: '/stats', label: 'Статистика', icon: 'bi-bar-chart' },
  { to: '/import', label: 'Кинопоиск', icon: 'bi-cloud-download' },
]

export default function NavBar() {
  return (
    <nav className="navbar navbar-expand navbar-dark app-navbar">
      <div className="container">
        <Link className="navbar-brand" to="/">🎬 <span className="brand-text d-none d-sm-inline">Фильмотека</span></Link>
        <ul className="navbar-nav me-auto flex-wrap min-w-0">
          {links.map((l) => (
            <li className="nav-item" key={l.to}>
              <NavLink className="nav-link" to={l.to} end={l.end}>
                <i className={`bi ${l.icon} me-1`} />
                <span className="d-none d-md-inline">{l.label}</span>
              </NavLink>
            </li>
          ))}
          <li className="nav-item">
            {/* документация API (Swagger UI) — открывается в новой вкладке */}
            <a className="nav-link" href={`${API_URL}/docs`} target="_blank" rel="noreferrer">
              <i className="bi bi-braces me-1" />
              <span className="d-none d-md-inline">API</span>
            </a>
          </li>
        </ul>
        <Link className="btn btn-warning btn-sm fw-semibold" to="/movies/new">
          <i className="bi bi-plus-lg me-1" />
          <span className="d-none d-sm-inline">Добавить фильм</span>
        </Link>
      </div>
    </nav>
  )
}
