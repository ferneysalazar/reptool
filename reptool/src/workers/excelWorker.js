import * as XLSX from 'xlsx'
import Papa from 'papaparse'

function buildRows(headers, rawRows, offset = 0) {
  return rawRows.map((row, i) => {
    const obj = { recordId: offset + i + 1 }
    for (let c = 0; c < headers.length; c++) {
      const v = row[c]
      obj[headers[c]] = v == null ? null : String(v)
    }
    return obj
  })
}

function parseExcel(buffer) {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet, { header: 1 })
}

function parseCsv(buffer) {
  const text = new TextDecoder().decode(new Uint8Array(buffer))
  const { data, errors } = Papa.parse(text, { header: false, skipEmptyLines: true })
  if (errors.length) console.warn('CSV parse warnings:', errors)
  return data
}

self.onmessage = ({ data }) => {
  try {
    const { file, fileName } = data
    const isCsv = fileName.toLowerCase().endsWith('.csv')
    const allRows = isCsv ? parseCsv(file) : parseExcel(file)

    const headers = allRows[0].map(String)
    const dataRows = allRows.slice(1)
    const total = dataRows.length

    self.postMessage({ type: 'preview', headers, rows: buildRows(headers, dataRows.slice(0, 100)), total })

    const CHUNK = 200
    for (let i = 100; i < total; i += CHUNK) {
      self.postMessage({ type: 'progress', loaded: Math.min(i + CHUNK, total), total })
    }

    self.postMessage({ type: 'complete', headers, rows: buildRows(headers, dataRows), total })
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message })
  }
}
