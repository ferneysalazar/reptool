import { useEffect, useRef, useState } from 'react'
import { COUNTRIES } from '../data/countries.js'

const BY_CODE = Object.fromEntries(COUNTRIES.map(c => [c.code, c.name]))

function countryLabel(code) {
  const name = BY_CODE[code.trim().toUpperCase()]
  return name ? `${code.trim().toUpperCase()} - ${name}` : code.trim()
}

export default function TransferListPopup({ value, anchor, onCommit, onCancel }) {
  const popupRef = useRef(null)
  const [search, setSearch] = useState('')

  const initialSelected = value
    ? value.split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
    : []
  const [selected, setSelected] = useState(initialSelected)

  const selectedSet = new Set(selected)
  const available = COUNTRIES.filter(c => {
    if (selectedSet.has(c.code)) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return c.code.toLowerCase().startsWith(q) || c.name.toLowerCase().includes(q)
  })

  useEffect(() => {
    function handleClickOutside(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) onCancel()
    }
    function handleKey(e) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onCancel])

  function add(code) {
    setSelected(prev => [...prev, code])
  }

  function remove(code) {
    setSelected(prev => prev.filter(c => c !== code))
  }

  function handleUpdate() {
    onCommit(selected.join(','))
  }

  const style = anchor
    ? { top: anchor.bottom + 4, left: Math.max(8, anchor.left) }
    : {}

  return (
    <div className="transfer-popup" style={style} ref={popupRef}>
      <div className="transfer-popup__panels">
        {/* Available */}
        <div className="transfer-popup__panel">
          <div className="transfer-popup__panel-header">Available</div>
          <input
            className="transfer-popup__search"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <ul className="transfer-popup__list">
            {available.length === 0 && (
              <li className="transfer-popup__empty">No matches</li>
            )}
            {available.map(c => (
              <li
                key={c.code}
                className="transfer-popup__item"
                onClick={() => add(c.code)}
                title="Click to add"
              >
                <span className="transfer-popup__code">{c.code}</span>
                <span className="transfer-popup__name">{c.name}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="transfer-popup__arrow">→</div>

        {/* Selected */}
        <div className="transfer-popup__panel">
          <div className="transfer-popup__panel-header">Selected</div>
          <ul className="transfer-popup__list transfer-popup__list--selected">
            {selected.length === 0 && (
              <li className="transfer-popup__empty">None selected</li>
            )}
            {selected.map(code => (
              <li
                key={code}
                className="transfer-popup__item transfer-popup__item--selected"
                onClick={() => remove(code)}
                title="Click to remove"
              >
                <span className="transfer-popup__label">{countryLabel(code)}</span>
                <span className="transfer-popup__remove">✕</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="transfer-popup__footer">
        <button className="transfer-popup__btn transfer-popup__btn--cancel" onClick={onCancel}>Cancel</button>
        <button className="transfer-popup__btn transfer-popup__btn--update" onClick={handleUpdate}>Update</button>
      </div>
    </div>
  )
}
