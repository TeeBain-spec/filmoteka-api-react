import { ratingClass } from '../utils.js'

export default function RatingBadge({ rating, large = false }) {
  return (
    <span className={`rating ${ratingClass(rating)} ${large ? 'rating-lg' : ''}`}
          title="Рейтинг по 10-балльной шкале">
      <i className="bi bi-star-fill me-1" />
      {rating.toFixed(1)}
    </span>
  )
}
