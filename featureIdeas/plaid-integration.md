# Plaid Integration

**Status:** Backlog — not started
**Modules:** Retirement (Overview), Dividends, Alts (partial)
**Priority:** High — eliminates manual data entry; dramatically increases data accuracy and user retention

---

## Problem

Every module currently requires the user to manually enter or import their financial data.
This creates three problems:

1. **Staleness** — balances and holdings go out of date immediately after entry
2. **Friction** — users with many accounts give up before seeing value
3. **Incompleteness** — users under-report because entry is tedious

Plaid connects to 12,000+ financial institutions and returns live account balances,
holdings, transactions, and investment data. It is the standard integration used by
Mint, Empower, Copilot, and every major personal finance app.

---

## What Plaid Provides (relevant to this app)

### Investments product (`/investments/holdings/get`)
- Holdings per account: ticker, quantity, cost basis, current value, institution price
- Security metadata: name, CUSIP, ISIN, ticker symbol, security type (equity, ETF, mutual fund, fixed income, cash)
- Account-level totals: current value, cost basis

### Investment transactions (`/investments/transactions/get`)
- Buy/sell/dividend/interest/transfer events per holding
- Date, amount, quantity, price per share
- Transaction type — critically includes `dividend` and `capital gains distribution`

### Accounts product (`/accounts/get`)
- Account name, type (investment, IRA, Roth IRA, 401k, brokerage, etc.), subtype
- Current balance and available balance
- Institution name

### Identity (optional, later)
- Verify account ownership — useful if sharing features are added

---

## Architecture

### Plaid Link flow (standard)

```
1. User clicks "Connect account"
2. Frontend calls Cloud Function: plaidCreateLinkToken
   → Plaid API: /link/token/create
   → Returns link_token (short-lived, single-use)
3. Frontend opens Plaid Link (their JS widget) with the token
4. User selects institution, enters credentials in Plaid's iframe
   (credentials NEVER touch our servers — Plaid handles them)
5. On success, Plaid Link returns a public_token to the frontend
6. Frontend calls Cloud Function: plaidExchangeToken({ public_token })
   → Plaid API: /item/public_token/exchange
   → Returns access_token (permanent, stored encrypted in Firestore)
7. Cloud Function stores access_token + item_id in:
   profile/{uid}/plaid-items/{itemId}
8. First sync triggered immediately
```

### Token storage

```
profile/{uid}/plaid-items/{itemId}
  itemId: string                    ← Plaid item ID
  institutionId: string
  institutionName: string
  accessToken: string               ← encrypted at rest; never returned to client
  status: "active" | "error" | "reauth_required"
  lastSynced: timestamp
  consentedAt: timestamp
  accounts: [{ accountId, name, type, subtype, mask }]
```

`accessToken` is the only secret. Store it encrypted using Cloud KMS or Firebase
Secret Manager envelope encryption. Never include it in any API response.

### Sync strategy

**On-demand sync** (Phase 1): user clicks "Sync now" → Cloud Function fetches latest
data from Plaid and writes to Firestore.

**Scheduled sync** (Phase 2): Cloud Scheduler triggers a sync function every 24 hours
for all active items. Runs server-side with no user interaction required.

**Webhook sync** (Phase 3): Plaid pushes `HOLDINGS_DEFAULT_UPDATE` and
`TRANSACTIONS_DEFAULT_UPDATE` webhooks when data changes. Near-real-time updates.

---

## Data Model

### Connected holdings (written by sync function)

```
profile/{uid}/plaid-holdings/{holdingId}
  itemId: string
  accountId: string
  accountName: string
  accountType: string               ← "ira", "401k", "brokerage", etc.
  ticker: string | null             ← null for non-ticker securities
  securityName: string
  securityType: string              ← "equity", "etf", "mutual fund", etc.
  quantity: number
  costBasis: number | null          ← Plaid provides this for most brokerages
  institutionValue: number          ← current market value per Plaid
  institutionPrice: number          ← price per share
  institutionPriceAsOf: date
  syncedAt: timestamp
```

### Connected dividend transactions (written by sync function)

```
profile/{uid}/plaid-transactions/{txId}
  itemId: string
  accountId: string
  ticker: string | null
  securityName: string
  type: "dividend" | "capital_gains_distribution" | "interest" | ...
  date: YYYY-MM-DD
  amount: number
  syncedAt: timestamp
```

---

## Module Integration

### Retirement (Overview)

The retirement module currently asks for manually entered balances per sleeve.
With Plaid:

- **Auto-populate account balances** from connected investment accounts
- **Map accounts to sleeves**: user assigns each Plaid account to a retirement sleeve
  (Alpha, Index, Alts, etc.) — one-time setup, persists across syncs
- **Live totals**: sleeve balances update automatically on each sync
- No more manual balance updates

Mapping UI:

