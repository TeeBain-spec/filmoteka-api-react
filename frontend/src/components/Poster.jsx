import { useEffect, useState } from 'react'
import { genreIcon } from '../utils.js'

/**
 * Обложка фильма. Если ссылки нет или картинка не загрузилась —
 * показывается заглушка с иконкой жанра.
 * size: 'card' (карточка поиска) | 'lg' (страница фильма) | 'thumb' (таблица) | 'preview' (форма)
 */
export default function Poster({ url, genre, title = '', size = 'card', className = '' }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url]) // новая ссылка — пробуем загрузить заново

  const showImage = url && !failed
  return (
    <div className={`poster poster-${size} ${showImage ? 'has-image' : ''} ${className}`}>
      {showImage ? (
        <img
          src={url}
          alt={title ? `Обложка: ${title}` : 'Обложка'}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{genreIcon(genre)}</span>
      )}
    </div>
  )
}
