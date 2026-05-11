import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { fatcaModuleColumns, crsModuleColumns } from '../data/moduleColumns.js'

// First 3 cols are identical in both modules — used to locate the header row
const HEADER_SIGNATURE = fatcaModuleColumns.slice(0, 3).map(c => c.columnName)

function norm(s) {
  return String(s ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
}

// Header row detection still uses contains so extra chars (*, spaces) are tolerated
function isHeaderRow(row) {
  if (!row || row.length < HEADER_SIGNATURE.length) return false
  return HEADER_SIGNATURE.every((col, i) => norm(row[i]).includes(norm(col)))
}

// Returns 0 or 1 (checks first two rows only), or -1 if not found
function findHeaderRowIndex(rows) {
  for (let i = 0; i <= 1 && i < rows.length; i++) {
    if (isHeaderRow(rows[i])) return i
  }
  return -1
}

// Positional contains-check for all columns in a module array.
// Only the first moduleColumns.length file columns are evaluated; extras are ignored.
function matchesModule(fileHeaders, moduleColumns) {
  for (let i = 0; i < moduleColumns.length; i++) {
    if (!norm(fileHeaders[i] ?? '').includes(norm(moduleColumns[i].columnName))) return false
  }
  return true
}

// Try FATCA first, then CRS; returns 'fatca' | 'crs' | null
function detectModule(headerRow) {
  if (matchesModule(headerRow, fatcaModuleColumns)) return 'fatca'
  if (matchesModule(headerRow, crsModuleColumns))  return 'crs'
  return null
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

function parseExcel(buffer) {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const found = findDataSheet(wb)
  if (found) {
    return {
      allRows: found.rows,
      headerIdx: found.headerIdx,
      module: detectModule(found.rows[found.headerIdx]),
    }
  }
  // Fallback: no recognisable header found, use first sheet row 0
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })
  return { allRows: rows, headerIdx: 0, module: null }
}

function parseCsv(buffer) {
  const text = new TextDecoder().decode(new Uint8Array(buffer))
  const { data, errors } = Papa.parse(text, { header: false, skipEmptyLines: true })
  if (errors.length) console.warn('CSV parse warnings:', errors)
  const headerIdx = findHeaderRowIndex(data)
  return {
    allRows: data,
    headerIdx: headerIdx !== -1 ? headerIdx : 0,
    module: headerIdx !== -1 ? detectModule(data[headerIdx]) : null,
  }
}

self.onmessage = ({ data }) => {
  try {
    const { file, fileName } = data
    const isCsv = fileName.toLowerCase().endsWith('.csv')
    const { allRows, headerIdx, module } = isCsv ? parseCsv(file) : parseExcel(file)

    // When module detected, use canonical clean names and cap columns to module array length.
    // buildRows iterates 0..headers.length-1, so extra file columns are automatically ignored.
    const moduleColumns = module === 'fatca' ? fatcaModuleColumns : module === 'crs' ? crsModuleColumns : null
    const headers = moduleColumns
      ? moduleColumns.map(c => c.group ? `${c.group} ${c.columnName}` : c.columnName)
      : (allRows[headerIdx] ?? []).map(String)
    const colTypes = moduleColumns ? moduleColumns.map(c => c.type) : []
    const dataRows = allRows.slice(headerIdx + 1)
    const total = dataRows.length

    self.postMessage({ type: 'preview', headers, rows: buildRows(headers, dataRows.slice(0, 100), colTypes), total, module })

    const CHUNK = 200
    for (let i = 100; i < total; i += CHUNK) {
      self.postMessage({ type: 'progress', loaded: Math.min(i + CHUNK, total), total })
    }

    self.postMessage({ type: 'complete', headers, rows: buildRows(headers, dataRows, colTypes), total, module })
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message })
  }
}
