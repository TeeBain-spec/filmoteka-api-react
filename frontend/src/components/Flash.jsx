import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// Показывает сообщение, переданное через navigate(..., { state: { flash } })
export default function Flash() {
  const location = useLocation()
  const navigate = useNavigate()
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (location.state?.flash) {
      setMessage(location.state.flash)
      // очищаем state, чтобы сообщение не появлялось повторно при обновлении
      navigate(location.pathname + location.search, { replace: true, state: null })
    }
  }, [location, navigate])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(t)
  }, [message])

  if (!message) return null
  return (
    <div className="alert alert-success alert-dismissible shadow-sm flash" role="alert">
      <i className="bi bi-check-circle me-2" />
      {message}
      <button type="button" className="btn-close" onClick={() => setMessage(null)} />
    </div>
  )
}
