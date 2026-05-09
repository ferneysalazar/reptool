import { useRef, useState } from 'react'

export default function DropZone({ onFile, disabled }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState(null)

  function handleFile(file) {
    if (!file) return
    setFileName(file.name)
    onFile(file)
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
    handleFile(e.dataTransfer.files[0])
  }

  function onChange(e) {
    handleFile(e.target.files[0])
    e.target.value = ''
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
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={onChange}
      />
      {fileName
        ? <p className="drop-zone-name">{fileName}</p>
        : <p>Drop an Excel file here or <span className="drop-zone-link">click to browse</span></p>
      }
    </div>
  )
}
