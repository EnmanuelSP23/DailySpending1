# Spec: Weekly Earnings Feature

## Overview

Add the ability to track weekly earnings alongside existing spending records. Earnings are stored in a separate "Earnings" tab in the same Google Spreadsheet, with a dedicated form and summary card.

---

## UI Changes

### Summary Section

Add a 4th card to the summary row:

```
[Today] [This Week] [This Month] [Earnings This Week]
```

- Label: "Earnings This Week"
- ID: `#sum-earnings`
- Green accent color to distinguish from spending cards
- Calculates total earnings for the current week (Monday–Sunday)

### Earnings Form Panel

New `<section>` inserted after the "Add Spending" panel and before "Spending Flow":

```html
<section class="panel add-panel">
    <h2>Add Earnings</h2>
    <form id="earnings-form">
        <input type="number" id="earn-amount" step="0.01" min="0.01"
               placeholder="Amount" required>
        <input type="date" id="earn-date" required>
        <button type="submit">Add Earnings</button>
    </form>
    <p id="earn-form-msg" class="msg" hidden></p>
</section>
```

Fields:

| Field | ID | Type | Required | Notes |
|-------|----|------|----------|-------|
| Amount | `earn-amount` | number | Yes | `step="0.01"`, `min="0.01"` |
| Date | `earn-date` | date | Yes | HTML date picker, defaults to today |

---

## Backend API

### New file: `netlify/functions/earnings.js`

Shared utilities imported from `goog.js`:
- `valuesGet`, `valuesAppend`, `getSpreadsheet`, `batchUpdate`

Constants:
```
EARNINGS = 'Earnings'
EARNINGS_HEADERS = ['Amount', 'Date']
```

### GET `/api/earnings`

1. Ensure "Earnings" tab exists (create with headers if missing)
2. Read `Earnings!A:B`
3. Skip header row, filter out empty rows
4. Return `{ records: [{ amount, date }, ...] }`

### POST `/api/earnings`

Request body:
```json
{
    "amount": "25.50",
    "date": "2026-09-01"
}
```

Validation:
- `amount` — must parse to a finite number > 0
- `date` — must match `/^\d{4}-\d{2}-\d{2}$/` (YYYY-MM-DD)

Processing:
1. Ensure "Earnings" tab exists
2. Append row `[amount, date]` to `Earnings!A:B`
3. Return `{ ok: true }`

### Redirect (`netlify.toml`)

```toml
[[redirects]]
  from = "/api/earnings"
  to = "/.netlify/functions/earnings"
  status = 200
```

---

## Spreadsheet Structure

### New "Earnings" tab

| Column A | Column B |
|----------|----------|
| Amount   | Date     |

Row 1 = headers, data starts at row 2.

---

## Frontend Logic (`app.js`)

### New state

```js
let allEarnings = [];
```

### New functions

```js
async function loadEarnings()
```
- `GET /api/earnings`
- Stores result in `allEarnings`

```js
function renderEarningsSummary()
```
- Calculates the Monday–Sunday range for the current week
- Sums all earnings within that range
- Updates `#sum-earnings` text content

### Earnings form handler

- On submit: `POST /api/earnings` with `{ amount, date }`
- On success: clear inputs, call `loadEarnings()`, call `renderEarningsSummary()`, show success message
- On error: show error message

### `init()` updates

- Call `loadEarnings()` (alongside existing `loadRecords()`)
- Call `renderEarningsSummary()` (alongside existing `renderSummary()`)
- Attach submit listener to `#earnings-form`

---

## Styling (`styles.css`)

### Earnings card accent

```css
.card.card-earnings {
    border-left: 3px solid var(--success);
}
```

### Earnings form inputs

Reuses existing `#add-form input` styles. Two approaches:
1. Change selectors to class-based (`.add-form input`) for both forms
2. Add duplicate selectors for `#earnings-form input`

Recommended: **Option 1** — refactor `#add-form` to `.add-form` class, apply to both forms.

---

## Files Changed

| File | Action |
|------|--------|
| `netlify/functions/earnings.js` | Create |
| `netlify.toml` | Edit (add redirect) |
| `public/index.html` | Edit (add card + panel) |
| `public/app.js` | Edit (earnings logic) |
| `public/styles.css` | Edit (earnings card + form styles) |
