// Экран 2. Форма добавления / редактирования фильма
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  createMovie, errorMessage, fieldErrors, getGenres, getMovie, updateMovie,
} from '../api/client.js'

const MAX_YEAR = new Date().getFullYear() + 5
const EMPTY = {
  title: '', director: '', genre_id: '', year: '', country: '', duration: '', rating: '',
  description: '', is_watched: false,
}

// Проверка на клиенте (повторяет правила бэкенда, чтобы не ждать ответа сервера)
function validate(f) {
  const e = {}
  const isInt = (v) => v !== '' && Number.isInteger(Number(v))
  if (!f.title.trim()) e.title = 'Введите название'
  else if (f.title.trim().length > 200) e.title = 'Максимум 200 символов'
  if (f.director.trim().length < 2) e.director = 'Минимум 2 символа'
  if (!f.genre_id) e.genre_id = 'Выберите жанр'
  if (!isInt(f.year) || f.year < 1888 || f.year > MAX_YEAR)
    e.year = `Год от 1888 до ${MAX_YEAR}`
  if (!isInt(f.duration) || f.duration <= 0 || f.duration > 1000)
    e.duration = 'Целое число минут от 1 до 1000'
  if (f.rating === '' || Number(f.rating) < 0 || Number(f.rating) > 10)
    e.rating = 'Число от 0 до 10'
  if (f.description.length > 1000) e.description = 'Максимум 1000 символов'
  return e
}

export default function MovieFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState(EMPTY)
  const [genres, setGenres] = useState([])
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getGenres().then(setGenres).catch((e) => setServerError(errorMessage(e)))
  }, [])

  useEffect(() => {
    if (!isEdit) return
    getMovie(id)
      .then((m) => setForm(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, m[k]]))))
      .catch((e) => setServerError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  const change = (e) => {
    const { name, type, value, checked } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
    setErrors((er) => ({ ...er, [name]: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setServerError('')
    const clientErrors = validate(form)
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length) return

    const payload = {
      ...form,
      title: form.title.trim(),
      director: form.director.trim(),
      country: form.country.trim(),
      description: form.description.trim(),
      year: Number(form.year),
      duration: Number(form.duration),
      rating: Number(form.rating),
      genre_id: Number(form.genre_id),
    }
    setSaving(true)
    try {
      const saved = isEdit ? await updateMovie(id, payload) : await createMovie(payload)
      navigate(`/movies/${saved.id}`, {
        state: { flash: isEdit ? 'Изменения сохранены' : `Фильм «${saved.title}» добавлен` },
      })
    } catch (err) {
      setErrors(fieldErrors(err))
      setServerError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const field = (name, extra = {}) => ({
    id: name, name, value: form[name], onChange: change,
    className: `form-control ${errors[name] ? 'is-invalid' : ''}`, ...extra,
  })
  const feedback = (name) => errors[name] && <div className="invalid-feedback">{errors[name]}</div>

  if (loading) return <div className="text-secondary">Загрузка…</div>

  return (
    <div className="row justify-content-center">
      <div className="col-lg-9">
        <button type="button" className="btn btn-link p-0 text-decoration-none small"
                onClick={() => navigate(-1)}>
          <i className="bi bi-arrow-left" /> Назад
        </button>
        <h1 className="page-title h3 mt-2 mb-3">
          {isEdit ? 'Редактирование фильма' : 'Новый фильм'}
        </h1>

        {serverError && <div className="alert alert-danger">{serverError}</div>}

        <form className="card card-body p-4" onSubmit={submit} noValidate>
          <div className="row g-3">
            <div className="col-md-8">
              <label htmlFor="title" className="form-label">Название *</label>
              <input {...field('title', { maxLength: 200, placeholder: 'Например, Интерстеллар' })} />
              {feedback('title')}
            </div>
            <div className="col-md-4">
              <label htmlFor="genre_id" className="form-label">Жанр *</label>
              <select {...field('genre_id')}
                      className={`form-select ${errors.genre_id ? 'is-invalid' : ''}`}>
                <option value="">— выберите —</option>
                {genres.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              {feedback('genre_id')}
            </div>
            <div className="col-md-8">
              <label htmlFor="director" className="form-label">Режиссёр *</label>
              <input {...field('director', { maxLength: 100, placeholder: 'Имя Фамилия' })} />
              {feedback('director')}
            </div>
            <div className="col-md-4">
              <label htmlFor="country" className="form-label">Страна</label>
              <input {...field('country', { maxLength: 60 })} />
              {feedback('country')}
            </div>
            <div className="col-md-4">
              <label htmlFor="year" className="form-label">Год выпуска *</label>
              <input {...field('year', { type: 'number', min: 1888, max: MAX_YEAR })} />
              {feedback('year')}
            </div>
            <div className="col-md-4">
              <label htmlFor="duration" className="form-label">Длительность, мин *</label>
              <input {...field('duration', { type: 'number', min: 1, max: 1000 })} />
              {feedback('duration')}
            </div>
            <div className="col-md-4">
              <label htmlFor="rating" className="form-label">Рейтинг (0–10) *</label>
              <input {...field('rating', { type: 'number', min: 0, max: 10, step: 0.1 })} />
              {feedback('rating')}
            </div>
            <div className="col-12">
              <label htmlFor="description" className="form-label">Описание</label>
              <textarea {...field('description', { rows: 3, maxLength: 1000 })} />
              <div className="form-text text-end">{form.description.length}/1000</div>
              {feedback('description')}
            </div>
            <div className="col-12">
              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" role="switch" id="is_watched"
                       name="is_watched" checked={form.is_watched} onChange={change} />
                <label className="form-check-label" htmlFor="is_watched">Уже просмотрен</label>
              </div>
            </div>
          </div>
          <div className="d-flex gap-2 mt-4">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              <i className="bi bi-check-lg me-1" />
              {saving ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Добавить'}
            </button>
            <button className="btn btn-outline-secondary" type="button" onClick={() => navigate(-1)}>
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
