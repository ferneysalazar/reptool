export default function StatusBar({ status, loaded, total, hasPreview }) {
  if (status === 'idle') return null

  if (status === 'done') {
    return (
      <div className="status-bar done">
        Loaded {total.toLocaleString()} rows
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
