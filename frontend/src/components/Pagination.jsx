export default function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null
  const numbers = Array.from({ length: pages }, (_, i) => i + 1)
  return (
    <nav aria-label="Страницы">
      <ul className="pagination mb-0">
        <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
          <button className="page-link" onClick={() => onChange(page - 1)}>‹</button>
        </li>
        {numbers.map((n) => (
          <li key={n} className={`page-item ${n === page ? 'active' : ''}`}>
            <button className="page-link" onClick={() => onChange(n)}>{n}</button>
          </li>
        ))}
        <li className={`page-item ${page === pages ? 'disabled' : ''}`}>
          <button className="page-link" onClick={() => onChange(page + 1)}>›</button>
        </li>
      </ul>
    </nav>
  )
}
