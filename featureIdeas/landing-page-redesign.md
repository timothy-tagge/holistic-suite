# Landing Page Redesign

**Status:** Backlog — not started
**Module:** Landing / Marketing
**Priority:** Medium — first impression for new users; current page reads as a list of features, not a value proposition

---

## Problem

The current landing page (`src/pages/LandingPage.jsx`) is functional but flat:
- Hero has no visual — it's just text and a sign-in form
- "What's inside" is four identical-looking text cards with no hierarchy
- Philosophy section reads like a blog post, not a product promise
- No imagery or visual metaphors that speak to what the product actually *feels* like
- No social proof, no urgency, no differentiation from a spreadsheet
- Sections feel like they were added independently — no visual flow pulling the user down

Reference sites: **Mint** (before shutdown), **Empower** (formerly Personal Capital),
**Monarch Money**, **Copilot**. Common patterns across all of them:

- Bold single-sentence hero above the fold with a supporting sub-line
- Hero immediately flanked by a product screenshot or dashboard mockup
- Feature sections use alternating image + text layout (not a grid of cards)
- Numbers/stats ("$2.3T tracked", "800k users") anchor credibility
- Tight, consistent visual rhythm — not a wall of sections

---

## Proposed Structure

### Section 1 — Hero (above the fold)

**Left column: headline + sub-line + sign-in**
**Right column: dashboard mockup image**

```
┌─────────────────────────────────────────────────────────────┐
│  NAV: Holistic                              [Sign in]       │
├────────────────────────┬────────────────────────────────────┤
│                        │                                    │
│  See every dollar      │   ┌──────────────────────────┐    │
│  in one picture.       │   │  [Dashboard mockup image]│    │
│                        │   │  Overview chart showing  │    │
│  Your retirement,      │   │  projected income across │    │
│  college fund, alts,   │   │  retirement, college,    │    │
│  and dividends —       │   │  alts, dividends         │    │
│  modeled together.     │   └──────────────────────────┘    │
│                        │                                    │
│  [Continue with Google]│                                    │
│  ─── or ───            │                                    │
│  [Email sign-in form]  │                                    │
│                        │                                    │
└────────────────────────┴────────────────────────────────────┘
```

On mobile: headline + sign-in first, image below (or omit image entirely).

**Hero headline options** (pick one):
- "See every dollar in one picture."
- "Your whole financial life, finally in one place."
- "One plan. Every piece."

### Section 2 — Module showcase (alternating layout)

Replace the 2×2 card grid with full-width alternating rows:
image/screenshot on one side, headline + description on the other.
Four rows, one per module. This is the Empower/Monarch pattern.

```
Row 1 — Retirement
  [Retirement chart screenshot]    "Know the year you cross over.
                                    See when passive income meets your
                                    target — across every investment sleeve."

Row 2 — College (image on right)
  "Fund college like an endowment." [College projection screenshot]
  "Multi-child, year-by-year..."

Row 3 — Alts
  [Alts IRR / cash flow screenshot] "Your alts portfolio, organized.
                                      Track calls, distributions, and IRR..."

Row 4 — Dividends (image on right)
  "Build a dividend income stream." [Dividend chart screenshot]
  "Track payments by ticker..."
```

### Section 3 — Social proof / credibility bar

A thin horizontal band with 2–3 anchoring stats or statements.
Before real user numbers exist, use product-quality signals:

```
  No subscriptions · No ads · Your data stays yours
```

Or position statements:
```
  Built for serious investors · Not a budgeting app · No bank connections required
```

Replace this section with real stats (users, dollars tracked) once available.

### Section 4 — "How it works" (keep, tighten)

Current 3-step flow is good. Make it visually larger — bigger step numbers,
more breathing room. Consider a vertical timeline layout on mobile instead of
the horizontal arrow row.

### Section 5 — Closing CTA

Keep the sign-in block. Replace the headline with something more direct:
- Current: "Ready to see the whole picture?"
- Better: "Your financial picture is waiting." / "Start in under a minute."

---

## Visual / Image Strategy

The page needs images. Options ranked by effort:

### Option A — Illustrated mockups (recommended)
Create SVG/PNG mockups of key screens (the Overview chart, a dividend income chart,
the college projection timeline). These don't need to be real screenshots — clean,
simplified illustrations of the UI. Tools: Figma, or hand-coded SVG components.

Benefits:
- Always up to date (can be updated when UI changes)
- No real user data exposed
- Can be styled to match the app's color scheme exactly
- No external image hosting

### Option B — Real screenshots (easiest short-term)
Take browser screenshots of the actual app with sample data loaded. Export as WebP.
Commit to `public/screenshots/`. Use `<img>` tags with `loading="lazy"`.

Drawbacks:
- Go stale as UI evolves
- Need to be retaken when pages change
- Resolution/DPI inconsistency across devices

### Option C — Abstract illustration
Use a single hero illustration (e.g. from undraw.co — free, SVG, themeable) that
conveys "financial clarity" / "big picture view". Swap the dashboard mockup for an
abstract visual if building a real mockup is too much effort at this stage.

**Recommendation:** Start with Option C (undraw.co illustration) to unblock the
redesign, then swap in real mockups (Option B or A) once the UI is more stable.

---

## Typography / Hierarchy Changes

- Hero headline: `clamp(48px, 7vw, 80px)` — currently `clamp(36px, 6vw, 64px)`, too small
- Sub-headline: increase from `text-lg` to `text-xl` with more `max-w`
- Section headers: `clamp(28px, 4vw, 40px)` — currently `clamp(22px, 3vw, 32px)`
- Body copy in module rows: `text-base` not `text-sm` — the current size reads like fine print

---

## Dark Mode Considerations

Module showcase images need a dark-mode variant. Options:
- SVG illustrations: use `currentColor` and CSS variables — they adapt automatically
- Screenshots: provide two variants, switch via `prefers-color-scheme` or `.dark` class
- Coded mockups: styled with Tailwind tokens, work in both modes automatically

---

## Files to change

| File | Change |
|---|---|
| `src/pages/LandingPage.jsx` | Full redesign — new section structure, alternating layout, hero with image |
| `public/screenshots/` or `public/illustrations/` | New image assets |
| `src/index.css` | Possibly add hero-specific utility if needed |

---

## Reference Patterns (study before building)

- **Monarch Money** (monarchmoney.com) — best current example of the alternating feature layout
- **Empower** (empower.com) — hero with dashboard screenshot, credibility bar
- **Copilot** (copilot.money) — strong typography, minimal, alternating rows
- **Linear** (linear.app) — not finance but excellent example of product screenshot as hero
