import { useState } from 'react'
import { COUNTRIES } from '../data/countries.js'

const BY_CODE = Object.fromEntries(COUNTRIES.map(c => [c.code, c.name]))

export default function InlineTransferField({ value, onChange }) {
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')

  const selected = value
    ? value.split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
    : []
  const selectedSet = new Set(selected)

  const available = COUNTRIES.filter(c => {
    if (selectedSet.has(c.code)) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return c.code.toLowerCase().startsWith(q) || c.name.toLowerCase().includes(q)
  })

  function add(code) { onChange([...selected, code].join(',')) }
  function remove(code) { onChange(selected.filter(c => c !== code).join(',')) }
  function collapse() { setExpanded(false); setSearch('') }

  if (!expanded) {
    return (
      <div className="inline-transfer__collapsed">
        <span className="inline-transfer__summary">{value || '—'}</span>
        <button type="button" className="inline-transfer__expand-btn" onClick={() => setExpanded(true)}>Edit</button>
      </div>
    )
  }

  return (
    <div className="inline-transfer">
      <div className="inline-transfer__toolbar">
        <button type="button" className="inline-transfer__collapse-btn" onClick={collapse}>Collapse</button>
      </div>
      <div className="inline-transfer__panels">
        <div className="inline-transfer__panel">
          <div className="inline-transfer__panel-header">Available</div>
          <input
            className="inline-transfer__search"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <ul className="inline-transfer__list">
            {available.length === 0 && <li className="inline-transfer__empty">No matches</li>}
            {available.map(c => (
              <li key={c.code} className="inline-transfer__item" onClick={() => add(c.code)} title="Click to add">
                <span className="inline-transfer__code">{c.code}</span>
                <span className="inline-transfer__name">{c.name}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="inline-transfer__arrow">→</div>

        <div className="inline-transfer__panel">
          <div className="inline-transfer__panel-header">Selected</div>
          <ul className="inline-transfer__list inline-transfer__list--selected">
            {selected.length === 0 && <li className="inline-transfer__empty">None selected</li>}
            {selected.map(code => (
              <li key={code} className="inline-transfer__item inline-transfer__item--selected" onClick={() => remove(code)} title="Click to remove">
                <span className="inline-transfer__label">{code} - {BY_CODE[code] ?? code}</span>
                <span className="inline-transfer__remove">✕</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
