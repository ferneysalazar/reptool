import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { fatcaCrsModuleColumns } from '../data/moduleColumns.js'

// First 3 cols are used to locate the header row
const HEADER_SIGNATURE = fatcaCrsModuleColumns.slice(0, 3).map(c => c.columnName)

// Normalises a value to lowercase, trimmed, single-spaced string for consistent comparisons
function norm(s) {
  return String(s ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
}

// Header row detection still uses contains so extra chars (*, spaces) are tolerated
function isHeaderRow(row) {
  if (!row || row.length < HEADER_SIGNATURE.length) return false
  return HEADER_SIGNATURE.every((col, i) => norm(row[i]).includes(norm(col)))
}

// Returns the index of the first header row within the first 10 rows, or -1 if not found
function findHeaderRowIndex(rows) {
  for (let i = 0; i <= 9 && i < rows.length; i++) {
    if (isHeaderRow(rows[i])) return i
  }
  return -1
}

// Stops at the first row (after the 3rd) where all of the first 10 columns are blank,
// discarding that row and everything after it. Prevents millions of empty trailing rows
// from being imported when Excel files have ghost formatting beyond the real data.
function truncateDataRows(rows) {
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.slice(0, 10).every(v => v == null || String(v).trim() === '')) {
      return rows.slice(0, i)
    }
  }
  return rows
}

// Scans data rows (raw 2-D arrays) looking for the first row with a non-empty FATCA Status
// or CRS Status value. The column positions are derived from fatcaCrsModuleColumns so they
// are always in sync with the definition. Throws if no qualifying row is found.
function detectModule(dataRows) {
  const fatcaIdx = fatcaCrsModuleColumns.findIndex(c => c.columnName === 'FATCA Status' && c.group === 'AH')
  const crsIdx   = fatcaCrsModuleColumns.findIndex(c => c.columnName === 'CRS Status'   && c.group === 'AH')
  for (const row of dataRows) {
    if (row[fatcaIdx] != null && String(row[fatcaIdx]).trim() !== '') return 'fatca'
    if (row[crsIdx]   != null && String(row[crsIdx]).trim()   !== '') return 'crs'
  }
  throw new Error('Unprocessable: no FATCA Status or CRS Status values found in data rows')
}

// For XLSX: start from 4th sheet (index 3) and walk backwards to the 1st
function findDataSheet(wb) {
  const names = wb.SheetNames
  const startIdx = Math.min(names.length - 1, 3)
  for (let i = startIdx; i >= 0; i--) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[names[i]], { header: 1 })
    const headerIdx = findHeaderRowIndex(rows)
    if (headerIdx !== -1) return { rows, headerIdx }
  }
  return null
}

// Excel stores dates as days since Dec 30 1899 (accounts for the 1900 leap-year bug).
function excelSerialToDate(serial) {
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000))
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}/${m}/${d}`
}

// Converts raw 2-D array rows into keyed objects, converting Excel serial dates
// for date-typed columns and assigning a sequential recordId to each row
function buildRows(headers, rawRows, colTypes = [], offset = 0) {
  return rawRows.map((row, i) => {
    const obj = { recordId: offset + i + 1 }
    for (let c = 0; c < headers.length; c++) {
      const v = row[c]
      if (v == null) {
        obj[headers[c]] = null
      } else if (colTypes[c] === 'date' && typeof v === 'number') {
        obj[headers[c]] = excelSerialToDate(v)
      } else {
        obj[headers[c]] = String(v)
      }
    }
    return obj
  })
}

// Reads an Excel buffer and locates the data sheet and header row
function parseExcel(buffer) {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const found = findDataSheet(wb)
  if (found) {
    return { allRows: found.rows, headerIdx: found.headerIdx, recognized: true }
  }
  // Fallback: no recognisable header found, use first sheet row 0
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })
  return { allRows: rows, headerIdx: 0, recognized: false }
}

// Decodes a CSV buffer with PapaParse and locates the header row
function parseCsv(buffer) {
  const text = new TextDecoder().decode(new Uint8Array(buffer))
  const { data, errors } = Papa.parse(text, { header: false, skipEmptyLines: true })
  if (errors.length) console.warn('CSV parse warnings:', errors)
  const headerIdx = findHeaderRowIndex(data)
  return {
    allRows: data,
    headerIdx: headerIdx !== -1 ? headerIdx : 0,
    recognized: headerIdx !== -1,
  }
}

// Worker entry point: parses the file, then streams preview → progress → complete messages to the main thread
self.onmessage = ({ data }) => {
  try {
    const { file, fileName } = data
    const isCsv = fileName.toLowerCase().endsWith('.csv')
    const { allRows, headerIdx, recognized } = isCsv ? parseCsv(file) : parseExcel(file)

    const dataRows = truncateDataRows(allRows.slice(headerIdx + 1))

    // When the file has a recognised header, detect module from the first data row that has
    // a non-empty FATCA Status or CRS Status value. Throws if none is found.
    const module = recognized ? detectModule(dataRows) : null
    const moduleColumns = module ? fatcaCrsModuleColumns : null
    const headers = moduleColumns
      ? moduleColumns.map(c => c.group ? `${c.group} ${c.columnName}` : c.columnName)
      : (allRows[headerIdx] ?? []).map(String)
    const colTypes = moduleColumns ? moduleColumns.map(c => c.type) : []
    const total = dataRows.length

    self.postMessage({ type: 'preview', headers, colTypes, rows: buildRows(headers, dataRows.slice(0, 100), colTypes), total, module })

    const CHUNK = 200
    for (let i = 100; i < total; i += CHUNK) {
      self.postMessage({ type: 'progress', loaded: Math.min(i + CHUNK, total), total })
    }

    self.postMessage({ type: 'complete', headers, colTypes, rows: buildRows(headers, dataRows, colTypes), total, module })
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message })
  }
}
