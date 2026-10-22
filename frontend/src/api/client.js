// Клиент REST API на axios. Все запросы к бэкенду проходят через этот модуль.
import axios from 'axios'

// В разработке API работает отдельно на :8000 (запросы идут через CORS).
// В собранной версии (онлайн-демо) React отдаёт сам FastAPI — тот же адрес, префикс /api.
export const API_URL =
  import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://127.0.0.1:8000')

const http = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

// убираем пустые параметры, чтобы не отправлять ?q=&genre_id=
function clean(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  )
}

// ---------- фильмы
export const getMovies = (params) =>
  http.get('/movies', { params: clean(params) }).then((r) => r.data)
export const getTopMovies = (limit = 5) =>
  http.get('/movies/top', { params: { limit } }).then((r) => r.data)
export const getMovie = (id) => http.get(`/movies/${id}`).then((r) => r.data)
export const createMovie = (data) => http.post('/movies', data).then((r) => r.data)
export const updateMovie = (id, data) => http.put(`/movies/${id}`, data).then((r) => r.data)
export const patchMovie = (id, data) => http.patch(`/movies/${id}`, data).then((r) => r.data)
export const deleteMovie = (id) => http.delete(`/movies/${id}`)

// ---------- жанры
export const getGenres = () => http.get('/genres').then((r) => r.data)
export const createGenre = (data) => http.post('/genres', data).then((r) => r.data)
export const updateGenre = (id, data) => http.put(`/genres/${id}`, data).then((r) => r.data)
export const deleteGenre = (id) => http.delete(`/genres/${id}`)

// ---------- Кинопоиск (внешний API через наш бэкенд; ключ хранится только на сервере)
const KP_TIMEOUT = { timeout: 60000 }
export const kpStatus = () => http.get('/kinopoisk/status').then((r) => r.data)
export const kpSearch = (q, page = 1) =>
  http.get('/kinopoisk/search', { params: { q, page, limit: 12 }, ...KP_TIMEOUT }).then((r) => r.data)
export const kpImport = (kpId) => http.post(`/kinopoisk/import/${kpId}`, null, KP_TIMEOUT).then((r) => r.data)
export const kpImportTop = (limit) =>
  http.post('/kinopoisk/import-top', null, { params: { limit }, ...KP_TIMEOUT }).then((r) => r.data)

// ---------- статистика
export const getStats = () => http.get('/stats').then((r) => r.data)

/** Текст ошибки для пользователя из ответа API. */
export function errorMessage(err) {
  if (!err.response)
    return `Сервер недоступен. Проверьте, что бэкенд запущен${API_URL ? ` на ${API_URL}` : ''}`
  const detail = err.response.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => d.msg.replace(/^Value error, /, '')).join('; ')
  return `Ошибка ${err.response.status}`
}

/** Ошибки валидации 422 в виде { поле: сообщение } для подсветки полей формы. */
export function fieldErrors(err) {
  const detail = err.response?.data?.detail
  if (!Array.isArray(detail)) return {}
  const result = {}
  for (const d of detail) {
    const field = d.loc?.[d.loc.length - 1]
    if (field && field !== 'body') result[field] = d.msg.replace(/^Value error, /, '')
  }
  return result
}
