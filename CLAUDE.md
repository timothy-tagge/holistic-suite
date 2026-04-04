# Holistic Suite

Unified personal finance planning app. One login, one domain, modular planners
that compose into a single picture.

GitHub repo: `timothy-tagge/holistic-suite`
Firebase project: `tagge-app-suite-dev`
Firebase site: `holistic-suite` → https://holistic-suite.web.app
Target domain: `holistic-view.money` (available — not yet purchased or configured)

**Full product spec:** [`SPEC.md`](./SPEC.md)
**Architecture diagrams:** [`docs/architecture.md`](./docs/architecture.md)

> **Rule:** After any change to routes (`App.jsx`), Cloud Functions (`functions/src/`), or
> Firestore collections/data model, update the relevant diagram(s) in `docs/architecture.md`
> as part of the same task. Do not leave diagrams stale.

---

## Key Files

| File                                    | Purpose                                                      |
| --------------------------------------- | ------------------------------------------------------------ |
| `src/App.jsx`                           | Root — AuthGate, ProfileContext, router, route guards        |
| `src/contexts/ProfileContext.jsx`       | Profile state, `useProfile()` hook                           |
| `src/components/AppHeader.jsx`          | Nav, dark mode toggle, avatar → /profile                     |
| `src/pages/Home.jsx`                    | Dashboard (authenticated) + landing page stub                |
| `src/pages/Onboarding.jsx`              | 2-step onboarding (age + retirement year → module selection) |
| `src/pages/Profile.jsx`                 | Profile settings + developer tools (reset profile)           |
| `functions/src/shared/getProfile.js`    | Cloud Function: read profile/{uid}                           |
| `functions/src/shared/updateProfile.js` | Cloud Function: write profile/{uid} (upsert)                 |

## Status

**Phase 1 complete.** Sign-in, onboarding, profile, AppHeader, routing, CI all working.

See `SPEC.md` → Migration Plan for phase-by-phase build order.

## Mobile-First Design Rule

**All pages must use responsive sizing for inputs, buttons, and layout-critical elements.** Never hardcode fixed widths. Always use responsive patterns:

- Form inputs: `w-full sm:w-40` (full-width on mobile < 640px, constrained on desktop)
- Buttons in layouts: `w-full sm:w-auto` (stack on mobile, inline on desktop)
- Projection/savings inputs: `w-full sm:w-36` (prevents horizontal scroll on iPhone 375–390px)

Fixed widths cause horizontal scroll and break on small phones. See `/CLAUDE.md` → Design Rules for full guidance.

## Local Development

The app connects to the **Firebase Functions emulator** in dev mode (`import.meta.env.DEV`).
Start it alongside the Vite dev server:

```bash
firebase emulators:start --only functions --project tagge-app-suite-dev
```

Without the emulator running locally, function calls will hit the deployed Cloud Functions
and may fail with CORS errors (Cloud Run v2 IAM).

## Firebase Functions

Codebase name: `holistic-suite` (set in `firebase.json`)

**After deploying new v2 functions:** Go to Cloud Run in the Google Cloud Console and grant
`allUsers` the `Cloud Run Invoker` role on each new service. Firebase CLI should do this
automatically but sometimes doesn't.

Deploy a single function:

```bash
firebase deploy --only "functions:holistic-suite:updateProfile" --project tagge-app-suite-dev
```

Deploy all functions:

```bash
firebase deploy --only functions --project tagge-app-suite-dev
```

## Firestore

`profile/{uid}` — user profile, seeded from Google auth on first sign-in.
All other collections follow the pattern in `SPEC.md` → Data Architecture.

## Active Modules (Phase 1)

`overview`, `college`, `alts` are selectable in onboarding/profile.
`equity`, `property` are coming soon (shown but disabled).

## Tech Debt / Pending Upgrades

- [ ] **Upgrade Node.js runtime to 22** — Node 20 deprecated 2026-04-30, decommissioned
      2026-10-30. Change `engines.node` in `functions/package.json` from `"20"` to `"22"`.
- [ ] **Upgrade `firebase-functions` package** — current version is outdated. Run
      `npm install --save firebase-functions@latest` in `functions/`. Review breaking changes
      before upgrading.

## Notes

- `updateProfile` accepts `null` for any field to clear it (used by dev reset in Profile.jsx)
- The `overview` module key in Firestore/profile predates the rename to `retirement`.
  When Phase 2 is built, migrate the key to `retirement`.
