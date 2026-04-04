# Holistic Suite — Architecture

---

## System Topology

```mermaid
graph TD
    subgraph Client ["Browser — Firebase Hosting (holistic-suite.web.app)"]
        SPA["React 19 SPA\nVite · React Router v6\nshadcn/ui · Tailwind v4"]
    end

    subgraph Auth ["Firebase Auth"]
        Google["Google OAuth 2.0\nID Token → UID"]
    end

    subgraph Functions ["Cloud Functions — us-central1 (holistic-suite codebase)"]
        shared["shared/\ngetProfile · updateProfile\naggregateModules"]
        retirement["retirement/\ngetProjection · getPortfolioValue\ngetSummary"]
        college["college/\ngetPlans · computeProjection\ngetSummary · addComment"]
        alts["alts/\ngetPlans · addInvestment\naddCashFlow · computeIRR\ngetSummary"]
        dividends["dividends/\ngetPlan · upsertPayment · deletePayment\nupsertAccount · batchImport · getSummary"]
    end

    subgraph DB ["Firestore (tagge-app-suite-dev)"]
        profile["profile/{uid}\n/shares · /audit"]
        collegePlans["college-plans/{uid}"]
        altPlans["alts-plans/{uid}"]
        dividendPayments["dividend-payments/{uid}"]
        retirementData["holistic/{uid}\n(legacy — migrating)"]
    end

    User["👤 User"] --> SPA
    SPA <--> Google
    SPA -- "httpsCallable (auth token)" --> shared
    SPA -- "httpsCallable" --> retirement
    SPA -- "httpsCallable" --> college
    SPA -- "httpsCallable" --> alts
    SPA -- "httpsCallable" --> dividends
    shared <--> profile
    retirement <--> retirementData
    college <--> collegePlans
    alts <--> altPlans
    dividends <--> dividendPayments
```

---

## Frontend Routing

```mermaid
graph LR
    App["App.jsx\nAuthGate + ProfileContext\nRoute guard"]

    App -->|"unauthenticated"| Landing["/\nLanding page"]
    App -->|"auth + !isOnboarded"| Onboarding["/onboarding\n2-step: age+year → modules"]
    App -->|"auth + isOnboarded"| Home["/\nDashboard"]
    App --> Profile["/profile\nSettings + dev reset"]
    App --> Retirement["/retirement\n⚠ Phase 2"]
    App --> College["/college\n⚠ Phase 3"]
    App --> Alts["/alts\n⚠ Phase 4"]
    App --> Dividends["/dividends\nPhase 4"]
    App --> Equity["/equity\n🔒 v2"]
    App --> Property["/property\n🔒 v2"]

    style Retirement stroke-dasharray: 5 5
    style College stroke-dasharray: 5 5
    style Alts stroke-dasharray: 5 5
    style Equity stroke:#ccc,color:#ccc
    style Property stroke:#ccc,color:#ccc
```

---

## Page Flow

End-to-end user journey from first visit through active use.

```mermaid
flowchart TD
    Visit["User visits holistic-view.money"] --> AuthCheck{Authenticated?}

    AuthCheck -->|No| Landing["Landing page\nteaser · philosophy · modules · CTA"]
    Landing --> SignIn["Sign in with Google"]
    SignIn --> NewCheck{Has active\nmodules?}

    AuthCheck -->|Yes| NewCheck

    NewCheck -->|No — new user| S1["Setup step 1\n'What would you like to see?'\nModule selection"]
    NewCheck -->|Yes — returning| Dashboard["/\nDashboard"]

    S1 --> NeedsQ{Retirement or\nCollege selected?}
    NeedsQ -->|Yes| S2["Setup step 2\nModule-driven questions\nage · retirement age · number of kids"]
    NeedsQ -->|No — alts/equity only| Save["Save · finish"]
    S2 --> Save
    Save --> FirstModule["Route to first\nselected module"]

    Dashboard --> Retirement["/retirement"]
    Dashboard --> College["/college"]
    Dashboard --> Alts["/alts"]
    Dashboard --> Profile["/profile\nSettings · dev reset"]

    FirstModule --> Retirement
    FirstModule --> College
    FirstModule --> Alts
```

---

## API Data Flow

Every component interaction follows this path. Components never read from or write to
Firestore directly.

```mermaid
sequenceDiagram
    participant C as Component
    participant PC as ProfileContext
    participant F as Cloud Function
    participant FS as Firestore

    C->>F: httpsCallable(fn, payload) + Firebase Auth token
    F->>F: assertAuth(request)
    F->>F: assertAccess(uid, docRef, "edit")
    F->>FS: read / write
    FS-->>F: result
    F->>FS: writeAuditLog(uid, action, resource)
    F-->>C: { ok: true, data: { ... } }
    C->>PC: patchProfile(result.data.profile)
```

---

## Firestore Data Model

```mermaid
erDiagram
    PROFILE {
        string uid PK
        string displayName
        string email
        string photoURL
        int age
        int targetRetirementYear
        string[] activeModules
        string createdAt
        string updatedAt
    }
    SHARES {
        string shareId PK
        string grantedTo
        string access
        string grantedAt
        string revokedAt
    }
    AUDIT {
        string entryId PK
        string action
        string resource
        string callerUid
        string callerEmail
        string timestamp
        string ip
    }
    COLLEGE_PLAN {
        string planId PK
        string ownerUid
        string name
        bool isActive
        int monthlyContrib
        int returnRate
        int inflRate
        string createdAt
        string updatedAt
    }
    ALTS_PLAN {
        string planId PK
        string ownerUid
        string name
        bool isActive
        string mode
        string createdAt
        string updatedAt
    }
    DIVIDEND_PAYMENT {
        string paymentId PK
        string ownerUid
        string ticker
        string date
        float amount
        float sharesHeld
        float priceAtDate
        string accountId
        string note
    }

    PROFILE ||--o{ SHARES : "profile/{uid}/shares"
    PROFILE ||--o{ AUDIT : "profile/{uid}/audit"
    PROFILE ||--o{ COLLEGE_PLAN : "ownerUid"
    PROFILE ||--o{ ALTS_PLAN : "ownerUid"
    PROFILE ||--o{ DIVIDEND_PAYMENT : "dividend-payments/{uid}"
```

---

## Module Build Status

```mermaid
gantt
    title Holistic Suite — Phase Roadmap
    dateFormat YYYY-MM
    axisFormat %b %Y

    section Foundation
    Phase 1 · Scaffold + Auth + Profile  :done, 2025-01, 2026-03

    section Modules
    Phase 2 · Retirement                 :active, 2026-03, 2026-05
    Phase 3 · College                    :2026-05, 2026-07
    Phase 4 · Alts                       :done, 2026-01, 2026-04
    Phase 4 · Dividends                  :done, 2026-01, 2026-04

    section Platform
    Phase 5 · Dashboard completion       :2026-10, 2026-11
    Phase 6 · Document pipeline (AI)     :2026-11, 2027-02
    Phase 7 · Terraform IaC              :2027-01, 2027-03
```
