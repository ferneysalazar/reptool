# reptool

A fast, browser-based spreadsheet viewer and editor for Excel and CSV files.

## Features

- Drag-and-drop or click to load `.xlsx`, `.xls`, and `.csv` files
- Instant preview while the full file loads in the background via a Web Worker
- High-performance data grid powered by AG Grid and Apache Arrow
- Inline cell editing with change tracking
- Row numbers with red highlighting for error rows
- Pagination with on-demand go-to-page control
- No server required — everything runs in the browser

## Tech Stack

- [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- [AG Grid Community](https://www.ag-grid.com/) — data grid
- [Apache Arrow](https://arrow.apache.org/docs/js/) — columnar in-memory format
- [SheetJS (xlsx)](https://sheetjs.com/) — Excel parsing
- [PapaParse](https://www.papaparse.com/) — CSV parsing
- Web Workers — non-blocking file processing

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173, then drop an Excel or CSV file onto the page.

## Build

```bash
npm run build
npm run preview
```
