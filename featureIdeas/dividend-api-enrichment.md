# Dividend API Enrichment

**Status:** Backlog — not started
**Module:** Dividends
**Priority:** High — transforms the module from a payment tracker into a dividend health dashboard

## Implementation Estimate

| Phase | Scope | Estimate |
|---|---|---|
| Phase 1 | Secret Manager setup, `getEnrichment` + `refreshTicker` Cloud Functions, next ex-date + pay date + annualized rate only, ticker card UI update | 3–4 days |
| Phase 2 | Multi-year CAGR computation, FCF coverage ratio, earnings/CF growth, full ticker card health section, unit tests for all helpers | 3–4 days |
| Phase 3 | Weighted portfolio averages, streak badge, portfolio health score | 2 days |
| **Total** | All phases | **~2 weeks** |

**Complexity notes:**
- Secret Manager + FMP API wiring is the highest-risk step — account for setup time and sandbox testing
- CAGR computation across 1/3/5/10 year windows requires careful handling of tickers with short history (IPOs, spinoffs) — null-safe throughout
- FMP rate limits: a user with 50 tickers triggers 50+ API calls on first load; the shared cache mitigates this but the first-user-per-ticker path needs backoff and queuing logic
- ETF and international ticker edge cases will surface during testing; budget a half day for those fixes

## Cost

### Financial Modeling Prep (FMP)

| Tier | Price | API calls/day | Endpoints available | Suitable for |
|---|---|---|---|---|
| Free | $0/month | 250 | Basic quote + profile only | Development / personal use only |
| Starter | $19/month | Unlimited | Dividend history, income statement, cash flow | Phase 1 + Phase 2 ✓ |
| Professional | $49/month | Unlimited | All Starter + bulk endpoints, priority support | Phase 3 + scale |
| Enterprise | Custom | Unlimited | Dedicated infrastructure, SLA | High traffic |

**Recommended plan: Starter ($19/month)**
- Covers all endpoints needed for Phases 1 and 2
- Free tier's 250 calls/day limit is exhausted by a single user with ~80 tickers
  (each ticker requires 3–4 endpoint calls for the full enrichment set)
- The shared Firestore cache significantly reduces call volume after the first fetch
  per ticker — a portfolio of 50 unique tickers generates ~200 FMP calls once,
  then zero calls for 24 hours regardless of how many users view those tickers

**Projected monthly FMP cost by user count:**

| Active users | Unique tickers (est.) | Monthly FMP cost |
|---|---|---|
| 1–5 (personal / beta) | ~100 | **$19/month** (Starter) |
| 10–50 | ~300 | **$19/month** (Starter, cache absorbs volume) |
| 50–500 | ~1,000 | **$19–$49/month** (monitor cache hit rate) |
| 500+ | 2,000+ | **$49+/month** — evaluate bulk endpoints |

The shared cache is the key cost control: once any user triggers a fetch for AAPL,
all subsequent users that day get it from Firestore at zero FMP cost.

### Firebase (existing project)
- Firestore reads/writes for the enrichment cache are negligible at this scale
- No additional Firebase plan upgrade required

### Monetization dependency

**Personal use:** The free tier (250 calls/day) is likely sufficient for a single user.
If the portfolio grows beyond ~80 unique tickers, upgrade to Starter ($19/month) — still
a trivial personal expense.

**Multi-user:** FMP Starter ($19/month) covers the shared cache up to roughly 500 users
before call volume warrants moving to Professional. At that scale the app needs revenue.
Typical approach: gate the Dividend Health enrichment section behind a paid plan tier
(e.g. $8–$12/month), keeping basic payment tracking free. The $19 FMP cost is easily
covered by a handful of paying subscribers.

---

## Problem

The current Dividends module tracks what the user has *received* but says nothing about
dividend quality or sustainability. A user cannot answer questions like:
- Is this company growing its dividend or cutting it?
- Can the company actually afford the dividend it's paying?
- When is the next payment?

---

## Proposed Solution

Use **Financial Modeling Prep (FMP)** as the primary data provider to enrich each ticker
in the user's portfolio with dividend quality metrics. Data is fetched server-side
(Cloud Function) and cached in Firestore to avoid redundant API calls and to keep the
API key off the client.

FMP offers a free tier (250 calls/day) and paid tiers. Most metrics needed here are
available on the Starter plan (~$19/month).

---

## Data Points to Fetch Per Ticker

| Field | FMP Endpoint | Notes |
|---|---|---|
| Dividend growth rate — 1 yr | `/historical-price-full/stock_dividend` | Computed from trailing 12-month comparison |
| Dividend growth rate — 3 yr | same | CAGR over 3 years of annual dividend totals |
| Dividend growth rate — 5 yr | same | CAGR over 5 years |
| Dividend growth rate — 10 yr | same | CAGR over 10 years; null if history too short |
| Dividend rate (annualized) | `/profile` or `/quote` | Forward annual dividend per share |
| Next ex-dividend date | `/stock_dividend_calendar` or `/profile` | Date user must hold by to receive next payment |
| Next payment date | `/historical-price-full/stock_dividend` | Most recent declared future pay date |
| Cash flow dividend coverage ratio | `/cash-flow-statement` | Free cash flow ÷ total dividends paid |
| Earnings growth — 1, 3, 5 yr | `/income-statement` | EPS CAGR over each period |
| Cash flow growth — 1, 3, 5 yr | `/cash-flow-statement` | FCF CAGR over each period |

---

## Architecture

