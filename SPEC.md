# Holistic Suite — Product Spec

A unified personal finance planning app. One login, one domain, modular planners
that compose into a single picture.

---

## Goals & Non-Goals

### Why this exists
A personal tool built to meet specific, real needs:

1. **Alternative investments** — the alts ecosystem is fractured. Fund portals, emails,
   PDFs, capital call notices scattered everywhere. One place to record transactions
   (calls, distributions, return of capital), compute IRR, maintain a calendar of expected
   events, and eventually run vetting workflows on new opportunities.

2. **Dividends** — track dividend income across holdings over time. Build something
   better than the sites that exist today.

3. **College planning** — endowment-style multi-child funding model. Already the furthest
   built. Bring it forward cleanly.

4. **Holistic view** — how do all these plans make sense together? The dashboard and
   Overview module answer that question.

5. **Investments** — portfolio modeling. Depth TBD. Potential hook to a financial
   data provider (market data, not brokerage execution).

### Explicit non-goals (v1)
- Not a live brokerage API integration
- Not a budgeting or spending tracker
- Not a tax filing tool
- Not financial advice — a tool to help think, not to prescribe
- Not mobile-optimized (v2)
- Not a public product — personal tool first

---

## Architecture

### Principles
1. **API-driven** — React components never write to Firestore directly. All reads and
   writes go through the API layer. This makes every data operation testable in isolation
   and creates a clean boundary for future extraction into microservices.

2. **Aggregation at the API layer** — the dashboard and Overview never compute totals
   from raw data in the browser. Each module exposes a `getSummary` endpoint; the
   dashboard calls them in parallel and assembles the result.

3. **Empty state by design** — every module's default view is its empty state. A new
   user landing on `/alts` for the first time sees a purposeful, designed empty state —
   not a broken UI. Empty states are first-class screens.

4. **Plan versions** — every module supports multiple named plans per user. One plan
   is marked active; the active plan feeds the dashboard and Overview. Users can create,
   name, duplicate, and delete plans freely.

5. **Module-first, profile-second** — the first question asked is "what do you want to
   see?" (module selection), not "tell us about yourself." Profile data is collected only
   when a module needs it, and only the minimum that module requires. Profile is always
   editable; nothing is locked in at setup.

6. **Security by default** — all data is private to the owner unless explicitly shared.
   Sharing can be granted and revoked at any time. Every access is audited.

### Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8, React Router v6 |
| UI | shadcn/ui (preset `b22lmTQ0BM`), Tailwind CSS v4, design-tokens |
| API | Firebase Cloud Functions (callable) — one function group per module |
| Database | Firestore (Firebase project `tagge-app-suite-dev`) |
| Auth | Firebase Auth — Google sign-in only |
| Hosting | Firebase Hosting — `holistic-suite.web.app` (dev) → `holistic-view.money` (target, not yet purchased) |
| Fonts | Raleway Variable (headings), Inter Variable (UI), via `@fontsource-variable` |
| Icons | Lucide React |
| Testing | Vitest (unit + integration), Playwright (UI smoke) |
| CI/CD | GitHub Actions |
| Infrastructure | Terraform (pending) — Hosting sites, Firestore rules, Functions, Storage, Pub/Sub, Auth domains |
| File storage | Cloud Storage (future) — PDF uploads, document vetting pipeline |
| Messaging | Pub/Sub (future) — async processing trigger between Storage and Functions |
| AI | Gemini / Claude API (future) — PDF extraction for Alts K-1s, capital call notices |

### API Layer

All callable Cloud Functions follow a standard contract:

```
Request:
  { planId?, ...params }          ← planId optional; omit to target active plan

Response (success):
  { ok: true, data: { ... } }

Response (error):
  { ok: false, error: { code, message, details? } }
```

Every function call:
1. Verifies Firebase Auth token (rejects unauthenticated calls)
2. Verifies the caller owns or has share access to the requested resource
3. Writes an audit log entry (caller uid, action, resource, timestamp, ip)
4. Executes the operation
5. Returns the standard response envelope

**Function groups (one per module + shared):**

```
functions/
  shared/
    getProfile          → read profile/{uid}
    updateProfile       → write profile/{uid}
    monteCarlo.js       → statistical utilities: randomNormal, percentile, computeYearlyBands
                          (not an HTTP function — imported by module runMonteCarlo files)
    getActionItems      → compute + return all action items for active plans
    getAuditLog         → return audit trail for a resource
    shareResource       → grant access (writes to profile/{uid}/shares)
    revokeShare         → remove access

  retirement/
    getProjection       → compute stacked income chart + crossover year
    getPortfolioValue   → compute total AUM over time
    getSummary          → crossover year, % of income target covered (for dashboard)

  shared/ (continued)
    aggregateModules    → call each active module's getSummary, return combined

  college/
    setup               → create/overwrite plan (wizard); runs Monte Carlo; marks college as initialized
    getPlan             → return active college plan document; lazy-backfills monteCarloResult if missing
    updateSavings       → update savings, monthly contrib, annual return, inflationRate, lump sums, loans; re-runs MC
    updateChildren      → update children array (name, birthYear, costTier, annualCostBase); re-runs MC
    getSummary          → inter-module contract: netWorthContribution, metrics, actionItems (for dashboard)

    (planned — not yet built)
    getPlans            → list all plans for user
    createPlan          → create new plan (or duplicate existing)
    deletePlan          → soft-delete a plan
    setActivePlan       → mark a plan as active
    addComment / editComment / deleteComment / getComments → comment thread

  alts/
    getPlans            → list all alt plans
    createPlan / updatePlan / deletePlan / setActivePlan
    addInvestment       → add investment record to a plan
    updateInvestment    → edit investment metadata
    deleteInvestment    → remove investment (with confirmation if has cash flows)
    addCashFlow         → add a cash flow event (call, distribution, exit)
    updateCashFlow / deleteCashFlow
    computeIRR          → run XIRR on a single investment's cash flows
    getSummary          → blended IRR, total committed, total distributions (for dashboard)

  equity/
    getPlans / createPlan / updatePlan / deletePlan / setActivePlan
    addHolding / updateHolding / deleteHolding
    getSummary          → total value, projected income (for dashboard)
    dividends/          → sub-module; same planId scope as equity
      recordDividend    → log a dividend payment event (holdingId, exDate, payDate, amount, type)
      getDividends      → return dividend history for a plan
      getDividendSummary → annual income, YTD received, yield on cost per holding
```

