import { useState } from 'react'

// Modal form that lets the user edit all fields of a single record inline,
// then saves only the fields that actually changed
export default function FormViewPopup({ recordId, headers, initialValues, onSave, onClose }) {
  // Index-based state handles duplicate column names correctly
  const [values, setValues] = useState(() => headers.map(h => initialValues[h] ?? ''))

  // Collects only the fields that differ from their initial value and passes them to the parent
  function handleSave() {
    const changes = values
      .map((val, colIdx) => ({ colIdx, value: val }))
      .filter(({ colIdx, value }) => value !== (initialValues[headers[colIdx]] ?? ''))
    onSave(recordId, changes)
    onClose()
  }

  return (
    <div className="form-popup-overlay">
      <div className="form-popup">
        <div className="form-popup__header">
          <span className="form-popup__title">Record #{recordId}</span>
          <button className="form-popup__close" onClick={onClose} title="Close">✕</button>
        </div>
        <div className="form-popup__body">
          {/* Renders one labelled input per column */}
          {headers.map((header, i) => (
            <div key={i} className="form-popup__field">
              <label className="form-popup__label" title={header}>{header}</label>
              <input
                className="form-popup__input"
                value={values[i]}
                onChange={e => setValues(v => { const next = [...v]; next[i] = e.target.value; return next })}
              />
            </div>
          ))}
        </div>
        <div className="form-popup__footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave}>Update Record</button>
        </div>
      </div>
    </div>
  )
}
