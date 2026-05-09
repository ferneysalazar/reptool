import { useRef, useState } from 'react'

const VALID_EXTENSIONS = ['.xlsx', '.xls', '.csv']

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isValidFile(file) {
  return VALID_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext))
}

export default function DropZone({ onFile, disabled }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [pending, setPending] = useState(null) // File awaiting confirmation

  function stage(file) {
    if (!file) return
    setPending(file)
  }

  function confirm() {
    onFile(pending)
    setPending(null)
  }

  function cancel() {
    setPending(null)
    inputRef.current.value = ''
  }

  function onDragOver(e) {
    e.preventDefault()
    setDragging(true)
  }

  function onDragLeave() {
    setDragging(false)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    stage(e.dataTransfer.files[0])
  }

  function onChange(e) {
    stage(e.target.files[0])
  }

  if (pending) {
    const valid = isValidFile(pending)
    return (
      <div className="drop-zone drop-zone--confirm">
        <p className="drop-zone-name">{pending.name}</p>
        <p className="drop-zone-meta">{formatBytes(pending.size)}</p>
        {!valid && (
          <p className="drop-zone-warning">
            Unsupported file type. Only .xlsx, .xls and .csv are accepted.
          </p>
        )}
        <div className="drop-zone-actions">
          <button className="btn btn--primary" onClick={confirm} disabled={!valid}>
            Load file
          </button>
          <button className="btn btn--ghost" onClick={cancel}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`drop-zone${dragging ? ' dragging' : ''}${disabled ? ' disabled' : ''}`}
      onDragOver={disabled ? undefined : onDragOver}
      onDragLeave={disabled ? undefined : onDragLeave}
      onDrop={disabled ? undefined : onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && !disabled && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={onChange}
      />
      <p>Drop an Excel or CSV file here or <span className="drop-zone-link">click to browse</span></p>
    </div>
  )
}
