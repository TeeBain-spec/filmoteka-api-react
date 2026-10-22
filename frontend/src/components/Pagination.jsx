// Номера страниц: первая, последняя и «окно» вокруг текущей, остальное — многоточие
function pageList(page, pages) {
  const set = new Set([1, pages, page - 1, page, page + 1])
  if (page <= 3) [2, 3, 4].forEach((n) => set.add(n))
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((n) => set.add(n))
  const nums = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b)
  const out = []
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push(`gap-${n}`)
    out.push(n)
  })
  return out
}

export default function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null
  return (
    <nav aria-label="Страницы">
      <ul className="pagination flex-wrap mb-0">
        <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
          <button className="page-link" onClick={() => onChange(page - 1)} aria-label="Назад">‹</button>
        </li>
        {pageList(page, pages).map((n) =>
          typeof n === 'string' ? (
            <li key={n} className="page-item disabled">
              <span className="page-link">…</span>
            </li>
          ) : (
            <li key={n} className={`page-item ${n === page ? 'active' : ''}`}>
              <button className="page-link" onClick={() => onChange(n)}>{n}</button>
            </li>
          ),
        )}
        <li className={`page-item ${page === pages ? 'disabled' : ''}`}>
          <button className="page-link" onClick={() => onChange(page + 1)} aria-label="Вперёд">›</button>
        </li>
      </ul>
    </nav>
  )
}
