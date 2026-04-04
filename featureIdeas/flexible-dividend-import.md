# Flexible Dividend Import

**Status:** Backlog — not started
**Module:** Dividends
**Priority:** Medium — broadens user base beyond a single brokerage format

## Implementation Estimate

| Phase | Scope | Estimate |
|---|---|---|
| Phase 1 | Extend alias lists, add `detectColumns` unit tests for each broker format | 2–3 hours |
| Phase 2 | Column mapping UI step inside `ImportDialog`, integration tests | 1–2 days |
| **Total** | Both phases | **~2 days** |

**Complexity notes:**
- Phase 1 is a pure data change — no UI, no new functions, tests write themselves
- Phase 2 adds one new step to an existing dialog; the parser is already format-agnostic so the work is entirely UI state and three dropdowns
- No backend changes required for either phase

## Cost

**No ongoing costs.** This feature has no third-party integrations. All logic runs
client-side or in existing Cloud Functions. ExcelJS (already in the project) handles
parsing. No new npm packages, no APIs, no subscriptions required.

---

## Problem

The current Excel/CSV import uses a fixed alias list to detect the Date, Ticker, and Amount
columns. If a file's headers don't match the known aliases, the import is rejected entirely.
This works for one tested format but fails silently for users from other brokerages.

---

## Proposed Solution (two phases, implement in sequence)

### Phase 1 — Extend auto-detection aliases

Expand the alias lists in `detectColumns()` (`src/pages/Dividends.jsx`) to cover the
column names used by major brokerages. No UI changes required — detection just becomes
more permissive.

**Date aliases to add:**
- `settlement date`, `settledate`, `trade date`, `tradedate`, `date/time`, `datetime`,
  `transaction date`

**Ticker aliases to add:**
- `security`, `cusip`, `description` (last resort — some brokers put the ticker in description)

**Amount aliases to add:**
- `amount ($)`, `transactionamount`, `transaction amount`, `dividends`, `net amount`,
  `netamount`, `credit`, `debit` (credit-only rows)

**Brokerage coverage after Phase 1:**

| Broker | Date column | Ticker column | Amount column |
|---|---|---|---|
| Fidelity | `Settlement Date` | `Symbol` | `Amount ($)` |
| Schwab | `Date` | `Symbol` | `Amount` |
| Vanguard | `Trade date` | `Symbol` | `Transaction Amount` |
| IBKR | `Date/Time` | `Symbol` | `Amount` |
| TD Ameritrade | `Date` | `Symbol` | `Amount` |
| E*Trade / Morgan Stanley | `Date` | `Symbol` | `Amount` |

E*Trade accounts held at Morgan Stanley use the same export format post-merger.
The standard E*Trade CSV export uses headers `Date`, `Symbol`, and `Amount` — already
covered by the base aliases, but the Morgan Stanley brokerage statement export uses
`Transaction Date`, `Security`, and `Net Amount` — needs the extended aliases above.

### Phase 2 — Column mapping step (fallback UI)

When auto-detection fails or produces uncertain matches, show a mapping step between
file upload and the preview. This ensures **no valid file is ever rejected** — users
with custom spreadsheets or unsupported brokerages can always proceed.

#### Flow

```
Step 1: Upload file
        ↓
        Auto-detect column mapping
        ↓
        All 3 found?
       /           \
     Yes            No (or user clicks "Change columns")
      ↓              ↓
Step 2: Preview   Step 2: Map columns  →  Step 3: Preview
      ↓                                         ↓
Step 3: Import                           Step 4: Import
```

#### Mapping UI

Three dropdowns pre-populated with the auto-detected column (or blank if not found).
All headers from the file are available in each dropdown.

```
Which column is the payment date?     [ Settlement Date  ▾ ]  ← auto-detected
Which column is the ticker/symbol?    [ Symbol           ▾ ]  ← auto-detected
Which column is the payment amount?   [ Please select…   ▾ ]  ← not found, required
```

- Show a sample of the first 3 values under each selected column so the user can
  confirm they picked the right one
- "Back" returns to file upload
- "Continue" is disabled until all three are mapped
- The mapping is not persisted — users re-map on each import (keeping it simple for now)

---

## Implementation Notes

- `detectColumns()` in `src/pages/Dividends.jsx` — extend alias arrays (Phase 1)
- `ImportDialog` in `src/pages/Dividends.jsx` — add `"map"` step between `"pick"` and
  `"preview"` (Phase 2); only shown when detection is incomplete or user overrides
- `parseFile()` is already format-agnostic — it returns raw headers + rows; mapping
  is applied downstream, so Phase 2 requires no changes to the parser
- CSV support: `parseFile()` currently uses ExcelJS which handles `.xlsx` and `.xls`.
  CSV would need a separate code path (e.g. `papaparse`) — out of scope for both phases
  but a natural Phase 3

---

## Files to change

| File | Change |
|---|---|
| `src/pages/Dividends.jsx` | Extend `DATE_ALIASES`, `TICKER_ALIASES`, `AMOUNT_ALIASES`; add `"map"` step to `ImportDialog` |
| `src/utils/__tests__/dividendsChart.test.js` | Add `detectColumns` unit tests for each new brokerage format |
