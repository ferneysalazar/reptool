# Changelog

## Unreleased

### Added
- **Record selection** — "Record selection" toggle in the toolbar menu adds a checkbox column to the left of the record number; selected row count shown as subtle text in the toolbar; selection state stored in memory (`selectedIdsRef` / `selectedRecordsRef`) for use by future features; selection is scoped to the current page and automatically cleared on page navigation
- **Row search** — Search button (or Enter) filters the grid by looking for the search text in the full concatenation of all column values per row (space-separated); requires a minimum of 3 characters, shows a yellow warning otherwise; shows a red "No records found" message when no rows match; Reset clears the filter and any message
- **Column type alignment** — number and date columns are right-aligned (header and cells); text columns remain left-aligned; alignment is derived from the `colTypes` array now included in worker messages
- `colTypes` array added to the `preview` and `complete` worker messages so the datagrid can use type metadata without re-deriving it from the module definition

### Changed
- Hover bar now shows the **first 3 data columns** (indices 0–2) instead of columns 2–4
- Default pagination page size changed from 50 to **20 rows**
- Header row scan extended from 2 rows to **10 rows** to tolerate files with metadata rows above the column headers
- Module detection (`matchesModule`) now checks only up to the number of columns the file actually has, preventing false negatives on partial exports; requires at least 4 columns to distinguish FATCA from CRS
- Search now fires on **button click or Enter** instead of on every keystroke; input change clears any pending validation message
- Search always scans all column values of a row even when **Show errors only** is active — both filters are independent and stack (error rows that also match the search term)
- Added brief description comments to all methods in `DataGrid`, `DropZone`, `RecordPopup`, `FormViewPopup` and `excelWorker`

### Added
- **Form view popup** — "Allow Form view" toggle in the toolbar menu; when active, hovering a row shows a 🖹 icon in the record number cell; clicking it opens a modal with all columns listed as label + input rows (vertical scrollbar for 50+ fields); "Update Record" applies only changed values to the grid via the existing edit mechanism; "Cancel" closes without saving
- `Account Balance` and all `*Amount` columns typed as `number`; all `*Date` and `Date of Birth` columns typed as `date` in both module arrays
- **FATCA / CRS module detection** — on file load the worker scans XLSX sheets (4th → 1st) or CSV rows for a known header signature, then validates all columns positionally using a normalised `contains` check (trims, lowercases, collapses internal whitespace) to tolerate extra characters like `*` or multi-space gaps
- When a module is detected, canonical column names from `fatcaModuleColumns` / `crsModuleColumns` replace the raw file headers in the grid; columns beyond the module array length are discarded
- Excel serial date conversion — date-typed columns (`type: "date"`) whose raw cell value is a number are automatically converted to `YYYY/MM/DD` using the Excel epoch (Dec 30 1899, UTC)
- Module badge in the datagrid toolbar (purple for FATCA, blue for CRS) and in the status bar; unrecognised files show a red warning
- Column headers prefixed with the column group (`AH`, `CP`) when a module is detected; account columns with no group are left unprefixed
- `moduleColumns.js` — two exported arrays (`fatcaModuleColumns`, `crsModuleColumns`) where each entry carries `columnNumber`, `columnName`, `type` (`string` | `date`), and `group` (`AH` | `CP` | `""`)

### Added
- **Show errors only** toggle in the toolbar menu — filters the grid to rows with at least one error cell; edits on filtered rows persist correctly using `recordId` as the stable key
- **Show toolbar** toggle (renamed from "Show go to page") — reveals a two-component toolbar row with a search filter and a go-to-page form separated by a vertical divider
- Search component: text input + Search button (blue when input has text, gray when empty) + Reset button that clears the filter
- Go-to-page button turns blue when the input has a value and resets to gray after navigating
- Error cells now show a soft `#fff1f1` red background instead of red side borders
- Record number column on error rows: soft red background with red text; non-error rows keep default styling
- `recordId` property (1-based) embedded in every row by the worker at load time, used as the stable row identity for edit tracking and row numbering — survives pagination and future filtering without index drift
- Row number column now bound to `field: 'recordId'` instead of a computed `valueGetter`, so AG Grid reads the value directly from the row data

### Added
- Toolbar hamburger menu replacing the old arrow-button toggle, consolidating grid options in one place
- **Comfortable mode / Compact mode** spacing toggle in the toolbar menu — mutually exclusive options that switch AG Grid's `rowVerticalPaddingScale` between `1` (8 px padding/side) and `0.5` (4 px padding/side)
- Menu divider separating navigation options from display options
- Outside-click handler to dismiss the toolbar menu

### Changed
- "Show go to page" moved into the hamburger menu
- Toolbar menu minimum width increased to 216 px

## 2025-05-07

### Added
- Error badge padding adjusted for better vertical centering
- Top scrollbar scroll sync wired in `onGridReady`
- Record metadata popup showing error/warning details on row number click

## Earlier

- README
- Error cell and row number highlighting in red
- Go-to-page control as on-demand toggle
- CSV support, file confirmation screen, and row number column
- AG Grid rendering fixes and Web Worker error handling
- Excel import via Web Worker, Apache Arrow, and AG Grid
- Initial Vite + React scaffold
