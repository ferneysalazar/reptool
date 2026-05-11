import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community'
import RecordPopup from './RecordPopup.jsx'
import FormViewPopup from './FormViewPopup.jsx'
import rawMeta from '../data/recordMeta.json'

const metaByRecord = Object.fromEntries(rawMeta.map(m => [m.record, m]))

ModuleRegistry.registerModules([AllCommunityModule])

// Returns true if a cell value contains the word "error" (case-insensitive)
const hasError = (val) => String(val ?? '').toLowerCase().includes('error')

// Inline text input rendered inside a cell when the user double-clicks to edit
function EditingCell({ value, onCommit, onCancel }) {
  const inputRef = useRef(null)

  // Commits on Enter, cancels on Escape
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


export default function DataGrid({ gridData, edits, onEdit, onClear, onDeleteRecords, module }) {
  const [editingCell, setEditingCell] = useState(null)
  const [totalPages, setTotalPages] = useState(0)
  const [showToolbar, setShowToolbar] = useState(false)
  const [filterInput, setFilterInput] = useState('')
  const [filterText, setFilterText] = useState('')
  const [searchMessage, setSearchMessage] = useState(null)
  const [gotoValue, setGotoValue] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showErrorsOnly, setShowErrorsOnly] = useState(false)
  const [allowFormView, setAllowFormView] = useState(false)
  const [allowSelection, setAllowSelection] = useState(false)
  const [selectedCount, setSelectedCount] = useState(0)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleteError, setDeleteError] = useState(false)
  const [spacing, setSpacing] = useState('comfortable')

  // Rebuilds the AG Grid theme whenever the row spacing preference changes
  const gridTheme = useMemo(
    () => themeQuartz.withParams({ rowVerticalPaddingScale: spacing === 'compact' ? 0.5 : 1 }),
    [spacing]
  )
  const [hoveredRow, setHoveredRow] = useState(null)
  const [popup, setPopup] = useState(null)      // { meta, anchor }
  const [formPopup, setFormPopup] = useState(null) // { recordId, rowData }
  const gridApiRef = useRef(null)
  const gridWrapperRef = useRef(null)
  const topScrollRef = useRef(null)
  const menuAnchorRef = useRef(null)
  const syncingRef = useRef(false)
  const scrollSyncCleanupRef = useRef(null)
  const allowFormViewRef = useRef(false)
  const hoveredRecordIdRef = useRef(null)
  // Stable refs so cell renderers always see current selection without being recreated
  const selectedIdsRef = useRef(new Set())
  const selectedRecordsRef = useRef([])

  // Closes the hamburger menu when the user clicks anywhere outside it
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

  // Runs scroll-sync cleanup when the component unmounts
  useEffect(() => () => scrollSyncCleanupRef.current?.(), [])

  // Toggles a row's selection state, refreshes the checkbox column, and updates the counter
  const handleCheckbox = useCallback((id, checked) => {
    const next = new Set(selectedIdsRef.current)
    if (checked) next.add(id)
    else next.delete(id)
    selectedIdsRef.current = next
    selectedRecordsRef.current = [...next].map(recordId => ({ recordId }))
    setSelectedCount(next.size)
    gridApiRef.current?.refreshCells({ columns: ['__checkbox__'], force: true })
  }, [])

  // Builds the AG Grid column definitions from the loaded headers and column types
  const colDefs = useMemo(() => {
    if (!gridData) return []
    const { headers, colTypes = [] } = gridData

    // Checkbox column prepended when record selection mode is active
    const checkboxCol = {
      field: '__checkbox__',
      headerName: '',
      width: 36,
      minWidth: 36,
      maxWidth: 36,
      sortable: false,
      filter: false,
      suppressMovable: true,
      cellStyle: () => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }),
      cellRenderer: (params) => {
        const id = params.data.recordId
        return (
          <input
            type="checkbox"
            checked={selectedIdsRef.current.has(id)}
            onChange={e => handleCheckbox(id, e.target.checked)}
          />
        )
      },
    }

    // Returns true if any cell in the row contains an error value
    const rowHasError = (data) => data && Object.values(data).some(hasError)

    // Fixed row-number column: highlights the row red if any cell has an error,
    // and shows a form-view icon when form view mode is enabled
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
        const showFormIcon = allowFormViewRef.current && hoveredRecordIdRef.current === num
        // Opens the record detail popup anchored to the clicked cell
        function handleClick(e) {
          if (!meta) return
          const rect = e.currentTarget.getBoundingClientRect()
          setPopup({ meta, anchor: { top: rect.top, bottom: rect.bottom, left: rect.left } })
        }
        const numSpan = (
          <span
            className={`row-num-plain${meta ? ' row-num-plain--clickable' : ''}`}
            style={rowHasError(params.data) ? { color: '#dc2626' } : undefined}
            onClick={meta ? handleClick : undefined}
            title={meta ? 'Click to view details' : undefined}
          >
            {num}
          </span>
        )
        if (!showFormIcon) return numSpan
        return (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            {numSpan}
            <span
              className="form-view-icon"
              title="Form view"
              onClick={e => { e.stopPropagation(); setFormPopup({ recordId: num, rowData: params.data }) }}
            >&#x1F5B9;</span>
          </span>
        )
      },
    }

    // One column definition per data header; aligns right for number/date types
    // and renders an inline editor when the cell is in editing state
    const dataCols = headers.map((name, colIdx) => {
      const colType = colTypes[colIdx] ?? 'string'
      const rightAlign = colType === 'number' || colType === 'date'
      return {
        field: name,
        headerName: name,
        editable: false,
        headerClass: rightAlign ? 'ag-right-aligned-header' : undefined,
        cellStyle: (params) => ({
          textAlign: rightAlign ? 'right' : 'left',
          ...(hasError(params.value) ? { background: '#fff1f1' } : {}),
        }),
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
      }
    })

    return allowSelection ? [checkboxCol, rowNumCol, ...dataCols] : [rowNumCol, ...dataCols]
  }, [gridData, editingCell, onEdit, allowSelection, handleCheckbox])

  // Merges pending edits into the base rows and applies active filters
  const rowData = useMemo(() => {
    if (!gridData) return []
    const { headers, rows } = gridData

    let result = rows

    // Overlay any user-edited cell values onto the original row objects
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

    // Filter rows by error flag and/or search term (both conditions must be satisfied when active).
    // Search always scans the full row regardless of showErrorsOnly.
    if (showErrorsOnly || filterText) {
      const term = filterText.toLowerCase()
      result = result.filter(row => {
        if (showErrorsOnly && !headers.some(h => hasError(row[h]))) return false
        if (!filterText) return true
        const rowText = headers.map(h => String(row[h] ?? '')).join(' ').toLowerCase()
        return rowText.includes(term)
      })
    }

    return result
  }, [gridData, edits, showErrorsOnly, filterText])

  // Puts a cell into editing mode on double-click
  const onCellDoubleClicked = useCallback((params) => {
    if (!params.colDef.field) return
    setEditingCell({ recordId: params.data.recordId, field: params.colDef.field })
  }, [])

  // Wires up the top mirror scrollbar so it stays in sync with the AG Grid viewport
  const onGridReady = useCallback((params) => {
    gridApiRef.current = params.api

    const topScroll = topScrollRef.current
    const wrapper = gridWrapperRef.current
    if (!topScroll || !wrapper) return

    const agViewport = wrapper.querySelector('.ag-center-cols-viewport')
    const agContainer = wrapper.querySelector('.ag-center-cols-container')
    if (!agViewport || !agContainer) return

    const innerDiv = topScroll.firstChild

    // Keeps the phantom inner div as wide as the AG Grid content so the scrollbar has range
    const updateWidth = () => {
      innerDiv.style.width = agContainer.offsetWidth + 'px'
    }
    updateWidth()

    const ro = new ResizeObserver(updateWidth)
    ro.observe(agContainer)

    // Propagates scroll from the top mirror bar down to the AG Grid viewport
    const onTopScroll = () => {
      if (syncingRef.current) return
      syncingRef.current = true
      agViewport.scrollLeft = topScroll.scrollLeft
      syncingRef.current = false
    }

    // Propagates scroll from the AG Grid viewport up to the top mirror bar
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

  // Keeps the total page count in sync after pagination events;
  // clears selection so it only applies within the current page
  const onPaginationChanged = useCallback(() => {
    const api = gridApiRef.current
    if (!api) return
    setTotalPages(api.paginationGetTotalPages())
    if (selectedIdsRef.current.size > 0) {
      selectedIdsRef.current = new Set()
      selectedRecordsRef.current = []
      setSelectedCount(0)
      api.refreshCells({ columns: ['__checkbox__'], force: true })
    }
  }, [])

  // Updates the toolbar hover bar with the first 3 column values of the hovered row
  const onCellMouseOver = useCallback((params) => {
    if (!gridData) return
    const { headers } = gridData
    const id = params.data.recordId
    const text = [0, 1, 2]
      .filter(i => i < headers.length)
      .map(i => {
        const key = `${id}:${i}`
        return edits.has(key) ? edits.get(key) : params.data[headers[i]]
      })
      .filter(v => v != null && v !== '')
      .join('  ·  ')
    setHoveredRow({ num: id, text })
    if (allowFormViewRef.current) {
      hoveredRecordIdRef.current = id
      gridApiRef.current?.refreshCells({ columns: ['recordId'], force: true })
    }
  }, [gridData, edits])

  // Validates the delete count input and, if it matches, removes the selected records
  function handleDeleteConfirm() {
    if (parseInt(deleteInput, 10) !== selectedCount) {
      setDeleteError(true)
      return
    }
    onDeleteRecords([...selectedIdsRef.current])
    selectedIdsRef.current = new Set()
    selectedRecordsRef.current = []
    setSelectedCount(0)
    setShowDeleteDialog(false)
    setDeleteInput('')
    setDeleteError(false)
  }

  // Applies a batch of field changes from the form view popup back to the edit map
  function handleFormSave(recordId, changes) {
    changes.forEach(({ colIdx, value }) => onEdit(recordId, colIdx, value))
  }

  // Validates the search input (min 3 chars) and applies it as the active filter
  function handleSearch() {
    const trimmed = filterInput.trim()
    if (trimmed.length < 3) {
      setSearchMessage('Minimum 3 characters to search')
      setFilterText('')
      return
    }
    setSearchMessage(null)
    setFilterText(trimmed)
  }

  // Navigates the grid to the page number entered in the goto input
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
    <div className="grid-wrapper" ref={gridWrapperRef} onMouseLeave={() => {
      setHoveredRow(null)
      if (allowFormViewRef.current) {
        hoveredRecordIdRef.current = null
        gridApiRef.current?.refreshCells({ columns: ['recordId'], force: true })
      }
    }}>
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
      {showDeleteDialog && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <p className="confirm-dialog__message">You are about to delete {selectedCount} selected record{selectedCount !== 1 ? 's' : ''}.</p>
            <div className="delete-dialog__field">
              <label className="delete-dialog__label" htmlFor="delete-count-input">Number of Records to Delete</label>
              <input
                id="delete-count-input"
                type="text"
                className="delete-dialog__input"
                value={deleteInput}
                autoFocus
                onChange={e => { setDeleteInput(e.target.value); setDeleteError(false) }}
                onKeyDown={e => e.key === 'Enter' && handleDeleteConfirm()}
              />
              {deleteError && <span className="delete-dialog__error">Number of records does not match</span>}
            </div>
            <div className="confirm-dialog__actions">
              <button className="btn btn--ghost" onClick={() => setShowDeleteDialog(false)}>Cancel</button>
              <button className="btn btn--danger" onClick={handleDeleteConfirm}>OK</button>
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
      {formPopup && (
        <FormViewPopup
          recordId={formPopup.recordId}
          headers={gridData.headers}
          initialValues={formPopup.rowData}
          onSave={handleFormSave}
          onClose={() => setFormPopup(null)}
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
        {allowSelection && selectedCount > 0 && (
          <span className="selection-info">
            <span className="selection-count">{selectedCount} selected</span>
            <button
              className="selection-delete-link"
              onClick={() => { setShowDeleteDialog(true); setDeleteInput(''); setDeleteError(false) }}
            >
              delete
            </button>
          </span>
        )}
        {module && (
          <span className={`module-badge module-badge--${module}`}>
            {module.toUpperCase()}
          </span>
        )}
        {showToolbar && (
          <div className="toolbar-controls">
            <div className="search-form">
              <input
                type="text"
                className="search-input"
                placeholder="Search…"
                value={filterInput}
                onChange={e => { setFilterInput(e.target.value); setSearchMessage(null) }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <button
                type="button"
                className="btn"
                style={filterInput ? { background: '#429ae5', color: '#fff' } : { background: '#e5e7eb', color: '#9ca3af' }}
                onClick={handleSearch}
              >
                Search
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => { setFilterInput(''); setFilterText(''); setSearchMessage(null) }}
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
              <button
                type="button"
                className="toolbar-menu__item"
                onClick={() => {
                  const next = !allowFormView
                  setAllowFormView(next)
                  allowFormViewRef.current = next
                  if (!next) {
                    hoveredRecordIdRef.current = null
                    gridApiRef.current?.refreshCells({ columns: ['recordId'], force: true })
                  }
                }}
              >
                <span className="toolbar-menu__check">{allowFormView ? '✓' : ''}</span>
                Allow Form view
              </button>
              <button
                type="button"
                className="toolbar-menu__item"
                onClick={() => {
                  const next = !allowSelection
                  setAllowSelection(next)
                  if (!next) {
                    selectedIdsRef.current = new Set()
                    selectedRecordsRef.current = []
                    setSelectedCount(0)
                  }
                }}
              >
                <span className="toolbar-menu__check">{allowSelection ? '✓' : ''}</span>
                Record selection mode
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
      {(searchMessage || (filterText && rowData.length === 0)) && (
        <div className={`search-message${searchMessage ? ' search-message--warn' : ' search-message--no-results'}`}>
          {searchMessage || `No records found for the search text "${filterText}"`}
        </div>
      )}
      <div ref={topScrollRef} className="top-scrollbar">
        <div className="top-scrollbar-inner" />
      </div>
      <AgGridReact
        theme={gridTheme}
        rowData={rowData}
        columnDefs={colDefs}
        pagination
        paginationPageSize={20}
        paginationPageSizeSelector={[10, 20, 50, 100]}
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