### API key management
- FMP API key stored in **Firebase Secret Manager** (`fmp-api-key`)
- Never exposed to the client — all calls go through Cloud Functions
- Key accessed via `defineSecret("FMP_API_KEY")` in the function definition

### Caching strategy
Dividend fundamentals don't change intraday. Cache per ticker in Firestore:

```
dividends-enrichment/{ticker}
  fetchedAt: timestamp
  expiresAt: timestamp          ← fetchedAt + 24h for most fields
  dividendGrowth: {
    1yr, 3yr, 5yr, 10yr         ← null if history too short
  }
  annualizedRate: number
  nextExDate: YYYY-MM-DD
  nextPayDate: YYYY-MM-DD
  cashFlowCoverageRatio: number  ← FCF / dividends paid; > 1.0 = covered
  earningsGrowth: {
    1yr, 3yr, 5yr
  }
  cashFlowGrowth: {
    1yr, 3yr, 5yr
  }
  source: "fmp"
  error: null | string           ← set if fetch failed; UI shows "unavailable"
```

Cache is shared across all users (ticker-keyed, not user-keyed) so one user's fetch
benefits all others. Refresh on read if `expiresAt` is in the past.

**Expiry rules:**
- `nextExDate`, `nextPayDate` — refresh every 6 hours around ex-date windows
- All other fields — refresh every 24 hours

### New Cloud Functions

```
dividendsGetEnrichment({ tickers: string[] })
  → fetches/refreshes cache for each ticker
  → returns enrichment map keyed by ticker
  → called on page load after plan loads

dividendsRefreshTicker({ ticker: string })
  → force-refresh a single ticker's cache
  → called when user clicks "Refresh" on a ticker card
```

### Frontend integration

1. After `dividendsGetPlan` resolves, call `dividendsGetEnrichment` with the portfolio tickers
2. Store enrichment data in local state alongside the plan
3. Enrich each ticker card with the new metrics
4. Show a staleness indicator if `fetchedAt` is > 24h ago

---

## UI Changes

### Ticker card (expanded view)
Add a "Dividend Health" section below the existing stats:

```
┌─────────────────────────────────────────────────┐
│  AAPL                              $1,240 / yr  │
│  ─────────────────────────────────────────────  │
│  Dividend Growth                                │
│    1 yr   3 yr   5 yr   10 yr                   │
│    +4.2%  +5.1%  +6.8%  +8.3%                  │
│                                                 │
│  Coverage ratio     2.4×   ✓ Well covered       │
│  Earnings growth    +9.1% / +7.4% / +6.2%      │
│  Cash flow growth   +11% / +8.3% / +7.1%       │
│                                                 │
│  Next ex-date   2025-08-09                      │
│  Next pay date  2025-08-15                      │
│                                                 │
│  Data: FMP · Updated 3h ago  [Refresh]         │
└─────────────────────────────────────────────────┘
```

### Coverage ratio health indicator
- `≥ 1.5×` → green "Well covered"
- `1.0–1.5×` → amber "Tight"
- `< 1.0×` → red "At risk" (dividend exceeds free cash flow)

### Dividend growth streak badge
If dividend has grown every year for N consecutive years, show:
`🏅 12-year streak` on the ticker card (computed from the historical dividend data
already fetched for CAGR calculation).

### Portfolio summary
Add a row to the portfolio overview: **Weighted avg dividend growth (3 yr)** across
all held tickers, weighted by the user's actual received income per ticker.

---

## Error handling

- Ticker not found in FMP (e.g. ETFs, REITs with non-standard tickers, foreign ADRs):
  metrics show "—" with a tooltip "Data unavailable for this security"
- FMP rate limit hit: queue remaining tickers, retry with backoff; show partial data
- Stale cache (fetch failed last time): show last known data with a warning badge

---

## Implementation Phases

### Phase 1 — Cache + next dates only
Fetch and display `nextExDate`, `nextPayDate`, and `annualizedRate` only.
Simplest FMP endpoints, high user value (never miss an ex-date).

### Phase 2 — Growth rates + coverage
Add dividend growth CAGRs and cash flow coverage ratio.
Requires parsing multi-year income/cashflow statements.

### Phase 3 — Portfolio-level aggregation
Weighted average growth, streak badges, portfolio health score.

---

## Files to create / change

| File | Change |
|---|---|
| `functions/src/dividends/getEnrichment.js` | New Cloud Function — fetch + cache enrichment |
| `functions/src/dividends/refreshTicker.js` | New Cloud Function — force-refresh one ticker |
| `functions/src/index.js` | Export new functions |
| `firestore.rules` | Allow read on `dividends-enrichment/{ticker}` (public cache) |
| `src/pages/Dividends.jsx` | Call `getEnrichment` on load; render health section on ticker cards |
| `src/utils/dividendsEnrichment.js` | Pure helpers: CAGR computation, coverage ratio label, streak detection |
| `src/utils/__tests__/dividendsEnrichment.test.js` | Unit tests for all helpers |

---

## Open Questions

- **FMP plan**: free tier (250 calls/day) is likely insufficient at scale since each
  ticker needs several endpoint calls. Budget for Starter plan before shipping.
- **ETF treatment**: ETFs pay distributions, not dividends — FMP coverage is spottier.
  Consider a separate data path or graceful degradation.
- **International tickers**: FMP supports some ADRs and foreign listings but coverage
  is inconsistent. Flag non-US tickers in the UI.
- **Alternative providers**: Alpha Vantage, Polygon.io, and Quandl cover similar data.
  FMP is recommended for dividend-specific endpoints but the Cloud Function abstraction
  makes swapping providers straightforward.
