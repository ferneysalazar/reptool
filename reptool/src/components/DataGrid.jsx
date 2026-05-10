import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community'
import RecordPopup from './RecordPopup.jsx'
import rawMeta from '../data/recordMeta.json'

const metaByRecord = Object.fromEntries(rawMeta.map(m => [m.record, m]))

ModuleRegistry.registerModules([AllCommunityModule])

const hasError = (val) => String(val ?? '').toLowerCase().includes('error')

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


export default function DataGrid({ gridData, edits, onEdit, onClear }) {
  const [editingCell, setEditingCell] = useState(null)
  const [totalPages, setTotalPages] = useState(0)
  const [showToolbar, setShowToolbar] = useState(false)
  const [filterInput, setFilterInput] = useState('')
  const [filterText, setFilterText] = useState('')
  const [gotoValue, setGotoValue] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showErrorsOnly, setShowErrorsOnly] = useState(false)
  const [spacing, setSpacing] = useState('comfortable')

  const gridTheme = useMemo(
    () => themeQuartz.withParams({ rowVerticalPaddingScale: spacing === 'compact' ? 0.5 : 1 }),
    [spacing]
  )
  const [hoveredRow, setHoveredRow] = useState(null)
  const [popup, setPopup] = useState(null) // { meta, anchor }
  const gridApiRef = useRef(null)
  const gridWrapperRef = useRef(null)
  const topScrollRef = useRef(null)
  const menuAnchorRef = useRef(null)
  const syncingRef = useRef(false)
  const scrollSyncCleanupRef = useRef(null)

  useEffect(() => {
    if (!showMenu) return
    function handleOutsideClick(e) {
      if (menuAnchorRef.current && !menuAnchorRef.current.contains(e.target)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showMenu])

  useEffect(() => () => scrollSyncCleanupRef.current?.(), [])

  const colDefs = useMemo(() => {
    if (!gridData) return []
    const { headers } = gridData

    const rowHasError = (data) => data && Object.values(data).some(hasError)

    const rowNumCol = {
      field: 'recordId',
      headerName: '#',
      width: 70,
      minWidth: 70,
      maxWidth: 70,
      sortable: false,
      filter: false,
      suppressMovable: true,
      cellStyle: (params) => ({
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...(rowHasError(params.data) ? { background: '#fff1f1', color: '#dc2626' } : {}),
      }),
      cellRenderer: (params) => {
        const num = params.value
        const meta = metaByRecord[num]
        function handleClick(e) {
          if (!meta) return
          const rect = e.currentTarget.getBoundingClientRect()
          setPopup({ meta, anchor: { top: rect.top, bottom: rect.bottom, left: rect.left } })
        }
        return (
          <span
            className={`row-num-plain${meta ? ' row-num-plain--clickable' : ''}`}
            style={rowHasError(params.data) ? { color: '#dc2626' } : undefined}
            onClick={meta ? handleClick : undefined}
            title={meta ? 'Click to view details' : undefined}
          >
            {num}
          </span>
        )
      },
    }

    const dataCols = headers.map((name, colIdx) => ({
      field: name,
      headerName: name,
      editable: false,
      cellStyle: (params) =>
        hasError(params.value)
          ? { background: '#fff1f1' }
          : null,
      cellRenderer: (params) => {
        const recordId = params.data.recordId
        const isEditing = editingCell?.recordId === recordId && editingCell?.field === name
        if (isEditing) {
          return (
            <EditingCell
              value={params.value}
              onCommit={(val) => {
                onEdit(recordId, colIdx, val)
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
  }, [gridData, editingCell, onEdit])

  const rowData = useMemo(() => {
    if (!gridData) return []
    const { headers, rows } = gridData

    let result = rows

    if (edits.size) {
      result = rows.map(row => {
        const id = row.recordId
        const hasEdit = headers.some((_, c) => edits.has(`${id}:${c}`))
        if (!hasEdit) return row
        const newRow = { ...row }
        for (let c = 0; c < headers.length; c++) {
          const key = `${id}:${c}`
          if (edits.has(key)) newRow[headers[c]] = edits.get(key)
        }
        return newRow
      })
    }

    if (showErrorsOnly || filterText) {
      const term = filterText.toLowerCase()
      result = result.filter(row => {
        const errorCols = headers.filter(h => hasError(row[h]))
        if (showErrorsOnly && errorCols.length === 0) return false
        if (!filterText) return true
        const searchCols = showErrorsOnly ? errorCols : headers
        return searchCols.some(h => String(row[h] ?? '').toLowerCase().includes(term))
      })
    }

    return result
  }, [gridData, edits, showErrorsOnly, filterText])

  const onCellDoubleClicked = useCallback((params) => {
    if (!params.colDef.field) return
    setEditingCell({ recordId: params.data.recordId, field: params.colDef.field })
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
    if (!gridData) return
    const { headers } = gridData
    const id = params.data.recordId
    const text = [1, 2, 3]
      .filter(i => i < headers.length)
      .map(i => {
        const key = `${id}:${i}`
        return edits.has(key) ? edits.get(key) : params.data[headers[i]]
      })
      .filter(v => v != null && v !== '')
      .join('  ·  ')
    setHoveredRow({ num: id, text })
  }, [gridData, edits])

  function goToPage(e) {
    e.preventDefault()
    const api = gridApiRef.current
    if (!api) return
    const val = parseInt(gotoValue, 10)
    if (!isNaN(val) && val >= 1 && val <= totalPages) {
      api.paginationGoToPage(val - 1)
    }
    setGotoValue('')
  }

  if (!gridData) return null

  return (
    <div className="grid-wrapper" ref={gridWrapperRef} onMouseLeave={() => setHoveredRow(null)}>
      {showConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <p className="confirm-dialog__message">Clear all loaded data?</p>
            <div className="confirm-dialog__actions">
              <button className="btn btn--ghost" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn btn--danger" onClick={() => { setShowConfirm(false); onClear() }}>Clear</button>
            </div>
          </div>
        </div>
      )}
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
        {showToolbar && (
          <div className="toolbar-controls">
            <div className="search-form">
              <input
                type="text"
                className="search-input"
                placeholder="Search…"
                value={filterInput}
                onChange={e => setFilterInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && setFilterText(filterInput)}
              />
              <button
                type="button"
                className="btn"
                style={filterInput ? { background: '#429ae5', color: '#fff' } : { background: '#e5e7eb', color: '#9ca3af' }}
                onClick={() => setFilterText(filterInput)}
              >
                Search
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => { setFilterInput(''); setFilterText('') }}
              >
                Reset
              </button>
            </div>
            <div className="toolbar-separator" />
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
                value={gotoValue}
                onChange={e => setGotoValue(e.target.value)}
              />
              <span className="goto-total">of {totalPages}</span>
              <button
                type="submit"
                className="btn"
                style={gotoValue ? { background: '#429ae5', color: '#fff' } : { background: '#e5e7eb', color: '#9ca3af' }}
              >
                Go
              </button>
            </form>
          </div>
        )}
        <div className="toolbar-menu-anchor" ref={menuAnchorRef}>
          <button
            type="button"
            className={`hamburger-btn${showMenu ? ' hamburger-btn--active' : ''}`}
            aria-label="Menu"
            onClick={() => setShowMenu(v => !v)}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <path d="M2 4.5h11M2 7.5h11M2 10.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          {showMenu && (
            <div className="toolbar-menu">
              <button
                type="button"
                className="toolbar-menu__item"
                onClick={() => setShowToolbar(v => !v)}
              >
                <span className="toolbar-menu__check">{showToolbar ? '✓' : ''}</span>
                Show toolbar
              </button>
              <button
                type="button"
                className="toolbar-menu__item"
                onClick={() => setShowErrorsOnly(v => !v)}
              >
                <span className="toolbar-menu__check">{showErrorsOnly ? '✓' : ''}</span>
                Show errors only
              </button>
              <div className="toolbar-menu__divider" />
              <button
                type="button"
                className="toolbar-menu__item"
                onClick={() => setSpacing('comfortable')}
              >
                <span className="toolbar-menu__check">{spacing === 'comfortable' ? '✓' : ''}</span>
                Comfortable mode
              </button>
              <button
                type="button"
                className="toolbar-menu__item"
                onClick={() => setSpacing('compact')}
              >
                <span className="toolbar-menu__check">{spacing === 'compact' ? '✓' : ''}</span>
                Compact mode
              </button>
              <div className="toolbar-menu__divider" />
              <button
                type="button"
                className="toolbar-menu__item toolbar-menu__item--danger"
                onClick={() => { setShowMenu(false); setShowConfirm(true) }}
              >
                <span className="toolbar-menu__check" />
                Clear data
              </button>
            </div>
          )}
        </div>
      </div>
      <div ref={topScrollRef} className="top-scrollbar">
        <div className="top-scrollbar-inner" />
      </div>
      <AgGridReact
        theme={gridTheme}
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