```
┌─────────────────────────────────────────────┐
│ Connected accounts                          │
│                                             │
│ Fidelity 401k (·1234)        → Index sleeve │
│ Schwab Brokerage (·5678)     → Alpha sleeve │
│ Vanguard IRA (·9012)         → Index sleeve │
│ Fidelity Roth IRA (·3456)    → [Unassigned] │
└─────────────────────────────────────────────┘
```

### Dividends

- **Auto-import dividend transactions** from Plaid investment transaction history
  instead of requiring Excel upload
- Deduplicate against manually-entered payments (match on ticker + date + amount)
- Ongoing sync keeps the dividend log current without any user action
- Existing manual import (Excel) remains available as a fallback for accounts
  Plaid doesn't support (private brokerages, foreign accounts)

### Alts

Plaid coverage for alternative investments is limited — most alts custodians
(Juniper Square, iCapital, Carta) are not in Plaid's network. Manual entry
remains the primary path for alts. However:

- **Cash accounts**: capital calls paid from a connected checking account could be
  detected as outflows and surfaced as suggested cash flow entries
- **Out of scope for initial phases** — note here for future consideration

---

## Implementation Phases

### Phase 1 — Connect + manual sync
- Plaid Link widget integration
- `plaidCreateLinkToken`, `plaidExchangeToken`, `plaidSync` Cloud Functions
- Store holdings and dividend transactions in Firestore
- "Connected accounts" section in Profile page
- "Sync now" button — user-triggered refresh
- Dividends: show Plaid-sourced payments alongside manual ones (badge to distinguish source)

### Phase 2 — Retirement sleeve mapping
- Account-to-sleeve assignment UI in Retirement module
- Auto-populate sleeve balances from Plaid holdings
- Sync runs on schedule (Cloud Scheduler, daily)

### Phase 3 — Webhooks + re-auth flow
- Plaid webhook endpoint (Cloud Function HTTP trigger) for push updates
- Re-authentication flow when `ITEM_LOGIN_REQUIRED` webhook arrives
  (institution changed credentials, MFA expired, etc.)
- User notification when an item needs re-auth

---

## Compliance and Legal

Plaid integration has non-trivial legal requirements:

### Terms of Service
- Must agree to Plaid's **Developer Agreement** and **End User Privacy Policy**
- End users must explicitly consent to Plaid's data use — the Plaid Link widget
  handles this with a built-in consent screen

### Privacy Policy update required
- App's privacy policy must disclose that financial data is collected via Plaid
- Must describe what data is stored, how long, and user deletion rights
- **Do not launch Plaid integration without updating the privacy policy**

### Data minimization
- Only fetch and store what the app uses (holdings + dividend transactions)
- Do not store raw Plaid responses — extract and store only the fields above
- Honor Plaid's data deletion requirements when a user disconnects an item

### Plaid account tiers
- **Sandbox**: free, test credentials only, unlimited calls — use for development
- **Development**: free, up to 100 real Items (live user accounts) — use for beta
- **Production**: paid per Item per month — required before public launch
  Production approval requires Plaid to review the app and its privacy policy

---

## Files to create / change

| File | Change |
|---|---|
| `functions/src/plaid/createLinkToken.js` | Cloud Function — generate Plaid Link token |
| `functions/src/plaid/exchangeToken.js` | Cloud Function — exchange public_token, store access_token |
| `functions/src/plaid/sync.js` | Cloud Function — fetch holdings + transactions, write to Firestore |
| `functions/src/plaid/webhook.js` | Cloud Function (HTTP) — handle Plaid push events (Phase 3) |
| `functions/src/index.js` | Export new functions |
| `firestore.rules` | Rules for `plaid-items`, `plaid-holdings`, `plaid-transactions` |
| `src/pages/Profile.jsx` | "Connected accounts" section — connect, view status, disconnect, sync |
| `src/pages/Dividends.jsx` | Show Plaid-sourced payments; replace/supplement Excel import CTA |
| `src/pages/Overview.jsx` | Account-to-sleeve mapping UI; auto-populate sleeve balances |
| `package.json` (functions) | Add `plaid` Node SDK |

---

## Open Questions

- **Plaid pricing at scale**: Development tier supports 100 Items free. At ~$0.30–$1.50
  per Item/month in Production (varies by product), model costs before launch.
- **Plaid Link on mobile web**: Plaid Link works in mobile browsers but OAuth
  institutions (Chase, Wells Fargo, etc.) redirect through the bank's app — requires
  `redirectUri` configuration and careful handling on iOS/Android WebView.
- **401k data quality**: Some 401k providers have poor Plaid coverage (holdings without
  tickers, estimated balances only). Design the sleeve-mapping UI to handle partial data.
- **Historical transactions**: Plaid returns up to 24 months of investment transaction
  history on first connect. Display an import summary ("Found 847 dividend payments
  going back to Jan 2023") before committing to Firestore.