### Inter-Module Data Contract

Each module's `getSummary` returns a standard shape consumed by the dashboard
and Overview:

```js
{
  moduleKey: "college",           // "college" | "alts" | "equity" | "retirement"
  planName: "Baseline Plan",
  activePlanId: "abc123",
  netWorthContribution: 340000,   // total assets owned by this module
  projectedAnnualIncome: 0,       // fed into Overview stacked income chart
  metrics: {                      // module-specific KPIs shown on dashboard card
    // college:   { fundedPct, residual, nextTuitionYear }
    // alts:      { blendedIRR, totalCommitted, totalDistributions, dpi }
    // dividends: { annualIncome, ytdReceived, holdingCount }
  },
  actionItems: [ActionItem],      // module's contribution to the global action items list
  lastViewed: isoTimestamp,       // updated on every visit — drives visitor presence
  lastUpdated: isoTimestamp
}
```

The dashboard calls `shared/aggregateModules` once on mount, which fans out to each active
module's `getSummary` in parallel and returns the combined result. No sequential reads.

---

## Data Architecture

### Plan versioning

Every module supports multiple named plans per user. The active plan is the one
that feeds the dashboard and Overview.

```
users/{uid}/
  {moduleKey}-plans/{planId}
    name: "Baseline"
    isActive: boolean
    createdAt, updatedAt
    data: { ... module-specific fields ... }
```

When a user first opens a module: the API creates a default plan named "Plan 1"
automatically. The empty state is displayed until the user adds data. Creating
a second plan duplicates the active one as a starting point (or starts blank).

### Firestore collections

```
profile/{uid}
  displayName, email           ← seeded from Google auth on first sign-in
  age: number
  targetRetirementYear: number
  activeModules: string[]      ← ["overview", "college", "alts"]
  createdAt, updatedAt

profile/{uid}/shares/{shareId}
  grantedTo: email
  access: "view" | "edit"
  grantedAt, revokedAt?        ← soft delete; revokedAt present = inactive

profile/{uid}/audit/{entryId}
  action: string               ← e.g. "college.updatePlan"
  resource: string             ← e.g. "plans/abc123"
  callerUid: string
  callerEmail: string
  timestamp: isoString
  ip: string

college-plans/{uid}                            ← keyed by ownerUid (one active plan per user now)
  ownerUid, name, isActive, createdAt, updatedAt
  children[]: {
    id, name, birthYear,
    costTier,            ← public-in-state | public-out-of-state | private | elite
    annualCostBase?      ← optional override in today's dollars; if absent, COST_TIER_MAP[costTier] is used
  }
  totalSavings: number
  monthlyContribution: number
  annualReturn: number                            ← decimal (e.g. 0.06 = 6%)
  inflationRate: number                           ← decimal (e.g. 0.03 = 3%); default 3% if absent
  lumpSums[]: { year, amount, label? }
  loans: { totalAmount, rate, termYears } | null
  monteCarloResult: {                             ← cached after every write; computed server-side
    yearlyBands[]: { year, p10, p25, p50, p75, p90, bandBase, bandWidth }
    successRate: number                           ← fraction 0–1
    numSims: number
    stdDev: number
    extraMonthly: number                          ← extra $/mo to reach 90% success; 0 if already ≥90%
    computedAt: isoTimestamp
  }

college-plans/{planId}/comments/{commentId}      ← planned, not yet built
  authorUid, authorEmail, authorName
  text, createdAt, editedAt?
  deletedAt?                   ← soft delete

alts-plans/{planId}
  ownerUid, name, isActive, createdAt, updatedAt
  mode: "sleeve" | "investments"
  sleeve: { irr, currentValue, annualContrib }
  investments: [
    { id, name, vintage, committed, currency,
      projectedIRR, status: "active"|"realized",
      cashFlows: [{ id, date, type, amount, note }]
      // type: "call" | "distribution-income" | "distribution-roc" | "exit"
    }
  ]

dividends-plans/{planId}
  ownerUid, name, isActive, createdAt, updatedAt
  holdings: [{ id, ticker, name, shares, costBasis }]
  dividends: [{ id, holdingId, exDate, payDate, amount, type }]

holistic/{uid}
  ← keep as-is for Overview config (existing data)
  targetIncome, alpha{}, index{}, alts{}, ...
```

