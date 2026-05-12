# FIRE Reporting Tool Help

## Loading Data

Drop an Excel (.xlsx) or CSV file onto the drop zone. The tool detects the module type (FATCA or CRS) automatically and maps columns accordingly. A preview of the first 100 rows appears immediately while the rest loads in the background.

## Searching Records

Use the search bar in the toolbar (enable it from the menu with **Show toolbar**).

- Type at least 3 characters and press **Enter** or click **Search** to filter rows by any column value.
- Click **Reset** to clear the search and show all records.

### Filter Mode

Prefix your search text with `filter:` to apply a named filter instead of a text search. 

| Filter | What it shows |
| --- | --- |
| `filter:individuals` | Rows with Individual account holders only |
| `filter:entities` | Rows with a Entity/Orgnization account holders only |
| `filter:organization` | Same as entities |
| `filter:edited` | Only records that have been edited in this session |
| `filter:errors` | Records flagged with an error value in any column |

## Editing Records

Double-click any data cell to edit it inline. Press **Enter** to confirm or **Escape** to cancel. Edited records are tracked for the session and counted in the status bar.

## Navigating Pages

Use the **Page / Go** control in the toolbar to jump directly to any page number.

## Record Details

Click a row number to open a details popup showing any validation errors or warnings associated with that record (requires metadata to be loaded for that record).

## Form View

Enable **Allow Form view** from the menu. When active, hovering over a row number shows a form icon. Click it to open a full-field edit form for that record.

## Record Selection

Enable **Record selection mode** from the menu to show checkboxes on each row. Select records and use the **delete** link that appears to remove them permanently from the loaded data.

## Errors

Enable **Show errors only** from the menu to filter the grid to rows that contain at least one error value. This works independently of the search filter.

## Row Spacing

Switch between **Comfortable** and **Compact** row height from the menu.

## Clearing Data

Select **Clear data** from the menu to unload the current file. If there are unsaved edits you will be asked to confirm by entering the record count.
