# FitJournal — codebase guide

Personal, offline-first fitness journal. React 19 + TypeScript + Vite, shipped
as an installable PWA. **All data is on-device** (IndexedDB) — there is no
backend, no account, and no network dependency at runtime. See `README.md` for
the product overview.

## Commands

- `npm run dev` — dev server with HMR
- `npm run build` — typecheck (`tsc -b`) then production build into `dist/`
- `npm test` — Vitest unit tests for the data & logic layer
- `npm run lint` · `npm run format` · `npm run typecheck`

Deployment is automatic: pushing to `main` runs `.github/workflows/deploy.yml`,
which builds and publishes to GitHub Pages.

## Architecture

Layers, each depending only on the layer below:

```
pages/ (screens)  →  components/ (UI kit)
        ↓
data/store  (React context — state, actions, persistence)
        ↓
data/logic + data/storage  (derived logic; IndexedDB persistence)
```

- **`data/types.ts`** — the entire data model. `AppData` is the single saved
  object; `SCHEMA_VERSION` is bumped for each schema change, paired with a
  migration step in `storage.ts`. An `ExerciseEntry` carries a `SetEntry[]` —
  one entry per logged set, each with its own reps and weight.
- **`data/storage.ts`** — `loadData()` / `saveData()` / `defaultData()` /
  `exportData()` / `importData()` / `requestPersistentStorage()`. The journal
  lives in **IndexedDB**, so `loadData()` / `saveData()` are async; `loadData()`
  migrates an older `localStorage` journal across on first run, and both fall
  back to `localStorage` if IndexedDB is unavailable. Seeds Push/Pull/Legs
  templates on a fresh install; `importData()` validates a backup file before
  it can be restored; a versioned `MIGRATIONS` chain upgrades old saves and
  backups. `saveData()` returns `false` only if every storage tier fails, so a
  silent data loss can never look saved.
- **`data/logic.ts`** — *pure* derived computations: PRs, streaks (rest-day-
  aware, with a one-day grace), weekly & total stats, week-goal progress,
  session summaries, muscle
  balance, plateaus, insights/milestones, the activity heatmap. **Nothing
  derived is ever stored** — it is always recomputed from `workouts`. This file
  and `storage.ts` have co-located `*.test.ts` suites (run with `npm test`);
  being pure makes them straightforward to unit-test.
- **`data/store.tsx`** — `StoreProvider` loads the journal (async — IndexedDB)
  and then mounts `StoreReady`, which holds `AppData` in React state, persists
  it on change (trailing-debounced ~400ms, and flushed immediately when the app
  is hidden or closed), and exposes typed actions that do immutable updates.
  The current `page` and viewed day come from the URL hash via `lib/router.ts`;
  the store also tracks `saveFailed` — true when the most recent persist failed.
- **`data/store-context.ts`** — `StoreContext`, the `useStore()` hook, and the
  `StoreValue` interface.

Components read state with `useStore()` and mutate only through store actions.

## Screens

`src/pages/` — one file per screen, each exporting a single `*Screen` component
(`TodayScreen`, `ProgressScreen`, `PlanScreen`, `RecipesScreen`,
`SettingsScreen`). `ProgressScreen` carries an Overview / Exercises / History
segmented control — the merged home of the former Records and History screens.
Modals and rows are local, unexported sub-components. `components/AppShell.tsx`
maps the active `page` to its screen and renders the sidebar.

## Styling

- **Design tokens** live in `styles/tokens.css` (colour, spacing, type, radius,
  motion). **Never hardcode raw colours/sizes** — always use a `var(--…)` token.
- **Theming:** `tokens.css` carries a dark palette (the default) and a light
  palette. The theme follows the OS `prefers-color-scheme` unless an explicit
  `<html data-theme="light|dark">` overrides it — set by `lib/theme.ts` from the
  `theme` preference. The type scale is in `rem`, so it honors the OS text-size
  setting.
- `styles/components.css` styles the design-system components; `styles/app.css`
  styles the shell and screens. Every class is prefixed `fj-`.
- Icons are **Lucide** (`lucide-react`). Emoji are reserved for celebratory
  moments only.
- **Responsive:** a single `@media (max-width: 768px)` block at the end of
  `app.css` / `components.css` holds the phone layout (bottom nav, bottom-sheet
  modals, `env(safe-area-inset-*)`). The desktop layout is the default.

## Conventions & gotchas

- **Strict TypeScript** (`verbatimModuleSyntax`, `noUnusedLocals`,
  `noUnusedParameters`, `erasableSyntaxOnly`): use `import type` for type-only
  imports; no `enum`s or namespaces.
- Path alias: `@/` resolves to `src/`.
- **`react-refresh/only-export-components`**: a `.tsx` file should export only
  components. Hooks, context and shared constants go in a separate `.ts` file —
  this is why `store-context.ts` and `components/toast-context.ts` exist.
- `vite.config.ts` sets `base` to `/fitjournal/` for production (the GitHub
  Pages sub-path) and `/` for local dev.
- Unique ids come from `lib/uid.ts`; `YYYY-MM-DD` date keys from `lib/dates.ts`.
- `lib/feedback.ts` is the feedback helper — `celebrate()` (a synthesised Web
  Audio chime plus a haptic buzz, for PRs and milestones) and `tap()` (a soft
  haptic, for everyday confirmations); both degrade silently and are safe to call.
- `lib/backup.ts` exposes `downloadBackup()` — the shared JSON-export helper
  used by Settings, the backup reminder, and the save-error banner.
- `lib/theme.ts` exposes `applyTheme()` — sets the `data-theme` attribute and a
  pre-paint localStorage hint that `index.html` reads to avoid a theme flash.
- `lib/router.ts` is a tiny hash router — `useRoute()` reads `location.hash` and
  `navigateTo()` writes it; the store derives `page` and the viewed day from it,
  so the browser and Android back button work.

## Data safety

On-device storage has no cloud backup; an IndexedDB record is effectively the
database, and `navigator.storage.persist()` is requested to keep it durable.

- **Export / Import** — Settings → Export writes a full JSON copy; Settings →
  Import restores one via `restoreData()`, behind a confirm step. A restore
  first auto-downloads a snapshot of the current data, so it can be undone.
- **`SaveErrorBanner`** — a persistent banner shown when a device write fails
  (the store's `saveFailed`); it urges an immediate export.
- **`BackupReminder`** — a calm, dismissible nudge to export, shown once there
  is data and the user has not backed up in three weeks (`lastBackupAt` tracks
  the last export). Both render globally from `App.tsx`.

## Project status

All five build phases are done, plus a Vitest suite over the data/logic
layer and five rounds of post-audit fixes. The original single-file app has
been retired to `../archive/`. OS-level scheduled reminders are deliberately
deferred — unreliable for an offline, server-less app.

Since the audit, the core has been re-modelled for **per-set logging**: an
`ExerciseEntry` holds a `SetEntry[]` (each set its own reps and weight),
`SCHEMA_VERSION` is `2` with a v1→v2 migration, and cardio personal records
rank on measured distance instead of a machine's calorie estimate.

The three retrospective screens (Progress, Records, History) have since been
merged into one Progress screen with an Overview / Exercises / History
segmented control; navigation now runs on a hash router (`lib/router.ts`), and
the Overview carries a body-weight trend chart.
