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
  one entry per logged set, each with its own reps and weight. A `Recipe`
  carries an optional downscaled `photo` (JPEG data-URL) and an optional
  per-serving `nutrition` block; `HealthData` carries the three original
  metrics plus five optional ones (active energy, exercise minutes, resting
  heart rate, body mass, sleep) handed in by the Apple Shortcut bridge.
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
  session summaries, muscle balance, plateaus, insights/milestones, the
  activity heatmap, per-exercise history (`computeExerciseHistory`) with an
  Epley 1RM estimate (`estimate1RM`), and the cross-cutting helpers
  `findLastTime` / `formatSets`. **Nothing derived is ever stored** — it is
  always recomputed from `workouts`. This file and `storage.ts` have co-located
  `*.test.ts` suites (run with `npm test`); being pure makes them
  straightforward to unit-test.
- **`data/store.tsx`** — `StoreProvider` loads the journal (async — IndexedDB)
  and then mounts `StoreReady`, which holds `AppData` in React state, persists
  it on change (trailing-debounced ~400ms, and flushed immediately when the app
  is hidden or closed), and exposes typed actions that do immutable updates.
  The current `page` and viewed day come from the URL hash via `lib/router.ts`;
  the store also tracks `saveFailed` — true when the most recent persist failed.
  Undo-capable delete actions: `restoreExercise` / `restoreCardio` (Today),
  `restoreTemplate` (Plan), `restoreRecipe` (Recipes) — each re-inserts the
  deleted entry at its original index; `removeGoal` undo uses the existing
  `setGoal` action, capturing the old value in a closure before deletion.
- **`data/store-context.ts`** — `StoreContext`, the `useStore()` hook, and the
  `StoreValue` interface.

Components read state with `useStore()` and mutate only through store actions.

## Screens

`src/pages/` — one file per screen, each exporting a single `*Screen` component
(`TodayScreen`, `ProgressScreen`, `PlanScreen`, `RecipesScreen`,
`SettingsScreen`, plus two sub-pages: `SessionScreen` and
`ExerciseDetailScreen`). `ProgressScreen` carries an Overview / Exercises /
History segmented control — the merged home of the former Records and History
screens; the Overview also renders an *Apple Health* card with whatever
metrics have been synced, and the Exercises strength rows navigate to
`ExerciseDetailScreen`. `RecipesScreen` is a premium recipe keeper — sort
control, photo banner per card, a detail view with a hero photo, per-serving
macros, a serving scaler, checkable ingredients, and a full-screen Cook mode
that holds the screen awake. `SessionScreen` is the live in-workout view —
checkable set rows per exercise, with a rest-timer pill that fires the
`lib/feedback.ts` chime + haptic at zero; reached from the *Start* button on
Today (or the *Session* chip in Weight Lifting) and shares `ExerciseModal` /
`WorkoutSummaryModal` exported from `Today.tsx`. `ExerciseDetailScreen` shows
the top-set and Epley 1RM trend plus the session history for one exercise.
Modals and rows are local, unexported sub-components. `components/AppShell.tsx`
maps the active `page` to its screen and renders the sidebar; the bottom nav
still holds five items — Session and Exercise Detail are sub-pages reached by
action, not from the nav.

## Styling

