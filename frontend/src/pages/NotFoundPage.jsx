import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="text-center py-5">
      <div className="display-1">🎞️</div>
      <h1 className="h3">Страница не найдена</h1>
      <Link to="/" className="btn btn-primary mt-2">К списку фильмов</Link>
    </div>
  )
}
