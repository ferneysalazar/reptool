import { useRef, useState, useCallback } from 'react'
import DropZone from './components/DropZone.jsx'
import StatusBar from './components/StatusBar.jsx'
import DataGrid from './components/DataGrid.jsx'
import './App.css'

export default function App() {
  const workerRef = useRef(null)
  const [gridData, setGridData] = useState(null) // { headers, rows }
  const [module, setModule] = useState(null)      // 'fatca' | 'crs' | null
  const [loadStatus, setLoadStatus] = useState({ state: 'idle', loaded: 0, total: 0 })
  const [hasPreview, setHasPreview] = useState(false)
  const [edits, setEdits] = useState(new Map())

  function handleFile(file) {
    workerRef.current?.terminate()
    setGridData(null)
    setModule(null)
    setEdits(new Map())
    setHasPreview(false)
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
        setGridData({ headers: data.headers, rows: data.rows })
        setModule(data.module)
        setHasPreview(true)
        setLoadStatus({ state: 'loading', loaded: 100, total: data.total })
      }
      if (data.type === 'progress') {
        setLoadStatus({ state: 'loading', loaded: data.loaded, total: data.total })
      }
      if (data.type === 'complete') {
        setGridData({ headers: data.headers, rows: data.rows })
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

  const handleClear = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
    setGridData(null)
    setModule(null)
    setEdits(new Map())
    setHasPreview(false)
    setLoadStatus({ state: 'idle', loaded: 0, total: 0 })
  }, [])

  const isLoading = loadStatus.state === 'parsing' || loadStatus.state === 'loading'

  return (
    <main>
      <h1>reptool</h1>
      <DropZone onFile={handleFile} disabled={isLoading} />
      <StatusBar
        status={loadStatus.state}
        loaded={loadStatus.loaded}
        total={loadStatus.total}
        hasPreview={hasPreview}
        module={module}
      />
      <DataGrid gridData={gridData} edits={edits} onEdit={handleEdit} onClear={handleClear} module={module} />
    </main>
  )
}
