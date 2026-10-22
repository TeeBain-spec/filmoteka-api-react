export const formatDate = (value) =>
  new Date(value).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })

/** 142 → «2 ч 22 мин» */
export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return [h && `${h} ч`, m && `${m} мин`].filter(Boolean).join(' ') || '0 мин'
}

/** Класс цвета для рейтинга */
export function ratingClass(rating) {
  if (rating >= 8) return 'rating-high'
  if (rating >= 6) return 'rating-mid'
  return 'rating-low'
}

// эмодзи для жанра — чисто декоративно
const ICONS = {
  Драма: '🎭', Комедия: '😂', Фантастика: '🚀', Боевик: '💥', Триллер: '🔪',
  Криминал: '🕵️', Мультфильм: '🧸',
}
export const genreIcon = (name) => ICONS[name] || '🎬'
