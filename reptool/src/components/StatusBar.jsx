export default function StatusBar({ status, loaded, total, hasPreview, module, fileName, editedCount }) {
  if (status === 'idle') return null

  if (status === 'done') {
    if (module === null) {
      return (
        <div className="status-bar status-bar--unrecognized">
          {fileName && <><span className="status-bar__filename">{fileName}</span><span className="status-bar__separator">·</span></>}
          Loaded {total.toLocaleString()} rows
          <span className="status-bar__separator">·</span>
          Non FATCA nor CRS file detected — unprocessable file
        </div>
      )
    }
    return (
      <div className="status-bar done">
        {fileName && <><span className="status-bar__filename">{fileName}</span><span className="status-bar__separator">·</span></>}
        Loaded {total.toLocaleString()} rows
        <span className="status-bar__separator">·</span>
        <span className={`module-badge module-badge--${module}`}>{module.toUpperCase()}</span>
        module
        {editedCount > 0 && <><span className="status-bar__separator">·</span><span className="status-bar__edited">{editedCount} edited</span></>}
      </div>
    )
  }

  if (status === 'parsing') {
    return (
      <div className="status-bar loading">
        <div className="status-bar-track">
          <div className="status-bar-fill status-bar-fill--indeterminate" />
        </div>
        <span className="status-bar-text">Reading file…</span>
      </div>
    )
  }

  const pct = total > 0 ? Math.round((loaded / total) * 100) : 0

  return (
    <div className="status-bar loading">
      <div className="status-bar-track">
        <div className="status-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="status-bar-text">
        Loading… {loaded.toLocaleString()} / {total.toLocaleString()} rows ({pct}%)
        {hasPreview && ' — first 100 rows ready'}
      </span>
    </div>
  )
}