- **Design tokens** live in `styles/tokens.css` (colour, spacing, type, radius,
  motion). **Never hardcode raw colours/sizes** — always use a `var(--…)` token.
  Theme-independent tokens (in `:root` only, not duplicated in light-theme
  blocks): `--color-brand-2` (#5e5ce6, logo gradient second stop),
  `--color-overlay` (rgba scrim behind modals), `--color-confetti-purple` and
  `--color-confetti-yellow` (extended confetti palette slots 4–5; slots 0–3 use
  the existing accent/success/warning/danger tokens).
- **Theming:** `tokens.css` carries a dark palette (the default) and a light
  palette. The theme follows the OS `prefers-color-scheme` unless an explicit
  `<html data-theme="light|dark">` overrides it — set by `lib/theme.ts` from the
  `theme` preference. The type scale is in `rem`, so it honors the OS text-size
  setting.
- `styles/components.css` styles the design-system components; `styles/app.css`
  styles the shell and screens. Every class is prefixed `fj-`.
  Touch targets: all `.fj-btn` carry `min-height: 44px` globally (not just in
  the mobile breakpoint). Reorder buttons (`.fj-reorder__btn`) are 44 × 32 px,
  clearing WCAG 2.2 SC 2.5.8. The session set-check (`.fj-session-check`) is
  44 × 44 px. Confetti piece colours are assigned via CSS classes
  (`.fj-confetti__piece--c0` … `--c5`) referencing tokens, not inline JS styles.
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
- `lib/backup.ts` exposes `downloadBackup()` (the shared JSON-export helper
  used by Settings, the backup reminder, and the save-error banner) and
  `downloadCsv()` / `exportCsv()` (flatten the journal to a one-row-per-set
  CSV, with bodyweight, cardio, and day notes folded in).
- `lib/theme.ts` exposes `applyTheme()` — sets the `data-theme` attribute and a
  pre-paint localStorage hint that `index.html` reads to avoid a theme flash.
- `lib/router.ts` is a tiny hash router — `useRoute()` reads `location.hash` and
  `navigateTo(page, date?, exerciseKey?)` writes it. The store derives `page`,
  the viewed day, and the viewed exercise key from it, so the browser and
  Android back button work. Routes: `#/today/<date>`, `#/progress`, `#/plan`,
  `#/recipes`, `#/settings`, `#/session`, `#/exercise/<urlencoded-name>`. A
  bare `#/exercise` with no key is rewritten to Progress.
- `lib/image.ts` exposes `downscaleImage(file)` — recipe photos are read,
  resized so the longest edge ≤ 1280 px, and returned as a JPEG data-URL so the
  on-device journal and JSON backup stay small.
- `lib/healthBridge.ts` is the Apple Health bridge — `parseHealthPayload`
  validates a JSON payload (every field a finite number; junk is dropped),
  `readHealthFromURL` consumes a `?health=<json>` query parameter on first
  load then `history.replaceState`s it away so a reload cannot replay a stale
  import, and `buildLogWorkoutURL` builds a `shortcuts://run-shortcut?…` URL
  that opens a companion `FitJournalLogWorkout` Shortcut with the day's
  totals. The inbound parser is also used by the manual JSON file import in
  Settings.

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

Recipes is now a premium keeper — photos, optional per-serving macros, a
serving scaler that scales ingredient quantities with a leading number,
checkable ingredients, a focused full-screen Cook mode, and a sort control.
Apple Health is integrated via a Shortcut bridge (`lib/healthBridge.ts`): the
app stays a pure PWA, an iPhone Shortcut reads HealthKit and opens FitJournal
with `?health=<json>`, and the data lands on the Progress Overview.

A live in-workout **Session** view (`pages/Session.tsx`) renders today's
exercises as checkable set rows; checking a set starts a rest-timer pill that
chimes at zero. A new per-exercise **Detail** view (`pages/ExerciseDetail.tsx`)
shows top-set weight and an Epley 1RM estimate as Sparklines, plus the full
session history; reached by tapping any strength row in Progress → Exercises.
`Preferences.restTimerSeconds` (default 120) drives the timer length.

Polish round: an optional `Workout.note` (with a `setDayNote` action) shown
inline on Today, in History rows and in the workout summary; ▲/▼
`<ReorderButtons/>` on Today exercises and Plan template rows
(`reorderExercise` store action for the former, local moves for the latter);
a CSV export beside the JSON one in Settings; a calm 3-tap `<FirstRun/>`
modal mounted from `App.tsx`, gated by `Preferences.firstRunDismissed`;
hardened insight thresholds so sparse-data warnings stop misfiring; a
`<CountUp/>` component used on the post-workout summary stats; a
*Log to Health* button on the summary that opens a `FitJournalLogWorkout`
Shortcut with the day's totals; an *Apple Health · use* pill on the Today
weight banner that one-tap-fills the day's body weight from the last sync.

The post-strategy-review roadmap is complete — every Critical, Important and
Nice-to-have item from the review is shipped to production.

A UX audit (2026-05-23, commit 83c5514) applied Nielsen, Hick, Fitts,
cognitive load, progressive disclosure, Jakob, WCAG 2.2, and behavioral
reinforcement lenses across all 7 screens, producing a 29-item P0–P3
backlog tracked at `../UX-AUDIT.md`. P0 is shipped: reorder button touch
targets fixed (WCAG 2.5.8), Undo toasts extended to template/recipe/goal
deletes, four hardcoded-colour escapes resolved to tokens, and
`min-height: 44px` globalised on `.fj-btn`.
