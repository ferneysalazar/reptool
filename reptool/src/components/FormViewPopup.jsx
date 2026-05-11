import { useState } from 'react'

export default function FormViewPopup({ recordId, headers, initialValues, onSave, onClose }) {
  // Index-based state handles duplicate column names correctly
  const [values, setValues] = useState(() => headers.map(h => initialValues[h] ?? ''))

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
