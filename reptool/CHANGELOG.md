# Changelog

## Unreleased

### Changed
- Removed Apache Arrow dependency entirely — worker now builds plain JS row objects directly and sends them via structured clone; DataGrid consumes them without any intermediate columnar representation, eliminating the duplicate in-memory copy
- `rowData` fast-path: when there are no edits the original rows array is passed to AG Grid by reference with no re-allocation

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
