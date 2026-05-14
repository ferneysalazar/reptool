import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community'
import RecordPopup from './RecordPopup.jsx'
import FormViewPopup from './FormViewPopup.jsx'
import HelpPopup from './HelpPopup.jsx'
import CountrySelectPopup from './CountrySelectPopup.jsx'
import ListSelectPopup from './ListSelectPopup.jsx'
import { FATCA_STATUSES } from '../data/fatcaStatuses.js'
import { CRS_STATUSES } from '../data/crsStatuses.js'
import { ACCOUNT_NUMBER_TYPES } from '../data/accountNumberTypes.js'
import { ACCOUNT_TYPES } from '../data/accountTypes.js'
import TransferListPopup from './TransferListPopup.jsx'
import rawMeta from '../data/recordMeta.json'

const BASE_URL = 'http://localhost:8765'
const VALIDATE_URL = `${BASE_URL}/fire/dataForm/validateAndProcess`
const POLL_INTERVAL_MS = 3000

// Maps column index (0-based, matching fatcaCrsModuleColumns order) to API payload field name
const COL_TO_API = [
  'firstName', 'lastName', 'entityName', 'dateBirth',
  'taxResidenceCountry', 'countryIdTIN', 'countryCode',
  'status', 'crsStatus',
  'fixAddressBuilding', 'fixAddressStreetName', 'fixAddressFloor', 'fixAddressSuite',
  'fixAddressCity', 'fixAddressState', 'fixAddressPostal', 'fixAddressCountryCode',
  'freeAddress', 'freeAddressCountryCode',
  'entityControllingPersonFirstName', 'entityControllingPersonLastName',
  'entityControllingPersonDateBirth', 'entityControllingPersonCountryIdTIN',
  'entityControllingPersonCountryCode', 'entityControllingPersonType',
  'entityControllingPersonTaxResidence',
  'entityControllingPersonFixAddressBuilding', 'entityControllingPersonFixAddressStreetName',
  'entityControllingPersonFixAddressFloor', 'entityControllingPersonFixAddressSuite',
  'entityControllingPersonFixAddressCity', 'entityControllingPersonFixAddressState',
  'entityControllingPersonFixAddressPostal', 'entityControllingPersonFixAddressCountryCode',
  'entityControllingPersonFreeAddress', 'entityControllingPersonFreeAddressCountryCode',
  'accountNumber', 'currencyCode', 'accountBalance', 'balanceAsOfDate',
  'accountType', 'accountNumberType', 'openingDate', 'closingDate',
  'balanceInterest', 'balanceInterestDate',
  'balanceGrossProceeds', 'balanceGrossProceedsDate',
  'balanceDividends', 'balanceDividendsDate',
  'balanceOthers', 'balanceOthersDate',
]

function buildPayload(rows, headers, module, institutionUkId, reportingYear, onlyValidate) {
  const listDataForm = rows.map(row => {
    const item = {
      info: '', numberRow: row.recordId, uniqueKeyId: '',
      entityControllingPersonUniqueKeyId: '', entityControllingPersonAddressType: '',
      accountUniqueKeyId: '', fails: {},
    }
    headers.forEach((headerName, idx) => {
      const apiField = COL_TO_API[idx]
      if (apiField) item[apiField] = row[headerName] ?? ''
    })
    return item
  })
  return {
    listDataForm,
    isDeleteAll: true,
    isFatcaModule: module === 'fatca',
    institutionUkId,
    reportingYear: Number(reportingYear),
    onlyValidate,
  }
}

const metaByRecord = Object.fromEntries(rawMeta.map(m => [m.record, m]))

ModuleRegistry.registerModules([AllCommunityModule])


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


// Columns that open a dedicated popup editor instead of the inline text input.
// Key = header field name, value = popup type identifier.
const POPUP_EDITOR_COLS = {
  'AH TIN Country Code': 'country',
  'AH Country Code': 'country',
  'CP Country code': 'country',
  'AH FATCA Status': 'fatcaStatus',
  'AH CRS Status': 'crsStatus',
  'Account Number Type': 'accountNumberType',
  'Account Type': 'accountType',
  'AH Tax Residence Country': 'transferCountry',
  'CP Tax residences': 'transferCountry',
}

