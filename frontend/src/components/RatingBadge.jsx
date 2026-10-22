import { ratingClass } from '../utils.js'

export default function RatingBadge({ rating, large = false }) {
  if (rating === null || rating === undefined) return <span className="rating rating-mid">—</span>
  return (
    <span className={`rating ${ratingClass(rating)} ${large ? 'rating-lg' : ''}`}
          title="Рейтинг по 10-балльной шкале">
      <i className="bi bi-star-fill me-1" />
      {rating.toFixed(1)}
    </span>
  )
}
