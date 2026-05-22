# FitJournal — codebase guide

Personal, offline-first fitness journal. React 19 + TypeScript + Vite, shipped
as an installable PWA. **All data is on-device** (IndexedDB) — there is no
backend, no account, and no network dependency at runtime. See `README.md` for
the product overview and `AUDIT.md` for the current product audit and the
ranked backlog.

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
  migration step in `storage.ts`.
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
  Also holds UI nav state (`page`, `viewingDateKey`) and `saveFailed` — true
  when the most recent persist failed.
- **`data/store-context.ts`** — `StoreContext`, the `useStore()` hook, and the
  `StoreValue` interface.

Components read state with `useStore()` and mutate only through store actions.

## Screens

`src/pages/` — one file per screen, each exporting a single `*Screen` component
(`TodayScreen`, `ProgressScreen`, `RecordsScreen`, `HistoryScreen`, `PlanScreen`,
`RecipesScreen`, `SettingsScreen`). Modals and rows are local, unexported
sub-components. `components/AppShell.tsx` maps the active `page` to its screen
and renders the sidebar.

## Styling

- **Design tokens** live in `styles/tokens.css` (colour, spacing, type, radius,
  motion). **Never hardcode raw colours/sizes** — always use a `var(--…)` token.
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

## Not yet built

All five build phases are done, plus a Vitest suite over the data/logic
layer and four rounds of post-audit fixes (`AUDIT.md` → Phases 1–4). The
original single-file app has been retired to `../archive/`. OS-level
scheduled reminders are deliberately deferred — unreliable for an offline,
server-less app. `AUDIT.md` holds the full ranked audit and the remaining
open findings.
