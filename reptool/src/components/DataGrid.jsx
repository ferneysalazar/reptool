import { useMemo, useState, useCallback, useRef } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community'

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
  const [editingCell, setEditingCell] = useState(null) // { rowIdx, field }

  const colDefs = useMemo(() => {
    if (!table) return []

    const rowNumCol = {
      headerName: '#',
      valueGetter: (params) => params.node.rowIndex + 1,
      width: 70,
      minWidth: 70,
      maxWidth: 70,
      sortable: false,
      filter: false,
      suppressMovable: true,
      cellStyle: { color: '#888', fontVariantNumeric: 'tabular-nums' },
    }

    const dataCols = table.schema.fields.map((f, colIdx) => ({
      field: f.name,
      headerName: f.name,
      editable: false,
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
    if (!params.colDef.field) return // row number column has no field
    setEditingCell({ rowIdx: params.node.rowIndex, field: params.colDef.field })
  }, [])

  if (!table) return null

  return (
    <div className="grid-wrapper">
      <AgGridReact
        theme={themeQuartz}
        rowData={rowData}
        columnDefs={colDefs}
        pagination
        paginationPageSize={50}
        domLayout="autoHeight"
        onCellDoubleClicked={onCellDoubleClicked}
        suppressCellFocus
      />
    </div>
  )
}
