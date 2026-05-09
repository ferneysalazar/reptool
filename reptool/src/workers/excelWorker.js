import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { tableToIPC, vectorFromArray, Table, Utf8 } from 'apache-arrow'

const utf8 = new Utf8()

function buildArrowTable(headers, rows) {
  const columns = {}
  for (const header of headers) columns[header] = []
  for (const row of rows) {
    for (let c = 0; c < headers.length; c++) {
      const v = row[c]
      columns[headers[c]].push(v == null ? null : String(v))
    }
  }
  const vectors = {}
  for (const [name, arr] of Object.entries(columns)) {
    vectors[name] = vectorFromArray(arr, utf8)
  }
  return new Table(vectors)
}

function serializeTable(table) {
  const ipc = tableToIPC(table)
  return ipc.buffer.slice(ipc.byteOffset, ipc.byteOffset + ipc.byteLength)
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

    const previewBuf = serializeTable(buildArrowTable(headers, dataRows.slice(0, 100)))
    self.postMessage({ type: 'preview', ipc: previewBuf, total }, [previewBuf])

    const CHUNK = 200
    for (let i = 100; i < total; i += CHUNK) {
      self.postMessage({ type: 'progress', loaded: Math.min(i + CHUNK, total), total })
    }

    const fullBuf = serializeTable(buildArrowTable(headers, dataRows))
    self.postMessage({ type: 'complete', ipc: fullBuf, total }, [fullBuf])
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message })
  }
}
