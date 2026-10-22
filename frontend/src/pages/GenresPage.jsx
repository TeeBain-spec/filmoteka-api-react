// Жанры: список, добавление, редактирование, удаление
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createGenre, deleteGenre, errorMessage, fieldErrors, getGenres, updateGenre,
} from '../api/client.js'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { genreIcon } from '../utils.js'

const EMPTY = { name: '', description: '' }

export default function GenresPage() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [toDelete, setToDelete] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    getGenres().then(setItems).catch((e) => setError(errorMessage(e)))
  }, [])
  useEffect(load, [load])

  const startEdit = (g) => {
    setEditId(g.id)
    setForm({ name: g.name, description: g.description })
    setErrors({})
    setError('')
  }
  const cancel = () => {
    setEditId(null)
    setForm(EMPTY)
    setErrors({})
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.name.trim().length < 2) {
      setErrors({ name: 'Минимум 2 символа' })
      return
    }
    setBusy(true)
    try {
      if (editId) await updateGenre(editId, form)
      else await createGenre(form)
      cancel()
      load()
    } catch (err) {
      setErrors(fieldErrors(err))
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await deleteGenre(toDelete.id)
      load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setToDelete(null)
      setBusy(false)
    }
  }

  return (
    <>
      <h1 className="page-title h3 mb-3">Жанры</h1>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card">
            <ul className="list-group list-group-flush">
              {items.map((g) => (
                <li key={g.id}
                    className={`list-group-item d-flex align-items-center gap-3 py-3 ${editId === g.id ? 'bg-primary-subtle' : ''}`}>
                  <span className="fs-3">{genreIcon(g.name)}</span>
                  <div className="flex-grow-1">
                    <Link to={`/search?genre_id=${g.id}`} className="fw-semibold text-decoration-none">
                      {g.name}
                    </Link>
                    <div className="small text-secondary">{g.description || '—'}</div>
                  </div>
                  <span className="badge rounded-pill text-bg-light border">
                    фильмов: {g.movies_count}
                  </span>
                  <button className="btn btn-sm btn-outline-primary" title="Редактировать"
                          onClick={() => startEdit(g)}>
                    <i className="bi bi-pencil" />
                  </button>
                  <button className="btn btn-sm btn-outline-danger" title="Удалить"
                          onClick={() => setToDelete(g)}>
                    <i className="bi bi-trash" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="col-lg-4">
          <form className="card card-body" onSubmit={submit} noValidate>
            <h2 className="h5 mb-3">{editId ? 'Изменить жанр' : 'Новый жанр'}</h2>
            <label className="form-label" htmlFor="genre-name">Название *</label>
            <input id="genre-name" className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                   value={form.name} maxLength={50}
                   onChange={(e) => setForm({ ...form, name: e.target.value })} />
            {errors.name && <div className="invalid-feedback">{errors.name}</div>}
            <label className="form-label mt-2" htmlFor="genre-desc">Описание</label>
            <textarea id="genre-desc" className="form-control mb-3" rows={3} maxLength={300}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="d-flex gap-2">
              <button className="btn btn-primary" disabled={busy}>
                {editId ? 'Сохранить' : 'Добавить'}
              </button>
              {editId && (
                <button type="button" className="btn btn-outline-secondary" onClick={cancel}>
                  Отмена
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {toDelete && (
        <ConfirmModal
          title="Удалить жанр?"
          text={
            toDelete.movies_count
              ? <>К жанру <b>«{toDelete.name}»</b> относится фильмов: {toDelete.movies_count}. Сервер не даст удалить его, пока они там.</>
              : <>Жанр <b>«{toDelete.name}»</b> будет удалён.</>
          }
          busy={busy}
          onConfirm={remove}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  )
}
