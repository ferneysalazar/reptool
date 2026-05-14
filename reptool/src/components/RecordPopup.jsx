import { useEffect, useRef } from 'react'

// Floating popup that shows the errors and warnings for a specific record,
// anchored to the row-number cell that was clicked
export default function RecordPopup({ meta, anchor, onClose }) {
  const popupRef = useRef(null)

  // Closes the popup on Escape key or a click outside its bounds
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    function handleClickOutside(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  // Position popup near the clicked cell
  const style = anchor
    ? { top: anchor.bottom + 6, left: Math.max(8, anchor.left) }
    : {}

  return (
    <div className="record-popup" ref={popupRef} style={style}>
      <div className="record-popup__header">
        <span className="record-popup__title">Record #{meta.record} ISSUES</span>
        {meta.modified && <span className="record-popup__badge record-popup__badge--modified">Modified</span>}
        <button className="record-popup__close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <Section items={meta.errorList} variant="error" />
      <Section label="Warnings" items={meta.warningList} variant="warning" />

      {meta.errorList.length === 0 && meta.warningList.length === 0 && (
        <p className="record-popup__empty">No issues found.</p>
      )}
    </div>
  )
}

// Renders a labelled list of error or warning messages; renders nothing if the list is empty
function Section({ items, variant }) {
  if (!items || items.length === 0) return null
  return (
    <div className="record-popup__section">
      <ul className="record-popup__list">
        {items.map((item, i) => (
          <li key={i} className={`record-popup__item record-popup__item--${variant}`}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
