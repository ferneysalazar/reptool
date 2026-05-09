import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community'
import RecordPopup from './RecordPopup.jsx'
import rawMeta from '../data/recordMeta.json'

const metaByRecord = Object.fromEntries(rawMeta.map(m => [m.record, m]))

ModuleRegistry.registerModules([AllCommunityModule])

function EditingCell({ value, onCommit, onCancel }) {
  const inputRef = useRef(null)

  function handleKeyDown(e) {
    if (e.key === 'Enter') onCommit(e.target.value)
    if (e.key === 'Escape') onCancel()
  }

  return (
    <input
      ref={inputRef}
      className="cell-editor"
      defaultValue={value ?? ''}
      autoFocus
      onBlur={e => onCommit(e.target.value)}
      onKeyDown={handleKeyDown}
    />
  )
}


export default function DataGrid({ table, edits, onEdit }) {
  const [editingCell, setEditingCell] = useState(null)
  const [totalPages, setTotalPages] = useState(0)
  const [showGoto, setShowGoto] = useState(false)
  const [hoveredRow, setHoveredRow] = useState(null)
  const [popup, setPopup] = useState(null) // { meta, anchor }
  const gridApiRef = useRef(null)
  const gridWrapperRef = useRef(null)
  const topScrollRef = useRef(null)
  const syncingRef = useRef(false)
  const scrollSyncCleanupRef = useRef(null)

  useEffect(() => () => scrollSyncCleanupRef.current?.(), [])

  const colDefs = useMemo(() => {
    if (!table) return []

    const hasError = (val) => String(val ?? '').toLowerCase().includes('error')
    const rowHasError = (data) => data && Object.values(data).some(hasError)

    const rowNumCol = {
      headerName: '#',
      valueGetter: (params) => params.node.rowIndex + 1,
      width: 70,
      minWidth: 70,
      maxWidth: 70,
      sortable: false,
      filter: false,
      suppressMovable: true,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      cellRenderer: (params) => {
        const num = params.value
        const meta = metaByRecord[num]
        function handleClick(e) {
          if (!meta) return
          const rect = e.currentTarget.getBoundingClientRect()
          setPopup({ meta, anchor: { top: rect.top, bottom: rect.bottom, left: rect.left } })
        }
        if (rowHasError(params.data)) {
          return (
            <span
              className={`row-num-badge${meta ? ' row-num-badge--clickable' : ''}`}
              onClick={meta ? handleClick : undefined}
              title={meta ? 'Click to view details' : undefined}
            >
              {num}
            </span>
          )
        }
        return (
          <span
            className={`row-num-plain${meta ? ' row-num-plain--clickable' : ''}`}
            onClick={meta ? handleClick : undefined}
            title={meta ? 'Click to view details' : undefined}
          >
            {num}
          </span>
        )
      },
    }

    const dataCols = table.schema.fields.map((f, colIdx) => ({
      field: f.name,
      headerName: f.name,
      editable: false,
      cellStyle: (params) =>
        hasError(params.value)
          ? { borderLeft: '3px solid #dc2626', borderRight: '3px solid #dc2626' }
          : null,
      cellRenderer: (params) => {
        const rowIdx = params.node.rowIndex
        const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.field === f.name
        if (isEditing) {
          return (
            <EditingCell
              value={params.value}
              onCommit={(val) => {
                onEdit(rowIdx, colIdx, val)
                setEditingCell(null)
              }}
              onCancel={() => setEditingCell(null)}
            />
          )
        }
        return params.value ?? ''
      },
    }))

    return [rowNumCol, ...dataCols]
  }, [table, editingCell, onEdit])

  const rowData = useMemo(() => {
    if (!table) return []
    return Array.from({ length: table.numRows }, (_, i) => {
      const row = {}
      for (const field of table.schema.fields) {
        const col = table.getChild(field.name)
        const key = `${i}:${table.schema.fields.indexOf(field)}`
        row[field.name] = edits.has(key) ? edits.get(key) : col?.get(i)
      }
      return row
    })
  }, [table, edits])

  const onCellDoubleClicked = useCallback((params) => {
    if (!params.colDef.field) return
    setEditingCell({ rowIdx: params.node.rowIndex, field: params.colDef.field })
  }, [])

  const onGridReady = useCallback((params) => {
    gridApiRef.current = params.api

    const topScroll = topScrollRef.current
    const wrapper = gridWrapperRef.current
    if (!topScroll || !wrapper) return

    const agViewport = wrapper.querySelector('.ag-center-cols-viewport')
    const agContainer = wrapper.querySelector('.ag-center-cols-container')
    if (!agViewport || !agContainer) return

    const innerDiv = topScroll.firstChild

    const updateWidth = () => {
      innerDiv.style.width = agContainer.offsetWidth + 'px'
    }
    updateWidth()

    const ro = new ResizeObserver(updateWidth)
    ro.observe(agContainer)

    const onTopScroll = () => {
      if (syncingRef.current) return
      syncingRef.current = true
      agViewport.scrollLeft = topScroll.scrollLeft
      syncingRef.current = false
    }

    const onAgScroll = () => {
      if (syncingRef.current) return
      syncingRef.current = true
      topScroll.scrollLeft = agViewport.scrollLeft
      syncingRef.current = false
    }

    topScroll.addEventListener('scroll', onTopScroll)
    agViewport.addEventListener('scroll', onAgScroll)

    scrollSyncCleanupRef.current = () => {
      topScroll.removeEventListener('scroll', onTopScroll)
      agViewport.removeEventListener('scroll', onAgScroll)
      ro.disconnect()
    }
  }, [])

  const onPaginationChanged = useCallback(() => {
    const api = gridApiRef.current
    if (api) setTotalPages(api.paginationGetTotalPages())
  }, [])

  const onCellMouseOver = useCallback((params) => {
    if (!table) return
    const rowIdx = params.node.rowIndex
    const fields = table.schema.fields
    // data columns 2, 3, 4 → fields at index 1, 2, 3 (field index 0 is the first data col)
    const text = [1, 2, 3]
      .filter(i => i < fields.length)
      .map(i => {
        const key = `${rowIdx}:${i}`
        const col = table.getChild(fields[i].name)
        return edits.has(key) ? edits.get(key) : col?.get(rowIdx)
      })
      .filter(v => v != null && v !== '')
      .join('  ·  ')
    setHoveredRow({ num: rowIdx + 1, text })
  }, [table, edits])

  function goToPage(e) {
    e.preventDefault()
    const api = gridApiRef.current
    if (!api) return
    const val = parseInt(e.currentTarget.elements.page.value, 10)
    if (!isNaN(val) && val >= 1 && val <= totalPages) {
      api.paginationGoToPage(val - 1)
    }
  }

  if (!table) return null

  return (
    <div className="grid-wrapper" ref={gridWrapperRef} onMouseLeave={() => setHoveredRow(null)}>
      {popup && (
        <RecordPopup
          meta={popup.meta}
          anchor={popup.anchor}
          onClose={() => setPopup(null)}
        />
      )}
      <div className="grid-toolbar">
        <div className="row-info-bar">
          {hoveredRow && (
            <span>
              <span className="row-info-num">#{hoveredRow.num}</span>
              {hoveredRow.text && <span className="row-info-text"> {hoveredRow.text}</span>}
            </span>
          )}
        </div>
        <button
          type="button"
          className={`goto-toggle${showGoto ? ' goto-toggle--active' : ''}`}
          title={showGoto ? 'Hide page jump' : 'Jump to page'}
          onClick={() => setShowGoto(v => !v)}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <path d="M2 7.5h11M9 3.5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {showGoto && (
          <form className="goto-form" onSubmit={goToPage}>
            <label htmlFor="goto-page">Page</label>
            <input
              id="goto-page"
              name="page"
              type="number"
              min={1}
              max={totalPages}
              placeholder="1"
              className="goto-input"
              autoFocus
            />
            <span className="goto-total">of {totalPages}</span>
            <button type="submit" className="btn btn--primary">Go</button>
            <button type="button" className="btn btn--ghost" onClick={() => setShowGoto(false)}>Hide</button>
          </form>
        )}
      </div>
      <div ref={topScrollRef} className="top-scrollbar">
        <div className="top-scrollbar-inner" />
      </div>
      <AgGridReact
        theme={themeQuartz}
        rowData={rowData}
        columnDefs={colDefs}
        pagination
        paginationPageSize={50}
        domLayout="autoHeight"
        onGridReady={onGridReady}
        onPaginationChanged={onPaginationChanged}
        onCellDoubleClicked={onCellDoubleClicked}
        onCellMouseOver={onCellMouseOver}
        suppressCellFocus
      />
      <div className="row-info-bar row-info-bar--bottom">
        {hoveredRow && (
          <span>
            <span className="row-info-num">#{hoveredRow.num}</span>
            {hoveredRow.text && <span className="row-info-text"> {hoveredRow.text}</span>}
          </span>
        )}
      </div>
    </div>
  )
}
