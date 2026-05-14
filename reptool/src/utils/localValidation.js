import { FIELD_EDITOR_TYPES } from '../data/fieldEditorTypes.js'
import { COUNTRIES } from '../data/countries.js'
import { FATCA_STATUSES } from '../data/fatcaStatuses.js'
import { CRS_STATUSES } from '../data/crsStatuses.js'
import { ACCOUNT_TYPES } from '../data/accountTypes.js'
import { ACCOUNT_NUMBER_TYPES } from '../data/accountNumberTypes.js'

const COUNTRY_CODES = new Set(COUNTRIES.map(c => c.code))

const SELECTOR_VALID = {
  country:           new Set(COUNTRIES.map(c => c.code)),
  fatcaStatus:       new Set(FATCA_STATUSES.map(s => s.value)),
  crsStatus:         new Set(CRS_STATUSES.map(s => s.value)),
  accountType:       new Set(ACCOUNT_TYPES.map(s => s.value)),
  accountNumberType: new Set(ACCOUNT_NUMBER_TYPES.map(s => s.value)),
}

function isValidDate(str) {
  if (!/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(str)) return false
  const [y, m, d] = str.split(/[-/]/).map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

export function validateRows(rows, headers, colTypes) {
  const errors = new Map() // recordId → string[]

  for (const row of rows) {
    const rowErrors = []

    headers.forEach((header, idx) => {
      const raw = row[header]
      const val = String(raw ?? '').trim()
      if (!val) return

      const editorType = FIELD_EDITOR_TYPES[header]
      const colType = colTypes[idx] ?? 'string'

      if (editorType === 'transferCountry') {
        const codes = val.split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
        const invalid = codes.filter(c => !COUNTRY_CODES.has(c))
        if (invalid.length > 0)
          rowErrors.push(`${header}: invalid country code(s): ${invalid.join(', ')}`)
      } else if (SELECTOR_VALID[editorType]) {
        if (!SELECTOR_VALID[editorType].has(val))
          rowErrors.push(`${header}: "${val}" is not a valid option`)
      } else if (colType === 'number') {
        if (val !== '' && isNaN(Number(val)))
          rowErrors.push(`${header}: "${val}" is not a valid number`)
      } else if (colType === 'date') {
        if (!isValidDate(val))
          rowErrors.push(`${header}: "${val}" must be yyyy-mm-dd or yyyy/mm/dd`)
      }
    })

    if (rowErrors.length > 0) errors.set(row.recordId, rowErrors)
  }

  return { valid: errors.size === 0, errors }
}
