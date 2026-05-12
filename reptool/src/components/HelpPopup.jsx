import { useEffect, useRef } from 'react'
import helpRaw from '../help.md?raw'

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  )
}

function renderMarkdown(md) {
  const lines = md.split('\n')
  const nodes = []
  let listItems = []
  let tableRows = []
  let inTable = false
  let key = 0

  function flushList() {
    if (!listItems.length) return
    nodes.push(<ul key={key++} className="help-list">{listItems}</ul>)
    listItems = []
  }

  function flushTable() {
    if (!tableRows.length) return
    const [head, , ...body] = tableRows
    const headers = head.split('|').map(c => c.trim()).filter(Boolean)
    nodes.push(
      <table key={key++} className="help-table">
        <thead>
          <tr>{headers.map((h, i) => <th key={i}>{renderInline(h)}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((row, r) => {
            const cells = row.split('|').map(c => c.trim()).filter(Boolean)
            return <tr key={r}>{cells.map((c, i) => <td key={i}>{renderInline(c)}</td>)}</tr>
          })}
        </tbody>
      </table>
    )
    tableRows = []
    inTable = false
  }

  for (const line of lines) {
    if (line.startsWith('# ')) {
      flushList(); flushTable()
      nodes.push(<h1 key={key++} className="help-h1">{line.slice(2)}</h1>)
    } else if (line.startsWith('## ')) {
      flushList(); flushTable()
      nodes.push(<h2 key={key++} className="help-h2">{line.slice(3)}</h2>)
    } else if (line.startsWith('### ')) {
      flushList(); flushTable()
      nodes.push(<h3 key={key++} className="help-h3">{line.slice(4)}</h3>)
    } else if (line.startsWith('| ')) {
      flushList()
      inTable = true
      tableRows.push(line)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (inTable) flushTable()
      listItems.push(<li key={key++}>{renderInline(line.slice(2))}</li>)
    } else if (line.trim() === '') {
      flushList(); flushTable()
    } else {
      flushList(); flushTable()
      nodes.push(<p key={key++} className="help-p">{renderInline(line)}</p>)
    }
  }
  flushList(); flushTable()
  return nodes
}

export default function HelpPopup({ onClose }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose()
  }

  return (
    <div className="help-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="help-popup">
        <div className="help-popup__header">
          <span className="help-popup__title">Help</span>
          <button className="record-popup__close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="help-popup__body">
          <div className="help-popup__content">
            {renderMarkdown(helpRaw)}
          </div>
        </div>
      </div>
    </div>
  )
}
