import { useEffect, useRef, useState } from 'react'

// Generic autocomplete popup for selecting from a { value, label, badge? } list.
// badge: optional short code shown before the label (used e.g. for country codes).
export default function ListSelectPopup({ items, value, anchor, onCommit, onCancel }) {
  const [query, setQuery] = useState(value ?? '')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const popupRef = useRef(null)

  const filtered = query.trim() === ''
    ? items
    : items.filter(item => {
        const q = query.toLowerCase()
        return (
          item.value.toLowerCase().includes(q) ||
          item.label.toLowerCase().includes(q) ||
          (item.badge && item.badge.toLowerCase().startsWith(q))
        )
      })

  useEffect(() => { setActiveIdx(0) }, [query])

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    const item = listRef.current?.children[activeIdx]
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  useEffect(() => {
    function handleClickOutside(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) onCancel()
    }
    function handleKeyGlobal(e) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyGlobal)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyGlobal)
    }
  }, [onCancel])

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[activeIdx]) onCommit(filtered[activeIdx].value)
    }
  }

  const style = anchor
    ? { top: anchor.bottom + 4, left: Math.max(8, anchor.left) }
    : {}

  return (
    <div className="country-popup" style={style} ref={popupRef}>
      <input
        ref={inputRef}
        className="country-popup__input"
        value={query}
        placeholder="Type to search…"
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <ul className="country-popup__list" ref={listRef}>
        {filtered.length === 0 && (
          <li className="country-popup__empty">No matches</li>
        )}
        {filtered.map((item, i) => (
          <li
            key={item.value}
            className={`country-popup__item${i === activeIdx ? ' country-popup__item--active' : ''}`}
            onMouseEnter={() => setActiveIdx(i)}
            onMouseDown={e => { e.preventDefault(); onCommit(item.value) }}
          >
            {item.badge && <span className="country-popup__code">{item.badge}</span>}
            <span className="country-popup__name">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