### Encryption & backup
- Encryption at rest and in transit: provided by Firebase/GCP by default (AES-256 at rest,
  TLS in transit). No additional configuration required for v1.
- Backups: configure Firestore scheduled exports to Cloud Storage (daily, 30-day retention).
  Set up via GCP console or Terraform — not a code task, but must be done before launch.

---

## Security & Authorization

### Rules
- All data is private to the owner by default. No document is readable by any other user
  unless an active share record exists.
- Firestore security rules enforce this at the database level — the API layer enforces it
  again in code. Defense in depth.
- Shares are soft-deleted (revokedAt timestamp), never hard-deleted, to preserve the audit
  trail.

### Resource authorization — ID enumeration prevention
Every API function that accepts a resource ID (`planId`, `investmentId`, `commentId`, etc.)
performs an explicit ownership check before returning any data:

1. Load the document by ID.
2. If the document does not exist → return `404 Not Found`.
3. If `ownerUid` does not match the caller's UID → check for an active share record.
4. If no active share exists → return `404 Not Found`.
   *(404, not 403 — do not confirm that the resource exists to an unauthorized caller.)*
5. If a share exists but the action requires `"edit"` access and the share is `"view"` →
   return `403 Forbidden`.

Resource IDs are Firestore auto-generated (random 20-character strings). Sequential or
predictable IDs are never used. Changing a planId in a URL or API call to any other value
returns 404 for resources the caller does not own — indistinguishable from a missing resource.

This check is implemented once in a shared `assertAccess(callerUid, docRef, requiredAccess)`
helper and called at the top of every function that touches user data. It is never skipped.

### Sharing model
- Sharing is suite-wide. An owner shares with an email address and grants access to
  specific modules (or all).
- Recipient discovers shared plans via `getProfile` — which queries for shares granted to
  `user.email` across all owner UIDs.
- `access: "view"` — can read all data in granted modules, cannot write
- `access: "edit"` — can read and write plan data in granted modules; cannot create/delete
  plans, cannot share further, cannot revoke

### Comments
- Visible to all users with any share access to the plan (view or edit).
- Author can edit their own comment (editedAt timestamp recorded).
- Author can soft-delete their own comment (deletedAt set; shown as "deleted" placeholder).
- No other user can modify another user's comment.

### Visitor presence
- Every time a user opens a module tab, `getSummary` records `lastViewed` for that module.
- The dashboard shows last-viewed timestamps per active module per shared user.
- Provides lightweight presence awareness without real-time overhead.

### Audit trail
- Every API function call writes an audit entry: who, what, when, which resource.
- Audit log is append-only (no delete, no edit).
- Owner can view the audit log for their own resources. Shared users cannot.

---

## Data Loss Confirmation Pattern

Any action that would cause specific/detailed data to become inaccessible — even
temporarily — requires explicit user confirmation before proceeding. This applies
universally across all modules.

**Triggers the confirmation dialog:**
- Switching from investment mode to sleeve mode (Alts) — hides individual investment records
- Switching from sleeve mode to investment mode when sleeve data exists — hides sleeve config
- Deleting a plan that contains any data
- Deleting an investment or holding that has associated records (cash flows, dividends)
- Resetting a plan to defaults when the plan has been modified

