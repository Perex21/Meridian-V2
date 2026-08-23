# Meridian Portfolio Overview implementation

The approved dark Analyst Terminal dashboard has been implemented in the existing Meridian project. The interface now uses the project-specific one-pass, 14-stage workflow and keeps future stages dimmed and locked according to the server-generated rail.

## Changed files

- `frontend/components/screens/Dashboard.tsx` — renders Portfolio overview, the four factual summary metrics, real sector counts, real ARR/retention scatter points, and the one-way Thesis lock card.
- `frontend/app/terminal/layout.tsx` — replaces the top-only shell with a server-driven stage sidebar while preserving the existing terminal loading state and full run drawer.
- `frontend/components/ProfileMenu.tsx` — adds the profile avatar, real run progress summary, current stage, thesis-lock state, and the existing history/new-session actions.
- `frontend/app/globals.css` — adds the dark Analyst Terminal dashboard/sidebar/profile styling using the supplied Meridian palette.

## Data integrity

The headline figures are read from `state.summary`, which is returned by the session state endpoint and computed server-side by `dataset_summary`. The chart rows are loaded from the real `/sessions/{id}/companies` endpoint in pages of 200 until its reported total is exhausted. Sector bars are counted from each returned row's `sector`; scatter points use each row's `arr_usd` and `month6_retention` fields. No random client-side values are generated.

The thesis card reads `state.thesis_locked` and changes its copy and action label accordingly. The stage sidebar reads `state.rail`, so its order, labels, completed states, current state, and pending locks remain controlled by the backend's `SCREEN_ORDER`, `SCREEN_LABELS`, and transition guards.

The dashboard intentionally does not display unsupported round, revision, repeatable-hypothesis, outcome-reveal, portfolio-telemetry, confidence-score, or days-remaining concepts.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Start the backend according to the root project README and open `http://localhost:3000/terminal`.

## Navigation fix

The Thesis lock action now checks the server-provided `furthest_screen`. If the student is still at Dashboard, the action routes to Research, which is the valid next stage. Once Research has been reached, the same action opens Thesis. If the thesis is already locked, the action becomes `View locked thesis`. The backend stage guard remains unchanged and continues to enforce the one-pass sequence.

## Verification

The frontend passed:

```bash
npm run typecheck
npm run build
```

A source scan also confirmed that `Dashboard.tsx` uses the session summary and company-row fields for its metrics and charts, with no forbidden generic dashboard concepts present.


## Deal Flow company symbols

Each Deal Flow card now renders `CompanySymbol` from `frontend/components/CompanySymbol.tsx`. The component uses the real backend company `id` as its stable seed, selects a geometric glyph from a reusable symbol family, and applies a deterministic rotation/variant so each company has an individual mark without introducing fake logos or changing any data. `frontend/components/screens/DealFlow.tsx` supplies the company id and retains the existing real names, scores, sectors, cities, ARR, retention, selection, and allocation behavior. The symbol styling is appended to `frontend/app/globals.css`.
