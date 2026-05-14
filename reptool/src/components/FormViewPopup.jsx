import { useState } from 'react'
import { FIELD_EDITOR_TYPES } from '../data/fieldEditorTypes.js'
import { COUNTRIES } from '../data/countries.js'
import { FATCA_STATUSES } from '../data/fatcaStatuses.js'
import { CRS_STATUSES } from '../data/crsStatuses.js'
import { ACCOUNT_TYPES } from '../data/accountTypes.js'
import { ACCOUNT_NUMBER_TYPES } from '../data/accountNumberTypes.js'
import InlineTransferField from './InlineTransferField.jsx'

const COUNTRY_OPTIONS = COUNTRIES.map(c => ({ value: c.code, label: `${c.code} - ${c.name}` }))

const LIST_OPTIONS = {
  country:           COUNTRY_OPTIONS,
  fatcaStatus:       FATCA_STATUSES,
  crsStatus:         CRS_STATUSES,
  accountType:       ACCOUNT_TYPES,
  accountNumberType: ACCOUNT_NUMBER_TYPES,
}

export default function FormViewPopup({ recordId, headers, initialValues, onSave, onClose }) {
  const [values, setValues] = useState(() => headers.map(h => initialValues[h] ?? ''))

  function update(i, val) {
    setValues(v => { const next = [...v]; next[i] = val; return next })
  }

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
          {headers.map((header, i) => {
            const editorType = FIELD_EDITOR_TYPES[header]
            const isCP = header.startsWith('CP ')
            return (
              <div key={i} className={`form-popup__field${isCP ? ' form-popup__field--cp' : ''}${editorType === 'transferCountry' ? ' form-popup__field--transfer' : ''}`}>
                <label className="form-popup__label" title={header}>{header}</label>
                {editorType === 'transferCountry' ? (
                  <InlineTransferField value={values[i]} onChange={val => update(i, val)} />
                ) : LIST_OPTIONS[editorType] ? (
                  <select
                    className="form-popup__select"
                    value={values[i]}
                    onChange={e => update(i, e.target.value)}
                  >
                    <option value="">— select —</option>
                    {LIST_OPTIONS[editorType].map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="form-popup__input"
                    value={values[i]}
                    onChange={e => update(i, e.target.value)}
                  />
                )}
              </div>
            )
          })}
        </div>
        <div className="form-popup__footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave}>Update Record</button>
        </div>
      </div>
    </div>
  )
}