**Confirmation dialog rules:**
- Clearly states what will become inaccessible
- States whether data is recoverable ("Your investment records are preserved and can be
  restored by switching back") or permanent
- Requires an affirmative button click — not dismissible by clicking outside
- Cancel returns to previous state with no changes

**Hard deletes** (permanent) require typing the resource name or "DELETE" to confirm.
Hard deletes are rare — soft delete is the default for all user data.

---

## Error Handling

### Principle
Errors are handled at the API layer and surfaced to the UI via a common pattern.
Components never write their own error handling logic — they consume a standard
error state from a shared hook.

### Standard error codes

| Code | Meaning | Default UI treatment |
|---|---|---|
| `auth/unauthenticated` | No valid session | Redirect to `/` landing page |
| `auth/unauthorized` | Valid session, no access to this resource | Show "Access denied" card |
| `not-found` | Plan or resource doesn't exist | Show empty state for the module |
| `validation-error` | Input failed server-side validation | Inline field error message |
| `computation-error` | Math failed (e.g., XIRR non-convergence) | Show fallback value + warning badge |
| `network-error` | Firestore or Functions offline | Persistent toast: "Working offline — changes will sync when reconnected" |
| `unknown` | Unexpected error | Toast: "Something went wrong" + error ID for debugging |

### Implementation
- `useApi(fn, params)` — shared hook. Returns `{ data, loading, error }`. On error,
  sets `error` to a standard shape `{ code, message }`.
- Global error boundary catches uncaught render errors and shows a full-page fallback
  with "Reload" and "Go home" options.
- All errors logged to the audit trail with error code and stack trace.

---

## UI Patterns

### Pencil icon placement

Use `<Pencil className="h-4 w-4" />` inside a `variant="ghost" size="icon"` Button for edit actions.
Never use a text "Edit" button for section-level editing when a pencil icon fits.

Placement rules:
- **Top-right of a section card** — when clicking opens/edits the entire section
- **Inline next to a specific field** — when clicking edits only that one field

```jsx
// Section-level: top-right of the card header row
<div className="flex items-start justify-between">
  <div>...section content...</div>
  <Button variant="ghost" size="icon" onClick={openEdit} aria-label="Edit section">
    <Pencil className="h-4 w-4" />
  </Button>
</div>

// Field-level: inline in the field row
<div className="flex items-center gap-2">
  <span>{fieldValue}</span>
  <Button variant="ghost" size="icon" onClick={editField} aria-label="Edit field">
    <Pencil className="h-4 w-4" />
  </Button>
</div>
```

### Tab/toggle attention indicator

When an inactive tab or toggle panel contains actionable information the user should see
(e.g. probability of success < 90%, an unread alert, a required action), draw attention
using one of two approaches depending on how prominent the signal needs to be:

**Subtle — amber dot** (for soft suggestions or unread state):
```jsx
<button ...>
  Probability
  {hasAction && isInactive && (
    <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0" />
  )}
</button>
```

**Prominent — amber styled button with value** (for metric-driven warnings like low success rate):
```jsx
<button
  className={
    showAmberWarning && chartView !== "probability"
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded-md px-3 py-1 text-sm font-medium gap-1.5"
      : "... normal tab styles ..."
  }
>
  Probability{showAmberWarning && chartView !== "probability" && ` · ${pct}%`}
</button>
```

Rules:
- Never show the indicator on the currently active tab
- Remove the indicator once the user clicks that tab **or** the condition clears
- Use the subtle dot for general "something to see here" signals
- Use the prominent amber button when the value itself (e.g. 67%) communicates urgency
- Amber for warnings/suggestions. Red (`bg-destructive`) only for blocking conditions.

---

## Action Item System

Action items are computed server-side by `getActionItems`, which calls each active
module's `getSummary` and applies a standard rule set. Each rule:

```js
{
  id: "college.underfunded",         // stable identifier
  moduleKey: "college",
  severity: "warning",               // "info" | "warning" | "urgent"
  title: "Amelia's college fund is 58% funded",
  body: "At current contributions, the shortfall is $42,000.",
  cta: { label: "Review plan", href: "/college?planId=abc123" },
  dismissible: false,                // urgent items cannot be dismissed
  generatedAt: isoTimestamp
}
```

### Rule registry (v1)

| Rule ID | Trigger condition | Severity |
|---|---|---|
| `profile.incomplete` | `age` or `targetRetirementYear` missing | warning |
| `college.underfunded` | funded % < 80% and first tuition year < 5 years away | urgent |
| `college.no-children` | active plan has no children defined | info |
| `alts.missing-cashflows` | investment has no cash flows and vintage > 1 year ago | warning |
| `alts.mode-sleeve-only` | mode is "sleeve" with no investments recorded | info |
| `retirement.no-crossover` | crossover year not reached within projection window | warning |
| `dividends.no-holdings` | active plan has no holdings | info |

Rules are evaluated fresh on every `getActionItems` call. Items are not persisted —
they're always derived from current data. Dismissal state (for dismissible items) is
stored in `profile/{uid}` as `dismissedActionItems: [id]`.

---

## Profile

Seeded automatically from Google sign-in on first login. Always editable.

```js
{
  displayName: string,           // from Google
  email: string,                 // from Google, immutable
  photoURL: string,              // from Google
  activeModules: string[],       // set during onboarding step 1, editable in settings

  // Retirement module — collected only if retirement is an active module
  age: number | null,
  targetRetirementAge: number | null,  // e.g. 65; year is computed, not stored

  // College module — collected only if college is an active module
  numberOfKids: number | null,

  // Future modules add fields here as they are designed
}
```

`targetRetirementYear` is never stored — it is computed on demand:
`targetRetirementYear = currentYear + (targetRetirementAge - age)`

Profile is the single source of truth for user identity and module preferences.
No duplication of profile data in module-level documents.

### Profile page UX

- **X close button** — top-right of the page header (`absolute top-0 right-0`); calls `navigate(-1)`
- **Dirty tracking** — form compares live state to saved `profile` values; `isDirty` is true when any field differs
- **Save button** — disabled when form is invalid or not dirty; shows "Saved" with checkmark for 3 seconds after success
- **Cancel button** — shown only when `isDirty`; resets all fields to current profile values without saving
- Both the Save and Cancel buttons are disabled while a save is in progress

---

## Onboarding

### Design principle: module-driven questions

The setup flow is the direct result of clicking "Sign in with Google" on the landing page.
It should feel like a continuation of that experience — not a separate form.

Setup has two steps. Step 1 is always the same. Step 2 is composed dynamically from the
union of questions required by the selected modules.

```
Landing page → Sign in with Google → Firebase Auth →

Step 1: "What's part of your holistic money view?"  ← always shown; module selection
Step 2: [questions driven by selected modules]   ← skipped if no module needs inputs
→ Route to the first selected module
```

`isOnboarded` = `activeModules.length > 0`. No module inputs are required to complete
onboarding — step 2 may have zero questions if no selected module needs upfront data.

### Module onboarding requirements

| Module | Questions | Notes |
|---|---|---|
| `retirement` | Current age · Target retirement age (default: 65) | Year is computed, not asked |
| `college` | Number of children · Monthly savings budget | Child details collected inside the module |
| `alts` | Number of investments · Approximate total committed capital | Seeds sleeve view; investment details collected inside |
| `equity` | TBD | Likely nothing upfront |

Questions are deduplicated across modules. If two modules need the same input (e.g., age),
it is asked once.

### Post-onboarding routing

After completing onboarding, the user is routed to the first module they selected — not the
dashboard. The dashboard is a destination once there is data to aggregate; it is not a useful
landing point for a brand-new user.

### Returning users

The dashboard's "new user" state (currently gated on `age` and `targetRetirementYear`) is
now gated on `activeModules.length === 0`. A user with modules but no module-specific data
sees the module's own empty state, not a dashboard checklist.

### Multi-module setup banner

When a user has active modules that have not yet been initialized (i.e., no plan created),
the module page shows a banner listing **all** uninitialized modules — not just one.

- List is computed as `activeModules.filter(key => !profile.initializedModules?.includes(key))`
- Banner formats the list naturally: "Retirement", "Retirement and College", "Retirement, College and Alts"
- CTA navigates to the first uninitialized module: "Set up [first module]"
- Banner disappears once all listed modules are initialized

---

## Module Specs

### Home `/`

**Unauthenticated — marketing site**

Sections (top to bottom):
- **Hero** — headline, one-sentence positioning, Sign in with Google CTA
- **Philosophy** — 4 pillars: invest don't save / time is the asset /
  plan the whole family / think in decades
- **Module previews** — one card per module: what it solves, what the output looks like
- **How it works** — 3 steps: choose what you want to see → answer a few quick questions → see the whole picture
- **Closing CTA** — Sign in with Google

**Authenticated — dashboard**

Single authoritative section — no split between "Shared Infrastructure" and "Module Specs."

*New user (activeModules is empty — should not normally reach dashboard, onboarding guards this):*
- Getting-started prompt: "Choose your first module to get started"
- Module cards: all shown, each with "Get started" CTA that activates the module
  and navigates to it

*Returning user:*
- **Net worth snapshot** — total `netWorthContribution` across all active modules
- **Retirement readiness** — % of income target covered, years to crossover (from Retirement)
- **Per-module summary cards** — one per active module, headline metrics from `getSummary`
- **Action items** — from `getActionItems`, ordered by severity
- **Milestones timeline** — upcoming dated events across all modules
- Inactive modules shown as muted "Add to your plan" cards — clicking activates the module
  and navigates to it (call to action, not dead UI)

---

### Retirement `/retirement`

**Purpose:** Retirement income projection across every active sleeve. "Am I on track?"

**Inputs:**
- Retirement target income ($/yr)
- Current age + target retirement age (pre-filled from profile, editable here;
  edits write back to `profile/{uid}`; retirement year is computed from these two values)
- Per-sleeve toggles (Alpha, Index, Alts, College residual, Dividends)

**Outputs:**
- Stacked area chart: projected annual income by sleeve over time
- Crossover marker: year income target is met
- Toggle: Portfolio value view (total AUM over time)
- Sleeve summary cards: current value, projected income, % of target

**Projection math (to be specced in detail before Phase 2 build):**
- Each sleeve compounds annually at its configured rate
- Income = portfolio value × distribution rate (configurable per sleeve)
- College residual: read from `collegeGetSummary` → `netWorthContribution` (finalBalance − loanAmount)
- Alts: reads from active alts plan's `getSummary.projectedAnnualIncome`
- Dividends: reads from active dividends plan's `getSummary.projectedAnnualIncome`
- Crossover year: first year where sum of all sleeve incomes ≥ `targetIncome`

**Migrate from:** `holistic-planner/src/HolisticPlanner.jsx`

---

### Overview `/overview`

**Purpose:** Holistic snapshot across all active modules. The "whole picture" — not a
single module but a composed view of everything. Distinct from the `/` dashboard (which
is card-based and action-oriented); Overview is a single unified read.

**Status: Partially built — college data live; other modules show stubs.**

**Layout:** One card per active module, stacked vertically. Below a separator, a grid of
"Not in your plan" stub cards for inactive modules. Empty state if no modules are active.

**College section** — calls `collegeGetSummary`, shows holistic-framing metrics:

| Metric | Source | Notes |
|---|---|---|
| Post-college residual | `netWorthContribution` | Green if positive (retirement asset); red if net liability |
| Monthly allocation | `metrics.monthlyContribution` | Cash flow currently locked into college |
| Active years | `firstCollegeYear – lastGraduationYear` | When money flows out; when residual becomes available |
| Funding confidence | `metrics.successRate` | Amber highlighted row (bg + border) when < 90%; green when ≥ 90%; shows `+$X/mo to reach 90%` sub-label |
| Unfunded gap | `metrics.remainingGap` | Only shown when > 0; red value |
| Loan repayment | `metrics.monthlyLoanPayment` | Only shown when > 0; muted value with graduation year |

**`collegeGetSummary` additions:** `metrics.successRate` and `metrics.extraMonthly` are now
included from `plan.monteCarloResult`, making them available without a second API call.

**Retirement / Alts sections** — shown as dimmed stub cards (Phase badge) when those modules
are active but not yet built.

**Planned (later phases):**
- Retirement section: income projection, crossover year, % of target covered
- Alts section: blended IRR, DPI, total committed vs. distributed
- Net worth total bar across all active modules at top of page

---

### College `/college`

**Purpose:** Endowment-style funding plan for multiple children.

**Status: Built (Phase 3 complete for core features).**

**Setup wizard** — collected at first visit, creates the plan:
- Children: name, birth year, college cost tier (public in-state $27k · public out-of-state $45k · private $60k · elite $85k / yr, 2025 dollars) + optional manual cost override
- Initial savings (combined 529s or any earmarked funds)
- Planned monthly contribution
- Expected annual return (default 6%)

**Savings config** — inline edit card (pencil icon top-right), updates after save:
- Current savings, monthly contribution, annual return
- Inflation rate (default 3%; configurable 0–15%)
- Lump sums: year, amount, optional label (e.g. "RSU vest 2027")
- Planned loans: total loan amount, interest rate (default 6.39% — Federal Direct Unsubsidized 2025–2026), repayment term (default 10 yrs)

**Children section** — inline editable rows (pencil icon per row):
- Per-child: name, birth year, cost tier selector (preset buttons), manual annual cost override (currency input)
- Choosing a tier preset populates the cost input; user can then fine-tune
- Edits call `collegeUpdateChildren`, which re-runs Monte Carlo and refreshes the plan

**Projection engine** — deterministic year-by-year simulation:
- Costs inflation-adjusted from each child's college start year using configurable `inflationRate`
- Each child uses `annualCostBase` if set, otherwise `COST_TIER_MAP[costTier]` as the base cost
- Savings compound at `annualReturn`, plus monthly contrib + lump sums
- Uncovered costs tracked as `totalUncovered`; loan reduces remaining gap in summary
- Chart: amber bars (per-child annual costs) + green line (savings balance) + red dashed line (accumulated uncovered / loan balance below y=0)
- Green and red lines meet at the same zero point: `loanBalance` is held at 0 in the first crossover year so both lines share the origin before red descends

**Metric cards:**
1. Total projected cost (inflation-adjusted sum across all children × 4 years, using `inflationRate`)
2. Projected at [first college year] (savings balance when first child starts)
3. Cha-ching / Remaining gap (after planned loans; surplus shown green; "Fully funded" at zero)
4. Monthly still needed / Monthly loan payment — uses `mc.extraMonthly` (extra $/mo to reach 90% MC success); shows monthly loan payment if plan is already fully funded

**Chart toggle — Projection / Probability:**
- Projection tab: deterministic savings vs. cost chart (default view)
- Probability tab: Monte Carlo fan chart (p10–p90 bands)
- When `successRate < 0.9` and Projection tab is active, the Probability toggle renders as an amber button
  showing `Probability · {pct}%` — draws attention without switching tabs
- Once the user clicks Probability tab, the button returns to normal styling regardless of success rate

**Monte Carlo simulation** — computed server-side after every write, cached in `plan.monteCarloResult`:
- 1000 simulations, ±12% annual return variance (moderate portfolio)
- Box-Muller normal distribution, returns clamped to [−50%, +60%]
- Success = uncovered costs ≤ planned loan amount
- Outputs: `successRate`, `yearlyBands` (p10/p25/p50/p75/p90 + stacked-area band values), `extraMonthly`
- `extraMonthly`: binary search (14 iterations × 300 sims) for extra $/mo to reach 90% success; 0 if already ≥90%
- Fan chart: Recharts stacked Area (invisible base + shaded p10–p90 band) + 3 percentile lines
- `collegeGetPlan` lazy-backfills `monteCarloResult` for plans written before server-side MC was added

**Holistic residual callout:**
- When `remainingGap ≤ 0` (plan is fully funded), show a callout card below the metric cards
- Displays the residual `finalBalance` that will be available after all college costs are covered
- Note: this residual is an asset that feeds the holistic / retirement view via `netWorthContribution`

**Inter-module output** (`collegeGetSummary`):
- `netWorthContribution = finalBalance − loanAmount` (residual savings asset minus loan liability)
- `projectedAnnualIncome: 0` (college savings don't generate income)
- Action items: `college.fundingGap` (warning/urgent if gap > $50k), `college.loanRepayment` (info, dismissible)

**Planned (not yet built):**
- Multiple plans per user, plan versioning UI
- Comment thread per plan
- Visitor presence (last viewed timestamp per shared user)

---

### Alts `/alts`

**Purpose:** Single source of truth for alternative investments. The alts ecosystem
is fragmented — this is the one place.

**Plan versioning:** Multiple plans per user (e.g., "Main Portfolio", "LP Interests").
Empty state: "Add your first investment" with a clear CTA.

**Sleeve mode (simple):**
- Single IRR + current value + annual contribution
- For users who want a high-level projection without per-investment detail
- Projected income fed to Overview

**Investment mode (precise):**
- Individual investment records: name, vintage year, committed capital, currency
- Cash flow log: capital calls, distributions (income vs. return of capital), exit proceeds
- Each cash flow: date, type, amount, optional note
- Projected IRR for unrealized investments
- Realized IRR via XIRR (Newton–Raphson) for investments with sufficient cash flows
- Portfolio metrics: blended IRR, DPI, RVPI, TVPI
- Capital deployed vs. committed chart
- Investment calendar: expected future calls/distributions

**Mode switching:** Follows the global Data Loss Confirmation Pattern — switching modes
shows a confirmation dialog if the current mode has data. No data is deleted.

**Future (not v1):** Vetting workflow for evaluating new opportunities.

---

### Dividends `/dividends`

**Purpose:** Track dividend income across holdings over time.

**Plan versioning:** Multiple plans per user. Empty state: "Add your first holding."

**Inputs:**
- Holdings: ticker or name, share count, cost basis
- Dividend events: ex-date, pay date, amount per share, type (ordinary/qualified/ROC)

**Outputs:**
- Annual dividend income chart (by holding, by year)
- YTD received vs. prior year
- Yield on cost per holding
- Projected forward income based on trailing dividend rate
- Feed projected annual income to Overview

**Build from scratch. Phase 4.**

---

### Equity `/equity`

**Purpose:** Track stock, index fund, and mutual fund holdings. Dividends is an
enhanced sub-view within Equity — not a separate tab.

**Plan versioning:** Multiple plans per user. Empty state: "Add your first holding."

**Inputs:**
- Holdings: ticker or name, share count, cost basis, asset type (stock / index / mutual fund)
- Annual contribution
- Expected return rate

**Outputs:**
- Portfolio value chart over time
- Total value, unrealized gain, projected annual income
- Feed projected income to Overview sleeve

**Dividends sub-view `/equity/dividends`:**
- Available only for holdings typed as stocks
- Dividend event log: ex-date, pay-date, amount per share, type (ordinary / qualified / ROC)
- Annual dividend income chart by holding and by year
- YTD received vs. prior year
- Yield on cost per holding
- Forward income projection based on trailing dividend rate

**v2. Out of scope for v1.** Tab is present in the nav; clicking shows a "Coming soon"
state with module description and a preview of what it will contain. No data, no API calls.

---

### Property `/property`

**Purpose:** Real estate holdings — equity, income, and appreciation over time.

**v2. Out of scope for v1.** Same coming-soon treatment as Equity.

---

## CI/CD Pipeline

```
On every PR and push to main:

1. format-check    → Prettier — fail if any file needs formatting
2. lint            → ESLint — fail on any error
3. test:unit       → Vitest unit tests with mocked data — fail if any test fails
4. test:coverage   → Enforce minimum coverage thresholds (functions: 80%, lines: 80%)
5. build           → Vite production build — fail if build errors
6. test:integration → Vitest integration tests against Firebase emulator
7. test:smoke      → Playwright UI smoke tests against preview deployment
8. deploy          → Firebase deploy (main branch only)
9. rollback        → If any step 6–8 fails post-deploy, trigger rollback to previous
                      Firebase Hosting release automatically
```

Firebase emulator runs locally and in CI for integration tests — no test data
ever touches production Firestore.

---

## Testing Strategy

### Unit tests (Vitest, mocked data)
- All projection math functions: `computeProjection` (college), `computeIRR` (alts XIRR),
  `computeOverviewProjection`, `computeCrossoverYear`
- All action item rule functions — given mock `getSummary` data, assert correct items generated
- API response validation — given mock Firestore data, assert correct response envelope
- Target: every pure function in `functions/` and `src/utils/` has a unit test

### Integration tests (Vitest + Firebase emulator)
- Full API call round-trips: call a Cloud Function against the emulator, assert Firestore state
- Auth enforcement: unauthenticated call → `auth/unauthenticated`, wrong user → `auth/unauthorized`
- Share flow: owner grants access → recipient can read → owner revokes → recipient cannot read
- Plan versioning: create plan → set active → verify active plan feeds dashboard
- Audit log: after each write operation, assert audit entry was created

### UI smoke tests (Playwright)
- Sign in with test Google account
- Dashboard loads and displays module summary cards
- Navigate to each active module — page renders without error
- College: create a child, verify projection chart updates
- Alts: add an investment, add a cash flow, verify IRR appears
- Share: grant access to test account 2, verify it can view the plan
- Dark mode toggle: persists across navigation

---

## Migration Plan

### Phase 1 — Scaffold ✅ COMPLETE
- New repo: `timothy-tagge/holistic-suite`
- Vite + React + React Router + shadcn + Tailwind + Firebase + design-tokens
- AppHeader (nav tabs, dark mode toggle, avatar → /profile, sign out), AuthGate, router
- Landing page (unauthenticated marketing site), 2-step onboarding, dashboard shell
- Firebase Hosting site `holistic-suite.web.app`, CI pipeline configured end-to-end
- Firebase Functions: `shared/getProfile` + `shared/updateProfile` deployed on Blaze plan
- Profile page at `/profile` — editable age, retirement year, active modules

**Completed:** A new user can sign in with Google, complete onboarding, and reach the
dashboard. Profile is persisted to Firestore via Cloud Functions. Avatar in AppHeader
links to profile settings.

**Learnings captured in CLAUDE.md:**
- `patchProfile` must handle null profile (use updates directly, not no-op)
- Route-guard redirects are safer than imperative `navigate()` after state changes
- `updateProfile` must upsert (not require doc to pre-exist)
- Firebase Blaze required for Functions; APIs take 2–5 min to propagate after upgrade
- Run `firebase functions:artifacts:setpolicy` after first deploy
- Each new hosting domain needs manual auth whitelisting in Firebase + Google OAuth

### Phase 2 — Migrate Retirement
- Move projection logic from `HolisticPlanner.jsx` into `retirement/getProjection` Cloud Function
- Write unit tests for the projection math (this is the first time it's formally tested)
- Build `shared/aggregateModules` stub (returns mock data for unbuilt modules)
- UI reads from API, not Firestore directly
- Verify existing `holistic/{uid}` data loads correctly for current users

**Done when:** Existing holistic planner users open `/retirement` and see their saved plan,
loaded via the API. Unit tests green.

### Phase 3 — Migrate College ✓ (core complete)

**Done:**
- `College.jsx` built from scratch (not migrated from `college-endowment-plan.jsx`)
- shadcn/ui throughout — no inline styles, no hardcoded hex colors
- Setup wizard: children (name, birth year, cost tier + optional manual cost), savings, monthly contrib, annual return
- Savings config card: inline edit (pencil top-right), lump sums, loans, configurable inflation rate
- Children section: per-row inline editing (name, birth year, tier preset + fine-tune cost input)
- Deterministic year-by-year projection + chart (bars + savings line + loan balance line below zero)
- `collegeSetup`, `collegeGetPlan`, `collegeUpdateSavings`, `collegeUpdateChildren`, `collegeGetSummary` Cloud Functions deployed
- `collegeGetPlan` lazy-backfills `monteCarloResult` for pre-MC plans
- `getSummary` returns inter-module contract; action items for funding gap and loan repayment
- Monte Carlo: server-side (`functions/src/college/runMonteCarlo.js`), shared utils in `functions/src/shared/monteCarlo.js`
- MC cached in `plan.monteCarloResult` after every write; frontend reads from plan, no client compute
- Fan chart with p10/p25/p50/p75/p90 bands; `extraMonthly` suggestion to reach 90% confidence
- Projection/Probability chart toggle; amber button with percentage when success < 90%
- Monthly still needed uses `mc.extraMonthly` (consistent with MC probability suggestion)
- Holistic residual callout when plan is fully funded
- Profile page: X close button, dirty tracking, Cancel button
- Overview page: college holistic data live (`collegeGetSummary`); funding confidence row amber-highlighted when < 90%
- Chart crossover: green savings line and red loan line share zero point at first crossover year

**Remaining for full Phase 3 completion:**
- Multiple plans per user + plan versioning UI
- Comment thread via API
- Visitor presence via `getSummary`
- Integration tests

### Phase 4 — Alts + Dividends (new)
- Build Alts: sleeve mode first, then investment mode with XIRR
- Build Dividends: holdings + dividend event log + income chart
- Both modules wire `projectedAnnualIncome` into Overview via `getSummary`

### Phase 5 — Dashboard completion
- `aggregateModules` now has real data from all Phase 4 modules
- Action items fully implemented across all active modules
- Milestones timeline populated

### Phase 6 — Document pipeline (Alts vetting + K-1 extraction)

**Problem:** Alts investors receive capital call notices, K-1s, and fund updates as PDFs
scattered across fund portals, email, and postal mail. Manual data entry is error-prone
and slow.

**Architecture:**
```
User uploads PDF → Cloud Storage
                 → Pub/Sub trigger
                 → Cloud Function (extractor)
                 → Gemini / Claude API (structured extraction)
                 → Suggested entry in Alts (pending user review)
                 → User confirms / edits → written to Firestore
```

**Supported document types (v1):**
- Capital call notices → pre-fills a `call` cash flow event
- Distribution notices → pre-fills a `distribution-income` or `distribution-roc` event
- K-1 forms → extracts partnership income/loss for tax reference (display only, not written to plan)

**Rules:**
- AI-extracted data is always shown as a **suggested entry** — never auto-committed
- User reviews the suggestion, edits if needed, then confirms
- Original PDF stored in Cloud Storage at `gs://tagge-app-suite-dev.appspot.com/users/{uid}/docs/{planId}/{docId}`
- Extraction confidence score shown alongside suggestion; low-confidence fields highlighted

**Terraform scope for Phase 6:**
- Cloud Storage bucket + lifecycle rules
- Pub/Sub topic + subscription
- Cloud Function service account with least-privilege IAM
- Secret Manager entry for AI API key

### Phase 7 — Infrastructure as Code (Terraform)
- `terraform/` directory in holistic-suite repo
- Covers: Hosting sites, Firestore rules deployment, Functions IAM, Storage buckets,
  Pub/Sub topics, Cloud Scheduler jobs, Auth domain config, Secret Manager
- Goal: full environment reproducible from `terraform apply`

---

## What Gets Retired

| Repo | When | Action |
|---|---|---|
| `holistic-planner` | After Phase 2 | Add redirect banner: "Holistic Planner has moved → holistic-view.money/retirement". Archive repo. |
| `college-funding-endowment` | After Phase 3 | Add redirect banner: "College Planner has moved → holistic-view.money/college". Archive repo. |

Firestore data: untouched. Same project, same collections, same UIDs.
The new API layer reads from the same documents. No migration scripts needed.

---

## Open Questions

- **XIRR convergence failure** — what IRR value to show when Newton–Raphson doesn't
  converge? Options: show "N/A", show last iteration estimate with a warning badge,
  or cap iterations and show the closest result.
- **Multi-currency Alts** — investments may be denominated in different currencies.
  v1 will include a currency field per investment but display in USD using a manual
  FX rate input. Live FX rates are a v2 consideration.
- **Dividends vs. Equity** — currently specced as a sub-view within Equity
  (`/equity/dividends`). Dividends tab visible only when Equity is active. Revisit
  if dividends use case grows beyond what the Equity module supports.
- **Retirement projection math spec** — exact compounding formulas need to be written
  out before Phase 2 build begins. Should be a separate short doc.
- **Firebase Functions region** — currently deployed to `us-central1` (default).
  Acceptable for personal tool. Revisit if latency becomes noticeable.
- **Node.js runtime upgrade** — functions currently on Node 20 (deprecated 2026-04-30).
  Upgrade to Node 22 before April 2026. Check firebase-functions package for breaking
  changes before upgrading (`npm install --save firebase-functions@latest`).