export default function DataGrid({ gridData, edits, onEdit, onClear, onDeleteRecords, module }) {
  const [editingCell, setEditingCell] = useState(null)
  const [popupEdit, setPopupEdit] = useState(null) // { recordId, colIdx, field, anchor }
  const [totalPages, setTotalPages] = useState(0)
  const [showToolbar, setShowToolbar] = useState(true)
  const [filterInput, setFilterInput] = useState('')
  const [filterText, setFilterText] = useState('')
  const [filterMode, setFilterMode] = useState(null) // 'individuals'|'entities'|'edited'|'errors'|'selected'
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
  const [showProcessDialog, setShowProcessDialog] = useState(false)
  const [processMode, setProcessMode] = useState('all') // 'all' | 'selected'
  const [processInput, setProcessInput] = useState('')
  const [processError, setProcessError] = useState(false)
  const [institutionUkId, setInstitutionUkId] = useState('')
  const [reportingYear, setReportingYear] = useState('')
  const [validateLoading, setValidateLoading] = useState(false)
  const [validateResult, setValidateResult] = useState(null)
  const [validationErrors, setValidationErrors] = useState(new Map()) // recordId → string[]
  const [clearInput, setClearInput] = useState('')
  const [clearError, setClearError] = useState(false)
  const [spacing, setSpacing] = useState('comfortable')
  const [showHelp, setShowHelp] = useState(false)

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

    const rowIsErrored = (data) =>
      Array.isArray(data?.__validationErrors__) && data.__validationErrors__.length > 0

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
        ...(rowIsErrored(params.data) ? { background: '#fff1f1', color: '#dc2626' } : {}),
      }),
      cellRenderer: (params) => {
        const num = params.value
        const meta = metaByRecord[num]
        const validErrs = params.data.__validationErrors__
        const hasValidErrs = Array.isArray(validErrs) && validErrs.length > 0
        const isClickable = hasValidErrs || !!meta
        const showFormIcon = allowFormViewRef.current && hoveredRecordIdRef.current === num
        // Opens a popup anchored to the clicked cell; validation errors take priority over static meta
        function handleClick(e) {
          if (!isClickable) return
          const rect = e.currentTarget.getBoundingClientRect()
          const anchor = { top: rect.top, bottom: rect.bottom, left: rect.left }
          if (hasValidErrs) {
            setPopup({ meta: { record: num, errorList: validErrs, warningList: [], modified: false }, anchor })
          } else {
            setPopup({ meta, anchor })
          }
        }
        const numSpan = (
          <span
            className={`row-num-plain${isClickable ? ' row-num-plain--clickable' : ''}`}
            style={rowIsErrored(params.data) ? { color: '#dc2626' } : undefined}
            onClick={isClickable ? handleClick : undefined}
            title={hasValidErrs ? 'Click to view validation errors' : meta ? 'Click to view details' : undefined}
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

  const editedIds = useMemo(() => {
    const ids = new Set()
    for (const key of edits.keys()) ids.add(parseInt(key.split(':')[0], 10))
    return ids
  }, [edits])

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

    if (filterMode) {
      const firstNameCol = 'AH First Name'
      const lastNameCol = 'AH Last Name'
      const entityNameCol = 'AH Entity Name'
      const nonEmpty = (row, col) => col && String(row[col] ?? '').trim() !== ''

      if (filterMode === 'individuals') {
        result = result.filter(row => nonEmpty(row, firstNameCol) || nonEmpty(row, lastNameCol))
      } else if (filterMode === 'entities') {
        result = result.filter(row =>
          nonEmpty(row, entityNameCol) && !nonEmpty(row, firstNameCol) && !nonEmpty(row, lastNameCol)
        )
      } else if (filterMode === 'edited') {
        result = result.filter(row => editedIds.has(row.recordId))
      } else if (filterMode === 'errors') {
        result = result.filter(row => validationErrors.has(row.recordId))
      }
    }

    // Filter rows by error flag and/or search term (both conditions must be satisfied when active).
    // Search always scans the full row regardless of showErrorsOnly.
    if (showErrorsOnly || filterText) {
      const term = filterText.toLowerCase()
      result = result.filter(row => {
        if (showErrorsOnly && !validationErrors.has(row.recordId)) return false
        if (!filterText) return true
        const rowText = headers.map(h => String(row[h] ?? '')).join(' ').toLowerCase()
        return rowText.includes(term)
      })
    }

    // Overlay validation error arrays onto rows returned by the server
    if (validationErrors.size > 0) {
      result = result.map(row => {
        const errs = validationErrors.get(row.recordId)
        return errs ? { ...row, __validationErrors__: errs } : row
      })
    }

    return result
  }, [gridData, edits, showErrorsOnly, filterText, filterMode, editedIds, selectedCount, validationErrors])

  // Puts a cell into editing mode on double-click; popup-editor columns open a floating popup
  const onCellDoubleClicked = useCallback((params) => {
    const field = params.colDef.field
    if (!field) return
    const recordId = params.data.recordId
    if (POPUP_EDITOR_COLS[field]) {
      const colIdx = gridData?.headers.indexOf(field) ?? -1
      const rect = params.event.target.closest('.ag-cell')?.getBoundingClientRect() ?? params.event.target.getBoundingClientRect()
      setPopupEdit({ recordId, colIdx, field, currentValue: params.value ?? '', anchor: { top: rect.top, bottom: rect.bottom, left: rect.left } })
    } else {
      setEditingCell({ recordId, field })
    }
  }, [gridData])

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

  // Validates the process count input and, if it matches the expected count, calls the API then polls for completion
  async function handleProcessConfirm() {
    const isSelected = processMode === 'selected'
    const targetRows = isSelected
      ? rowData.filter(r => selectedIdsRef.current.has(r.recordId))
      : rowData
    const expectedCount = isSelected ? selectedCount : rowData.length

    if (parseInt(processInput, 10) !== expectedCount) {
      setProcessError(true)
      return
    }
    setShowProcessDialog(false)
    setProcessInput('')
    setProcessError(false)
    setValidateLoading(true)
    setValidateResult({ phase: 'sending' })
    setValidationErrors(new Map())

    try {
      const payload = buildPayload(targetRows, gridData.headers, module, institutionUkId, reportingYear, isSelected)
      console.log('[validateAndProcess] mode:', processMode, 'rows:', targetRows.length, 'payload:', payload)

      const res = await fetch(VALIDATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const text = await res.text()
        setValidateResult({ phase: 'error', message: `Server error ${res.status}: ${text}` })
        return
      }

      const data = await res.json()
      const pollPath = data.url          // e.g. "/dataForm/checkDataFormProcess?id=24"
      const processId = data.response?.processId

      let state = data.response?.state
      let errors = data.response?.errorList ?? []

      while (state !== 'VALIDATED' && state !== 'READY') {
        setValidateResult({ phase: 'polling', processId })
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
        const pollRes = await fetch(BASE_URL + pollPath)
        if (!pollRes.ok) throw new Error(`Poll error ${pollRes.status}`)
        const pollData = await pollRes.json()
        state  = pollData.response?.state
        errors = pollData.response?.errorList ?? []
      }

      // READY = success, VALIDATED = done (errors possible); populate grid with error info
      if (errors.length > 0) {
        const errMap = new Map()
        errors.forEach(e => errMap.set(Number(e.record), e.errors))
        setValidationErrors(errMap)
      }
      setValidateResult({ phase: 'done', state, errors, onlyValidate: isSelected })
    } catch (err) {
      setValidateResult({ phase: 'error', message: err.message })
    } finally {
      setValidateLoading(false)
    }
  }

  // Validates the clear count input and, if it matches the total loaded records, clears all data
  function handleClearConfirm() {
    if (parseInt(clearInput, 10) !== gridData.rows.length) {
      setClearError(true)
      return
    }
    setShowConfirm(false)
    setClearInput('')
    setClearError(false)
    setValidationErrors(new Map())
    setValidateResult(null)
    onClear()
  }

  // Applies a batch of field changes from the form view popup back to the edit map
  function handleFormSave(recordId, changes) {
    changes.forEach(({ colIdx, value }) => onEdit(recordId, colIdx, value))
  }

  const FILTER_KEYWORDS = { indiv: 'individuals', entit: 'entities', organ: 'entities', edite: 'edited', error: 'errors' }

  // Validates the search input (min 3 chars) and applies it as the active filter,
  // or parses a "filter:<keyword>" prefix to activate a named filter mode.
  function handleSearch() {
    const trimmed = filterInput.trim()
    if (trimmed.toLowerCase().startsWith('filter:')) {
      const keyword = trimmed.slice(7).trim().toLowerCase().slice(0, 5)
      const mode = FILTER_KEYWORDS[keyword]
      if (!mode) {
        setSearchMessage('Unknown filter. Valid: individuals, entities, organization, edited, errors')
        return
      }
      setSearchMessage(null)
      setFilterText('')
      setFilterMode(mode)
      return
    }
    setFilterMode(null)
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
            <p className="confirm-dialog__message">You are about to clear {gridData.rows.length.toLocaleString()} loaded record{gridData.rows.length !== 1 ? 's' : ''}. This action cannot be undone.</p>
            <div className="delete-dialog__field">
              <label className="delete-dialog__label" htmlFor="clear-count-input">Number of Records to Clear</label>
              <input
                id="clear-count-input"
                type="text"
                className="delete-dialog__input"
                value={clearInput}
                autoFocus
                onChange={e => { setClearInput(e.target.value); setClearError(false) }}
                onKeyDown={e => e.key === 'Enter' && handleClearConfirm()}
              />
              {clearError && <span className="delete-dialog__error">Number of records does not match</span>}
            </div>
            <div className="confirm-dialog__actions">
              <button className="btn btn--ghost" onClick={() => { setShowConfirm(false); setClearInput(''); setClearError(false) }}>Cancel</button>
              <button className="btn btn--danger" onClick={handleClearConfirm}>Clear</button>
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
      {showProcessDialog && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <p className="confirm-dialog__message">
              {processMode === 'selected'
                ? `You are about to validate ${selectedCount} selected record${selectedCount !== 1 ? 's' : ''}.`
                : `You are about to ingest and process ${rowData.length} record${rowData.length !== 1 ? 's' : ''}.`}
            </p>
            <div className="delete-dialog__field">
              <label className="delete-dialog__label" htmlFor="process-institution-input">Institution UK ID</label>
              <input
                id="process-institution-input"
                type="text"
                className="delete-dialog__input"
                value={institutionUkId}
                autoFocus
                placeholder="e.g. 24"
                onChange={e => setInstitutionUkId(e.target.value)}
              />
            </div>
            <div className="delete-dialog__field">
              <label className="delete-dialog__label" htmlFor="process-year-input">Reporting Year</label>
              <input
                id="process-year-input"
                type="number"
                className="delete-dialog__input"
                value={reportingYear}
                placeholder="e.g. 2026"
                onChange={e => setReportingYear(e.target.value)}
              />
            </div>
            <div className="delete-dialog__field">
              <label className="delete-dialog__label" htmlFor="process-count-input">{processMode === 'selected' ? 'Number of Selected Records to Validate' : 'Number of Records to Process'}</label>
              <input
                id="process-count-input"
                type="text"
                className="delete-dialog__input"
                value={processInput}
                onChange={e => { setProcessInput(e.target.value); setProcessError(false) }}
                onKeyDown={e => e.key === 'Enter' && handleProcessConfirm()}
              />
              {processError && <span className="delete-dialog__error">Number of records does not match</span>}
            </div>
            <div className="confirm-dialog__actions">
              <button className="btn btn--ghost" onClick={() => setShowProcessDialog(false)}>Cancel</button>
              <button className="btn btn--primary" onClick={handleProcessConfirm}>OK</button>
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
      {popupEdit && POPUP_EDITOR_COLS[popupEdit.field] === 'country' && (
        <CountrySelectPopup
          value={popupEdit.currentValue}
          anchor={popupEdit.anchor}
          onCommit={(val) => { onEdit(popupEdit.recordId, popupEdit.colIdx, val); setPopupEdit(null) }}
          onCancel={() => setPopupEdit(null)}
        />
      )}
      {popupEdit && POPUP_EDITOR_COLS[popupEdit.field] === 'fatcaStatus' && (
        <ListSelectPopup
          items={FATCA_STATUSES}
          value={popupEdit.currentValue}
          anchor={popupEdit.anchor}
          onCommit={(val) => { onEdit(popupEdit.recordId, popupEdit.colIdx, val); setPopupEdit(null) }}
          onCancel={() => setPopupEdit(null)}
        />
      )}
      {popupEdit && POPUP_EDITOR_COLS[popupEdit.field] === 'crsStatus' && (
        <ListSelectPopup
          items={CRS_STATUSES}
          value={popupEdit.currentValue}
          anchor={popupEdit.anchor}
          onCommit={(val) => { onEdit(popupEdit.recordId, popupEdit.colIdx, val); setPopupEdit(null) }}
          onCancel={() => setPopupEdit(null)}
        />
      )}
      {popupEdit && POPUP_EDITOR_COLS[popupEdit.field] === 'accountNumberType' && (
        <ListSelectPopup
          items={ACCOUNT_NUMBER_TYPES}
          value={popupEdit.currentValue}
          anchor={popupEdit.anchor}
          onCommit={(val) => { onEdit(popupEdit.recordId, popupEdit.colIdx, val); setPopupEdit(null) }}
          onCancel={() => setPopupEdit(null)}
        />
      )}
      {popupEdit && POPUP_EDITOR_COLS[popupEdit.field] === 'accountType' && (
        <ListSelectPopup
          items={ACCOUNT_TYPES}
          value={popupEdit.currentValue}
          anchor={popupEdit.anchor}
          onCommit={(val) => { onEdit(popupEdit.recordId, popupEdit.colIdx, val); setPopupEdit(null) }}
          onCancel={() => setPopupEdit(null)}
        />
      )}
      {popupEdit && POPUP_EDITOR_COLS[popupEdit.field] === 'transferCountry' && (
        <TransferListPopup
          value={popupEdit.currentValue}
          anchor={popupEdit.anchor}
          onCommit={(val) => { onEdit(popupEdit.recordId, popupEdit.colIdx, val); setPopupEdit(null) }}
          onCancel={() => setPopupEdit(null)}
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
      {showHelp && <HelpPopup onClose={() => setShowHelp(false)} />}
      {validateResult && (
        <div className={`validate-result-bar${validateResult.phase === 'error' || (validateResult.phase === 'done' && validateResult.errors?.length > 0) ? ' validate-result-bar--error' : ''}`}>
          {validateResult.phase === 'sending' && <span>Sending to server…</span>}
          {validateResult.phase === 'polling' && <span>Processing… polling process #{validateResult.processId}</span>}
          {validateResult.phase === 'done' && validateResult.errors.length === 0 && (
            <span>✓ {validateResult.onlyValidate ? 'Validation' : 'Process'} completed successfully</span>
          )}
          {validateResult.phase === 'done' && validateResult.errors.length > 0 && (
            <span>✗ {validateResult.onlyValidate ? 'Validation' : 'Process'} completed — some issues found in {validateResult.errors.length} record{validateResult.errors.length !== 1 ? 's' : ''} (see grid)</span>
          )}
          {validateResult.phase === 'error' && <span>✗ {validateResult.message}</span>}
          {(validateResult.phase === 'done' || validateResult.phase === 'error') && (
            <button className="btn btn--ghost" style={{ marginLeft: 12, padding: '2px 10px', fontSize: 12 }} onClick={() => setValidateResult(null)}>Dismiss</button>
          )}
        </div>
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
                onClick={() => { setFilterInput(''); setFilterText(''); setFilterMode(null); setSearchMessage(null) }}
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
                disabled={!allowSelection || selectedCount === 0}
                onClick={() => { setShowMenu(false); setProcessMode('selected'); setShowProcessDialog(true); setProcessInput(''); setProcessError(false) }}
              >
                <span className="toolbar-menu__check" />
                Validate Selected
              </button>
              <button
                type="button"
                className="toolbar-menu__item"
                onClick={() => { setShowMenu(false); setProcessMode('all'); setShowProcessDialog(true); setProcessInput(''); setProcessError(false) }}
              >
                <span className="toolbar-menu__check" />
                Validate and Process
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
                onClick={() => { setShowMenu(false); if (editedIds.size === 0) { onClear() } else { setClearInput(''); setClearError(false); setShowConfirm(true) } }}
              >
                <span className="toolbar-menu__check" />
                Clear data
              </button>
              <div className="toolbar-menu__divider" />
              <button
                type="button"
                className="toolbar-menu__item"
                onClick={() => { setShowMenu(false); setShowHelp(true) }}
              >
                <span className="toolbar-menu__check" />
                Help
              </button>
            </div>
          )}
        </div>
      </div>
      {(searchMessage || (filterText && rowData.length === 0) || (filterMode && rowData.length === 0)) && (
        <div className={`search-message${searchMessage ? ' search-message--warn' : ' search-message--no-results'}`}>
          {searchMessage || (filterMode ? `No records found for filter: ${filterMode}` : `No records found for the search text "${filterText}"`)}
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
