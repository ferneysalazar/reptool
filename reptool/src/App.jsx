import { useRef, useState, useCallback, useMemo } from 'react'
import DropZone from './components/DropZone.jsx'
import StatusBar from './components/StatusBar.jsx'
import DataGrid from './components/DataGrid.jsx'
import './App.css'

export default function App() {
  const workerRef = useRef(null)
  const [gridData, setGridData] = useState(null) // { headers, rows }
  const [module, setModule] = useState(null)      // 'fatca' | 'crs' | null
  const [loadStatus, setLoadStatus] = useState({ state: 'idle', loaded: 0, total: 0 })
  const [fileName, setFileName] = useState(null)
  const [hasPreview, setHasPreview] = useState(false)
  const [edits, setEdits] = useState(new Map())

  function handleFile(file) {
    workerRef.current?.terminate()
    setGridData(null)
    setModule(null)
    setEdits(new Map())
    setHasPreview(false)
    setFileName(file.name)
    setLoadStatus({ state: 'parsing', loaded: 0, total: 0 })

    const worker = new Worker(
      new URL('./workers/excelWorker.js', import.meta.url),
      { type: 'module' }
    )
    workerRef.current = worker

    worker.onerror = (e) => {
      console.error('Worker error:', e.message, e)
      setLoadStatus({ state: 'idle', loaded: 0, total: 0 })
    }

    worker.onmessage = ({ data }) => {
      if (data.type === 'preview') {
        setGridData({ headers: data.headers, colTypes: data.colTypes ?? [], rows: data.rows })
        setModule(data.module)
        setHasPreview(true)
        setLoadStatus({ state: 'loading', loaded: 100, total: data.total })
      }
      if (data.type === 'progress') {
        setLoadStatus({ state: 'loading', loaded: data.loaded, total: data.total })
      }
      if (data.type === 'complete') {
        setGridData({ headers: data.headers, colTypes: data.colTypes ?? [], rows: data.rows })
        setModule(data.module)
        setLoadStatus({ state: 'done', loaded: data.total, total: data.total })
      }
      if (data.type === 'error') {
        console.error('Worker reported error:', data.message)
        setLoadStatus({ state: 'idle', loaded: 0, total: 0 })
      }
    }

    file.arrayBuffer().then(buf => worker.postMessage({ file: buf, fileName: file.name }, [buf]))
  }

  const handleEdit = useCallback((recordId, colIdx, value) => {
    setEdits(prev => new Map(prev).set(`${recordId}:${colIdx}`, value))
  }, [])

  // Removes the given record IDs from gridData and cleans up their pending edits
  const handleDeleteRecords = useCallback((ids) => {
    const idSet = new Set(ids)
    setGridData(prev => ({ ...prev, rows: prev.rows.filter(r => !idSet.has(r.recordId)) }))
    setEdits(prev => {
      const next = new Map(prev)
      for (const key of prev.keys()) {
        if (idSet.has(parseInt(key.split(':')[0], 10))) next.delete(key)
      }
      return next
    })
  }, [])

  const handleClear = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
    setGridData(null)
    setModule(null)
    setEdits(new Map())
    setHasPreview(false)
    setFileName(null)
    setLoadStatus({ state: 'idle', loaded: 0, total: 0 })
  }, [])

  const editedCount = useMemo(() => {
    const ids = new Set()
    for (const key of edits.keys()) ids.add(key.split(':')[0])
    return ids.size
  }, [edits])

  const isLoading = loadStatus.state === 'parsing' || loadStatus.state === 'loading'

  return (
    <div className="reptool-root">
      <h1>FIRE Reporting Tool</h1>
      {!gridData && <DropZone onFile={handleFile} disabled={isLoading} />}
      <StatusBar
        status={loadStatus.state}
        loaded={loadStatus.loaded}
        total={loadStatus.total}
        hasPreview={hasPreview}
        module={module}
        fileName={fileName}
        editedCount={editedCount}
      />
      <DataGrid gridData={gridData} edits={edits} onEdit={handleEdit} onClear={handleClear} onDeleteRecords={handleDeleteRecords} module={module} />
    </div>
  )
}
