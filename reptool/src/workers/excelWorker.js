import * as XLSX from 'xlsx'
import { tableToIPC, tableFromArrays } from 'apache-arrow'

function buildArrowTable(headers, rows) {
  const columns = {}
  for (const header of headers) {
    columns[header] = []
  }
  for (const row of rows) {
    for (let c = 0; c < headers.length; c++) {
      columns[headers[c]].push(row[c] ?? null)
    }
  }
  return tableFromArrays(columns)
}

self.onmessage = ({ data }) => {
  try {
  const { file } = data
  const wb = XLSX.read(new Uint8Array(file), { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

  const headers = allRows[0].map(String)
  const dataRows = allRows.slice(1)
  const total = dataRows.length

  // Post preview of first 100 rows immediately
  const previewRows = dataRows.slice(0, 100)
  const previewTable = buildArrowTable(headers, previewRows)
  const previewIpc = tableToIPC(previewTable)
  const previewBuf = previewIpc.buffer.slice(previewIpc.byteOffset, previewIpc.byteOffset + previewIpc.byteLength)
  self.postMessage({ type: 'preview', ipc: previewBuf, total }, [previewBuf])

  // Process remaining rows in chunks, posting progress
  const CHUNK = 200
  for (let i = 100; i < total; i += CHUNK) {
    self.postMessage({ type: 'progress', loaded: Math.min(i + CHUNK, total), total })
  }

  // Post complete table
  const fullTable = buildArrowTable(headers, dataRows)
  const fullIpc = tableToIPC(fullTable)
  const fullBuf = fullIpc.buffer.slice(fullIpc.byteOffset, fullIpc.byteOffset + fullIpc.byteLength)
  self.postMessage({ type: 'complete', ipc: fullBuf, total }, [fullBuf])
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message })
  }
}
