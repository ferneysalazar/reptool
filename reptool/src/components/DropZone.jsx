import { useRef, useState } from 'react'

const VALID_EXTENSIONS = ['.xlsx', '.xls', '.csv']

// Converts a byte count into a human-readable string (B / KB / MB)
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Returns true if the file has an accepted extension
function isValidFile(file) {
  return VALID_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext))
}

// Drag-and-drop / click-to-browse file picker with a confirmation step before loading
export default function DropZone({ onFile, disabled }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [pending, setPending] = useState(null) // File awaiting confirmation

  // Stores the selected file so the user can confirm or cancel before loading
  function stage(file) {
    if (!file) return
    setPending(file)
  }

  // Passes the confirmed file up to the parent and clears the pending state
  function confirm() {
    onFile(pending)
    setPending(null)
  }

  // Discards the pending file and resets the hidden file input
  function cancel() {
    setPending(null)
    inputRef.current.value = ''
  }

  // Prevents default browser behaviour and activates the drag-over highlight
  function onDragOver(e) {
    e.preventDefault()
    setDragging(true)
  }

  // Removes the drag-over highlight when the dragged item leaves the zone
  function onDragLeave() {
    setDragging(false)
  }

  // Picks up the first dropped file and stages it for confirmation
  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    stage(e.dataTransfer.files[0])
  }

  // Stages the file chosen via the hidden file input
  function onChange(e) {
    stage(e.target.files[0])
  }

  // Confirmation view: shows file name, size and a warning for unsupported types
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

  // Default view: clickable / droppable area that opens the hidden file input
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
