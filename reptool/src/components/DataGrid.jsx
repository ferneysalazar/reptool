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


export default function DataGrid({ gridData, edits, onEdit }) {
  const [editingCell, setEditingCell] = useState(null)
  const [totalPages, setTotalPages] = useState(0)
  const [showGoto, setShowGoto] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
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

    const dataCols = headers.map((name, colIdx) => ({
      field: name,
      headerName: name,
      editable: false,
      cellStyle: (params) =>
        hasError(params.value)
          ? { borderLeft: '3px solid #dc2626', borderRight: '3px solid #dc2626' }
          : null,
      cellRenderer: (params) => {
        const rowIdx = params.node.rowIndex
        const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.field === name
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
  }, [gridData, editingCell, onEdit])

  const rowData = useMemo(() => {
    if (!gridData) return []
    const { headers, rows } = gridData
    if (!edits.size) return rows
    return rows.map((row, i) => {
      const hasEdit = headers.some((_, c) => edits.has(`${i}:${c}`))
      if (!hasEdit) return row
      const newRow = { ...row }
      for (let c = 0; c < headers.length; c++) {
        const key = `${i}:${c}`
        if (edits.has(key)) newRow[headers[c]] = edits.get(key)
      }
      return newRow
    })
  }, [gridData, edits])

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
    if (!gridData) return
    const { headers, rows } = gridData
    const rowIdx = params.node.rowIndex
    const text = [1, 2, 3]
      .filter(i => i < headers.length)
      .map(i => {
        const key = `${rowIdx}:${i}`
        return edits.has(key) ? edits.get(key) : rows[rowIdx]?.[headers[i]]
      })
      .filter(v => v != null && v !== '')
      .join('  ·  ')
    setHoveredRow({ num: rowIdx + 1, text })
  }, [gridData, edits])

  function goToPage(e) {
    e.preventDefault()
    const api = gridApiRef.current
    if (!api) return
    const val = parseInt(e.currentTarget.elements.page.value, 10)
    if (!isNaN(val) && val >= 1 && val <= totalPages) {
      api.paginationGoToPage(val - 1)
    }
  }

  if (!gridData) return null

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
          </form>
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
                onClick={() => setShowGoto(v => !v)}
              >
                <span className="toolbar-menu__check">{showGoto ? '✓' : ''}</span>
                Show go to page
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
