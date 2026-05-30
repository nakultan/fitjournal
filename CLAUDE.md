# FitJournal — codebase guide

Personal, offline-first fitness journal. React 19 + TypeScript + Vite, shipped
as an installable PWA. **IndexedDB is the source of truth**; the app runs fully
offline with no account required. **Optional multi-device sync** (Supabase) is
layered on top — when signed in, the on-device journal reconciles with a remote
`records` table; signed out (or in a build with no Supabase env vars) the app is
exactly the original local-only PWA. See `README.md` for the product overview
and the sync setup steps.

> **Direction note (2026-05-24, updated 2026-05-30):** the early-phase
> *privacy-first / no-servers* non-negotiable was retired so the product could
> grow a multi-device profile. That sync layer is now **built** (see
> *Multi-device sync* below). The core invariant held: IndexedDB stays the
> source of truth and sync sits on top, so offline-first is preserved and the
> 25 store actions were untouched.

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
data/store  (React context — state, actions, persistence, sync orchestration)
        ↓
data/logic + data/storage + data/sync  (derived logic; IndexedDB persistence; sync engine)
                                                      ↓
                                          lib/supabase (remote backend seam)
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
  silent data loss can never look saved. Also persists the **sync sidecar**
  (`emptySyncMeta()` / `loadSyncMeta()` / `saveSyncMeta()`) under its own
  IndexedDB key (`syncmeta`, localStorage fallback) — kept *beside* the journal,
  never inside `AppData`, so JSON backups/exports stay account-free.
- **`data/sync.ts`** — the **offline-first sync engine** (see *Multi-device
  sync* below). Pure core (`decompose` / `recompose` / `stampChanges` /
  `mergeRemote`, all unit-tested) plus a thin `synchronize()` that pulls deltas,
  merges, and pushes local winners. Per-record last-write-wins with tombstones.
- **`lib/supabase.ts`** — the single seam to the backend: exports the shared
  `supabase` client (or `null` when env vars are absent) and `isSyncConfigured`.
  Swapping to a self-hosted Supabase later is just changing the two env vars.
- **`data/logic.ts`** — *pure* derived computations: PRs, streaks (rest-day-
  aware, with a one-day grace), weekly & total stats, week-goal progress,
  session summaries, muscle balance, plateaus, insights/milestones, the
  activity heatmap, per-exercise history (`computeExerciseHistory`) with an
  Epley 1RM estimate (`estimate1RM`), and the cross-cutting helpers
  `findLastTime` / `formatSets`. **Nothing derived is ever stored** — it is
  always recomputed from `workouts`. This file and `storage.ts` have co-located
  `*.test.ts` suites (run with `npm test`); being pure makes them
  straightforward to unit-test.
- **`data/store.tsx`** — `StoreProvider` loads the journal *and* the sync
  sidecar (async — IndexedDB) and then mounts `StoreReady`, which holds `AppData`
  in React state, persists it on change (trailing-debounced ~400ms, and flushed
  immediately when the app is hidden or closed), and exposes typed actions that
  do immutable updates. The current `page` and viewed day come from the URL hash
  via `lib/router.ts`; the store also tracks `saveFailed` — true when the most
  recent persist failed. **Sync is wired in here without touching the 25
  actions:** the save effect diffs the previous vs next `AppData` and stamps
  changed/deleted records into the sidecar (`stampChanges`), then triggers
  `synchronize`. A `synchronize` cycle also runs on sign-in, app-foreground
  (`visibilitychange`), and reconnect (`online`). Exposes `sync` (a `SyncState`),
  `signIn` (magic link), `signOut`, and `syncNow`. Applying a pulled merge points
  the stamp baseline at the merged data first, so pulled records aren't
  re-stamped as local edits.
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

On-device storage is the source of truth; an IndexedDB record is effectively the
database, and `navigator.storage.persist()` is requested to keep it durable.
Multi-device sync (below) adds an *optional* off-device copy, but the local-only
safeguards still apply for signed-out use.

- **Export / Import** — Settings → Export writes a full JSON copy; Settings →
  Import restores one via `restoreData()`, behind a confirm step. A restore
  first auto-downloads a snapshot of the current data, so it can be undone.
- **`SaveErrorBanner`** — a persistent banner shown when a device write fails
  (the store's `saveFailed`); it urges an immediate export.
- **`BackupReminder`** — a calm, dismissible nudge to export, shown once there
  is data and the user has not backed up in three weeks (`lastBackupAt` tracks
  the last export). Both render globally from `App.tsx`.

## Multi-device sync

Offline-first sync against a Supabase `records` table. **IndexedDB stays the
source of truth; sync is a layer on top.** Off unless the build has both
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (`.env.local` for dev; GitHub
Actions secrets for the deployed build, threaded through `deploy.yml`). When
unset, `lib/supabase.ts` exports a `null` client and the app is the original
local-only PWA — the Settings sync card returns `null`.

- **Data shape.** One Postgres row per syncable record:
  `records(user_id, kind, id, data jsonb, updated_at, deleted, pk(user_id,kind,id))`,
  locked down by a row-level-security policy (`auth.uid() = user_id`). The app's
  nested objects go into `data` as JSONB untouched — no relational shredding.
  Collections become many rows: `workout` (id = date), `recipe` (id), and
  `loggedMeal` (id). Slower-changing pieces are `singleton` rows: `preferences`,
  `goals`, `weeklyPlan`, `health`, `lastBackupAt`, and `templates` (a singleton
  so the user's manual template order survives a round-trip).
- **Decompose / recompose** (`data/sync.ts`, pure). `decompose(AppData)` flattens
  the journal into `FlatRecord[]`; `recompose(records)` rebuilds it (recipes
  sorted newest-first by `createdAt` since they carry no manual order). Round-trip
  is identity — unit-tested.
- **Local change tracking.** A `SyncMeta` sidecar (in IndexedDB beside the
  journal, **not** in `AppData`) maps each record key `${kind}:${id}` to an
  `updatedAt` (and a `deleted` tombstone). The store's save effect calls
  `stampChanges(prev, next, meta)` — diffing the two `AppData`s — so the 25 store
  actions never had to learn about sync.
- **Merge** (`mergeRemote`, pure). Per-record last-write-wins by `updatedAt`,
  tombstones included; this is *per record*, so logging a workout on one device
  never clobbers a recipe edited on another. First sync (`lastPulledAt === null`)
  pushes everything local; the EPOCH default means a remote row wins a tie on a
  fresh device. Returns the merged journal, the new sidecar, and the rows to push.
- **Orchestration** (`synchronize`, then the store). Pull deltas
  (`.gt('updated_at', lastPulledAt)`), merge, upsert local winners stamped with
  `user_id`. The store runs a cycle on sign-in (`onAuthStateChange`),
  app-foreground (`visibilitychange`), reconnect (`online`), and after each
  debounced save; `syncInFlight` prevents overlap, and applying a merge updates
  the stamp baseline first so pulled records aren't mistaken for local edits.
- **Auth.** Email + password (`signInWithPassword` / `signUp`). `StoreValue`
  exposes `sync: SyncState`, `signIn(email, pw)`, `signUp(email, pw)`,
  `signOut`, `syncNow`; the UI is the `SyncCard` in `Settings.tsx` (Your data),
  which toggles between a sign-in and a create-account form. `signUp` returns
  `needsConfirm` true when the Supabase project has "Confirm email" on (no
  session until the user confirms once); with it off, the session lands
  immediately and sync starts. Sign-out stops syncing and leaves the local
  journal in place.
- **Known limitation** (fine for a single user): an edit during the sub-second
  async sync window can be transiently overwritten by `applyMerged`'s
  full-snapshot `setData`; it self-heals on the next edit. No CRDT — overkill for
  one person rarely editing the same record on two devices at once.
- **Tests:** `data/sync.test.ts` covers decompose/recompose round-trips,
  stamping, and the merge matrix (remote-only, conflict both directions,
  tombstones in/out, first-sync push).

## Project status

All five build phases are done, plus a Vitest suite over the data/logic
layer and five rounds of post-audit fixes. The original single-file app has
been retired to `../archive/`. Background (closed-app) scheduled reminders
are deliberately deferred — a server-less PWA can't fire them reliably; the
streak-save reminder instead nudges in-session (see P2.5).

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

P1 is shipped (2026-05-23): `lastSavedAt` in store + a 6 px `.fj-save-dot`
ripple on `PageHeader` (P1.1); `GoalModal` exported and the ExerciseDetail
goal tile made a tappable button that opens it (P1.2); `Sparkline` gained a
`label?` prop — ExerciseDetail, body-weight trend, weekly bar chart, and
heatmap all carry `aria-label` summaries (P1.3); Cardio section on Today
collapses to an "+ Add cardio" affordance when no cardio logged (P1.4);
RecipeDetail section headings (Nutrition / Ingredients / Steps / Notes)
converted to `<h3 className="fj-detail-sub">` (P1.5); CookMode surfaces
"Screen stays on" / "Screen may dim" in its top bar via `wakeLockActive` /
`wakeLockDenied` state (P1.6); Today shows a `.fj-today-hero` "Ready to
train?" hero when the day is completely empty (P1.7); Plan shows an
`EmptyState` with a Create CTA when no templates exist (P1.8); rest-timer
pill buttons got `min-width/height: 44px` + a `<RotateCcw>` icon on +15s
(P1.9); `.fj-fav-btn::before` extends the star touch area to ≥44×44 (P1.10);
HistorySection reordered: Past workouts list comes first, heatmap below
(P1.11).

P2 — the real design round — is also shipped (2026-05-23). `Preferences.todayLayout`
(`'classic' | 'focused'`, default classic) drives Today's density: focused mode
collapses `WeightBanner` to a `.fj-add-row` "+ Body weight" button when no weight
is logged and no Apple Health prefill is available, keeps the cardio form hidden
even when cardio entries exist, and collapses the Day note to a "+ Day note"
affordance until tapped (P2.1). The Plan weekly schedule is rewritten as 7
tappable `<Card>` rows; each opens an `AssignDaySheet` modal listing "Rest day" +
every template as `.fj-assign-choice` rows (P2.2). Settings is now grouped cards
with deep-link hash routes — `lib/router.ts` carries a `SettingsSection` type
(`preferences | data | health | about`); `navigateTo(page, date, exerciseKey,
settingsSection?)` and the store's `viewSettings(section)` / `viewingSettingsSection`
write and read them. Default `#/settings` shows the cards index; each
`#/settings/<section>` renders just that section with a "Settings" back button
(P2.3). A new `<ResumeSessionPill/>` (mounted from `App.tsx`) floats above the
bottom nav on every screen except Today and Session when today already has
exercises (P2.4). Progress Overview hides the Weekly sets chart + Insights +
Muscle balance behind a single "Show charts, insights & muscle balance" toggle
whose state persists in `localStorage` (P2.5). `RecipeCard` got a
`.fj-recipe-card__cook` `<ChefHat>` button next to the favorite star (only when
`recipe.steps.length > 0`) that launches Cook mode straight from the grid; the
existing detail path still works (P2.6).

P3 — the polish round — is shipped (2026-05-24), closing the audit. `Modal` is
now a native `<dialog>` (`showModal()` / `close()`, `::backdrop` for the overlay,
free focus trap + Escape via the `cancel` event, mobile sheet preserved via
`margin: auto auto 0` + `fj-sheet-in` keyframe on `[open]`) — the manual focus
trap and `.fj-modal-overlay` wrapper are gone (P3.1). `data/logic.ts` exports
`WEIGHT_MAX = 2000` and `REPS_MAX = 200`; Session set rows, Today's
`ExerciseModal` set rows, and Progress' `GoalModal` target weight all carry a
`max` attribute + `aria-invalid` + a calm `.fj-input-warn` line ("That's a lot
of weight — double-check.") when exceeded — never blocking, just a typo
guardrail (P3.2). Settings → Your data now shows a `.fj-settings-meta` row
with "Auto-saved [relative time] · Last backup [date / never]" using a
`relativeTime()` helper (P3.3). A `<button className="fj-skip-link">` skip-to-content
link sits as the first child of `.fj-app`; it focus-traps to
`<main id="fj-main" tabIndex={-1}>` programmatically (button + `onClick`, not
`href="#fj-main"` — the hash router would parse that as a route) and is hidden
via `transform: translateY(-200%)` until `:focus` (P3.4). P3.5 (in-page Settings
anchor nav) was deliberately dropped — P2.3 already shipped grouped Settings
cards with deep-link routes, so the stopgap was redundant. Trust is reinforced
with a `.fj-settings-trust` strip (lock icon + "Everything stays on this device
— no account, no servers.") rendered under PageHeader on every Settings screen,
and the same strip placed in `FirstRun` between the intro and the unit/goal
fields (P3.6). Settings → About gained a discreet `<details className="fj-howto">`
"What's new" expander reusing the existing how-to pattern; lists the recent
user-visible additions (P3.7).

A post-launch regression-fix pass shipped 2026-05-24 (build + 67 tests clean)
covering four user-reported issues:

- **Goal-weight input no longer accumulates a leading 0 on iPhone.**
  `Settings.tsx`'s goal-weight `<input>` renders empty when `goalWeight === 0`
  (with a `"0"` placeholder), declares `inputMode="decimal"`, and calls
  `e.currentTarget.select()` on focus so a tap-and-type replaces the existing
  value rather than appending to it. The weekly-goal input gets the same
  `onFocus` select-all + `inputMode="numeric"` for parity.
- **FirstRun tap/hover lag eliminated.** `.fj-btn`, `.fj-chip` and
  `.fj-scaler__btn` now carry `touch-action: manipulation` to kill iOS Safari's
  300 ms double-tap-to-zoom wait; `.fj-chip` and `.fj-scaler__btn` lost their
  `background`/`color` transitions so the active state flips instantly under
  the finger.
- **`.fj-ring` gained `flex-shrink: 0`** so the ProgressRing can never be
  squeezed by its parent flex row (which previously let the SVG visually
  overlap adjacent text on narrow viewports).
- **Today hub stacks vertically on mobile.** A new rule inside the
  `@media (max-width: 768px)` block flips `.fj-hub__top` to
  `flex-direction: column` and turns `.fj-hub__divider` into a full-width
  horizontal rule, so the streak stat and the weekly-progress ring each get
  the full card width rather than fighting over ~130 px each. (Note: that
  rule was retired in the v2 redesign below — `TodayHub` itself is gone.)

## v2 redesign (UX-audit v2)

A second design pass landed in `design_handoff_fitjournal_v2/` (annotated
wireframes + a 32-item P0–P3 backlog spanning all 7 screens). It builds on the
earlier audit; the wireframes are mid-fi (layout, hierarchy and copy are final;
visuals stay on the existing token system). Commits prefix the backlog ID
(`P0.1 …`, `P0.2 …`) so the git log lines up with the handoff.

**v2 P0 — shipped 2026-05-24.** Today's hierarchy is reversed: the lift list
is the screen now, not a row inside a dashboard.

- **P0.1 — Ambient header.** `TodayHub` (the 6-card streak/weekly/plan
  dashboard) was removed entirely. In its place a new `TodayAmbientHeader`
  renders a monospace strip (`SAT · MAY 24 · 12🔥 · 3/4 wk`) above a heavier
  display title — the assigned template name, or `"Today's workout"` if
  exercises are logged without one, or `"Rest day"` / `"No plan"` otherwise.
  Only shown when viewing today. The streak/weekly numbers haven't gone away
  — they live in full on Progress.
- **P0.2 — Sticky Start FAB.** New `TodayStartFab` — fixed bottom-right, 56px
  min-height, `--color-success` background, clears the bottom nav on mobile
  via the same `bottom: calc(64px + …)` pattern as the rest timer. Two-line
  content: `▶ Start session` and a monospace sub-label `N LIFT(S) · TRY <top>`
  where `<top>` is the heaviest planned top-set (falls back to each exercise's
  `findLastTime` top-set when today's weight is still 0). Mounted only when
  `isToday && exercises.length > 0`; the inline `Session` button in the
  Weight Lifting section head was removed (the FAB replaces it).
  `ResumeSessionPill` already hides on Today, so the two never collide.
- **P0.3 — Lift-row delta pill.** Each exercise row in Today's table carries
  a trailing `.fj-ex-delta` pill computed by the local `computeRowDelta`
  helper: `PR shot ★` (amber, takes precedence) when the planned top-set
  would beat the standing PR; `+N <unit>` (green) on a weight gain; `+N reps`
  (green) on a rep gain at the same weight; `same as last` (neutral) when
  matched. Returns `null` when the entry hasn't been entered yet (top == 0)
  or when `findLastTime` has nothing to compare against — first-time
  exercises stay quiet rather than shouting "PR".
- **P0.4 — Save dot system-wide.** Already shipped in v1's P1.1 — every
  `PageHeader` renders `.fj-save-dot` keyed on `lastSavedAt`, so the dot
  pulses on every screen that uses PageHeader (all 7). No change needed;
  verified.

Dead `.fj-hub__*` rules were dropped from `app.css` along with the imports
they backed (`Bell`, `CalendarCheck`, `Lightbulb`, `Moon`, `PlayCircle`,
`ProgressRing`, `computeInsights`). The mobile `.fj-hub__top` override
mentioned above was retired in the same pass; `.fj-today-ambient__title`
drops to `--text-title` on mobile and `.fj-start-fab` clears the bottom nav.

**v2 P1 — shipped 2026-05-24.** A11y polish, motivation loops, three
Progress routes, the ExerciseDetail recommendation engine, and per-screen
empty states.

- **P1.1 — Calm chip.** New `.fj-calm-chip` on the Today ambient header
  flips `Preferences.todayLayout` (`classic ↔ focused`, labelled
  *Classic / Calm*). Same persistence path as the buried Settings row,
  just promoted to the thumb zone — and the chip itself is `aria-pressed`
  with a soft haptic on flip.
- **P1.2 — Three rooms, three routes.** `lib/router.ts` gains a
  `ProgressSection` type (`story | records | history`); bare `#/progress`
  defaults to `story`. The segmented control is replaced by a
  `.fj-rooms` 3-card row picker with metaphor icons (BookOpen / Trophy /
  CalendarDays) — `role="tablist"`, `role="tab"`, `aria-selected`,
  arrow-key focus + selection. `OverviewSection` is renamed
  `StorySection` and prepends a one-line hero (`+N% tonnage this month` /
  `N-day streak in motion` / weekly count, picked by a new
  `computeStoryHero()`); when no data exists at all, Story falls through
  to a metaphor empty state. `ExercisesSection` is renamed
  `RecordsSection`. Store exposes `viewingProgressSection` +
  `viewProgress(section)`. Old `#/records` / `#/history` deep links
  already redirect to Progress via the existing retired-screen guard.
- **P1.3 — Next-session recommendation.** New pure
  `recommendNextSession(history)` in `data/logic.ts` (3 unit tests):
  bumps the top-set weight +5 when there have been ≥ 2 sessions in the
  last 14 days AND the last top-set hit 5+ reps; otherwise repeats the
  last session. ExerciseDetail surfaces it as a blue `.fj-detail-rec`
  card with a Sparkles glyph and an explanation line. The same helper
  powers Session's per-exercise subtitle (P0.3-Session).
- **P1.4 — PR-shot flag.** Already shipped as part of P0.3's
  `computeRowDelta` in `pages/Today.tsx`; verified no change needed.
- **P1.5 — Metaphor empty states.** One per affected screen:
  Today (`BookOpen` — *"Today's a fresh page."*), Story (*"Train once
  and a story starts."*), Records (`Trophy` — *"Your first PR is one
  rep away."*), History (`CalendarDays` — *"The heatmap is waiting."*),
  Plan (`CalendarDays` — *"You haven't planned a week yet."* with a
  **Start with PPL** CTA that calls the newly exported
  `seedPushPullLegs()` from `storage.ts` and seeds Push / Pull / Legs
  templates), Recipes (*"A fresh recipe keeper."* / *"Nothing matches
  that filter."*).
- **P1.6 — Goal trajectory.** New pure
  `computeGoalTrajectory(history, goal)` in `data/logic.ts` (3 unit
  tests): linear-fit projection from the last 8 sessions, using
  whichever of top set or e1RM is closer to the goal. Returns weeks-to-
  goal only when the slope is positive; otherwise hides the weeks half
  and keeps the lb-to-go half. ExerciseDetail renders it as an amber
  `.fj-detail-trajectory` card under the rec.
- **P1.7 — Distinguished pills.** The 4-tile `StatTile` grid on
  ExerciseDetail is replaced by `.fj-detail-pills` — three category
  pills with three palettes: `--pr` (green, past achievement),
  `--e1rm` (blue, projection), `--goal` (amber, future commitment),
  plus a neutral Sessions pill. Goal pill is the tappable
  `.fj-detail-pill--btn` that opens `GoalModal`. Vocabulary matches the
  Today row delta pills (P0.3).
- **P1.8 — Streak ratchet.** The streak number in the Today ambient
  header is wrapped in `<CountUp/>` so it ticks on change; a `useRef`
  gate fires `tap()` only when the value *increases* (skips initial
  mount so reloading mid-streak stays quiet). Session also fires
  `tap()` from `toggleSet` when the first set of the session is
  checked (`doneSets.size === 0`), not on subsequent checks — the
  in-session counterpart of the same "first rep matters" cue.
- **P1.9 — Future-day picker guard.** Today's date input declares
  `max={todayKey()}`, its onChange swallows future values, and the
  `▶` next-day button carries `disabled={isToday}`. Silent prevention
  — no toast.
- **P1.10 — A11y bundle.** Today's date label gains
  `aria-haspopup="dialog"` (it opens a native date picker). The cardio
  type buttons in both `CardioForm` and `CardioModal` are extracted
  into a shared `<CardioTypeTabs/>` with `role="tablist"`,
  `role="tab"`, `aria-selected`, and arrow-key focus + selection. The
  Progress room picker uses the same pattern.
- **P1.11 — One primary CTA on Session.** The set row itself is now
  the "Complete set" target (`role="button"`, `aria-pressed`,
  Enter / Space activation). Weight and reps inputs stay always-editable
  and stop click propagation (`stopBubble` on `onClick` + `onFocus`) so
  tapping a number opens the keypad without toggling done. The big
  check on the right is decorative now — `aria-hidden`, no separate
  click handler.

- **P0.3-Session — Subtitle promotion.** SessionExerciseCard renders a
  dominant `.fj-session-ex__subtitle` reading `N sets planned · last
  time (date): … · try X`. The green `try X` segment is sourced from
  `recommendNextSession` and only appears when the heuristic actually
  bumped — repeating the same weight stays quiet.

**v2 P0 + P1 audit-and-fix pass — shipped 2026-05-24.** A line-by-line
re-read against the wireframe HTML caught a clutch of real bugs and a few
structural deviations that slipped through the initial P0 / P1 ships. All
fixed in one pass; existing 70-test suite grew to 77.

P1 logic bugs:

- **`computeGoalTrajectory` over-counted "best".** Used
  `Math.max(latest.topSet, latest.oneRm)` for the remaining-to-goal calc, so
  a high Epley projection silently retired the trajectory card while the
  lifter still hadn't put the weight on the bar (e.g. 180 × 5 → e1RM 210
  cleared a 200-lb goal). Now uses `latest.topSet` only; slope still picks
  whichever of top set / e1RM sits closer to the goal. Regression test
  asserts a 200-lb goal stays open at top set 180.
- **`recommendNextSession` used a 14-day window.** Spec called for 7-day;
  doubled to 14 in the original ship. Now 7 days, with a new test pinning
  the boundary (an 8-day-old session is excluded so `bumped: false`).
- **`computeStoryHero` ignored the weekly plan.** Called `computeStreak`
  with `{}` for the plan, so a Mon/Wed/Fri lifter on a real 4-day streak
  read as a 1- or 2-day blip and the hero's streak narrative never fired.
  Now takes `weeklyPlan` as a parameter; threaded `data.weeklyPlan` at the
  StorySection call site.
- **Session row `onKeyDown` swallowed input Space.** The row-tap-to-complete
  handler fired on Enter/Space without checking `e.target !== e.currentTarget`,
  so pressing Space while editing weight in the keypad silently marked the
  set done. Guard added so typed Space stays in the input.

P1 spec deviations:

- **P1.1 Calm chip.** Was a stateful label flip ("Calm" / "Classic" with
  Moon / Sun icons); the wireframe shows a single monospace `🌙 Calm` pill
  that's pressed-on / pressed-off. Refactored — one Moon icon, fixed
  "Calm" label, `aria-pressed` drives the on/off treatment with
  accent-soft + accent border when on.
- **P1.2 Room picker.** Was a horizontal 3-column compact button row; the
  wireframe shows a vertical stack of 3 Card-style rows under a
  `CHANGE ROOM` label, each with an icon + title + metaphor sub on the
  left and a `here` pill (active) or chevron (inactive) on the right.
  Rewritten to match — `.fj-rooms` is now a vertical stack of
  `.fj-rooms__row` Cards with `.fj-rooms__icon` / `.fj-rooms__body`
  (title + sub) / `.fj-rooms__here` indicator. Tablist a11y preserved;
  arrow keys move focus + selection both vertically and horizontally now.
  Metaphor copy updated to the wireframe's exact strings
  ("Weekly recap, insights, body weight" / etc).
- **P1.7 Extra pill.** Shipped 4 pills (PR / e1RM / Goal + Sessions); the
  wireframe specifies 3 only. Sessions pill removed — the session count
  still surfaces in the PageHeader subtitle.
- **P1.11 Edit affordance.** Was always-editable inputs (third
  interpretation, neither long-press nor pencil); the brief asked for
  "long-press OR explicit pencil icon." Refactored: each set row is now
  read-only `185 × 8 lb` text by default with a `.fj-session-set__edit`
  pencil button that toggles inputs (Check icon while editing). Row tap =
  complete; inputs stop click + focus + keydown propagation. A derived
  `showInputs = editing && !done` collapses the inputs back to display
  when the set is marked done — no `setState` in effect.

Copy nits (now matching the wireframe verbatim where possible):

- P1.6 trajectory: `**N lb to go** · ~M weeks at current rate` /
  `Trajectory based on last 8 sessions.`
- P1.3 rec sub (when bumped): `+5 lb on top set · within recovery range`.
- P0.3-Session subtitle: `set X of N` (computed from `doneSets` count) —
  was `N sets planned`. Falls back to `all N sets done` when complete.
- P1.5 History empty state: `A grid of empty days, waiting to fill.`

P0 logic bugs:

- **PR-shot label was dead code.** The check `pr.date !== todayK` was
  meant to guard against today's own entry inflating the PR calc, but
  `computeStrengthPRs` already walks today's data, so the moment a planned
  weight saved it became `pr.date === today` and the label silenced
  itself. Effect: the wireframe's signature `PR shot ★` pill literally
  never rendered. Fixed with a new pure helper
  `topSetExcluding(workouts, name, excludingDate)` in `data/logic.ts` (1
  new unit test) that walks history minus the given date; Today computes
  `priorPR = topSetExcluding(...)` and fires `isPRShot = top > priorPR`,
  which actually triggers.
- **PR-shot was conflated with the delta pill.** Shipped as a tone variant
  of the single delta pill (PR-shot mutually exclusive with `+N lb`); the
  wireframe shows BOTH pills together on the same row when both apply.
  Split into its own `.fj-ex-delta--pr` pill rendered alongside the delta.
  `computeRowDelta` simplified to return only `success` / `neutral` tones.
- **Half-pound deltas were `Math.round`ed.** A 2.5 lb plate increment read
  as `+3 lb`; 1.25 / 2.5 kg increments rounded similarly. Fixed in both
  the row delta (`Number((top - lastTop).toFixed(1))`) and the FAB
  `suggestedTop` (`Number(best.toFixed(1))`), preserving real plate math
  while trimming floating-point cruft.

P0 spec deviation:

- **Lifts section header.** Was `<h2><Dumbbell/> Weight Lifting</h2>`; the
  wireframe shows a small uppercase `TODAY'S LIFTS · 6 EX · ~50 MIN` strip.
  New `.fj-section__title--label` modifier renders the `<h2>` as
  `--text-micro`, uppercase, `--color-text-dim`. The header now reads
  `Today's Lifts · N ex`; the time estimate is deliberately skipped (no
  honest per-exercise duration data). Trophy icon on PR rows kept for
  now — overlaps with the new PR-shot pill on a logged-PR day (two
  signals for one event), happy to retire if you want full v2 visual
  compliance.

**v2 P2 — shipped 2026-05-25** (build + 90 tests + lint + typecheck clean —
77 → 90 tests: 3 storage tests for the v2→v3 migration, 10 logic tests for
the new pure helpers). The "design round" — Train-Mode takeover, adaptive
nav, protein bridge, fresh-start moments, visual rest ring. All 12 items
land in one tier; schema bumps 2 → 3 additively.

Data-model + storage:

- **`SCHEMA_VERSION` 2 → 3** with a v2→v3 migration step in `storage.ts`
  that assigns cyclic default `TemplateColor`s
  (`['red','blue','green','amber','neutral']`) to any pre-existing
  templates that lack the new field, and initialises `loggedMeals: []`.
  `normalize()` now also fills `loggedMeals` on partial backups. Old
  saves keep working unchanged — additive only.
- **New types:** `TemplateColor`, `LoggedMeal`, `StreakNudge`,
  `BackupReminderWeeks`. **New fields:** `Template.color?`,
  `Recipe.seed?`, `Preferences.dailyProteinGoal?` (default 140),
  `Preferences.freshStartDismissedWeek?`, `Preferences.streakNudge?`,
  `Preferences.backupReminderWeeks?` (default 3), `AppData.loggedMeals?`.
  `RecipeTag` gains `'post-workout'`.
- **`seedStarterRecipes()`** in `storage.ts` returns three starters
  (Salmon rice, Tuna pasta, Oats & whey) all flagged `seed: true`. The
  PPL seed in `seedTemplates()` lands with `color: 'red' | 'blue' |
  'green'` so Plan's chip strip has stable swatches from the first run.
  `defaultData()` returns both seeds on a fresh install; `normalize()`
  trusts imported backups and never re-seeds into someone else's data.
- **Two store actions** for the protein bridge: `addLoggedMeal(recipeId,
  date, servings?)` returns the new entry id (so Undo can target it),
  and `removeLoggedMeal(id)`.

P2.1 — Train Mode takeover. `AppShell` skips both the desktop sidebar
and the mobile bottom nav when `page === 'session'`, applying
`.fj-app--trainmode`. The skip-link still focuses `<main>` so a
keyboard user can leave. `ResumeSessionPill` already self-hid on session,
so the two never collide.

P2.6 — Adaptive bottom bar. New sticky `.fj-session-bottom` 2-action
strip — outline Pause (collapses back to Today without ending the
session) on the left, solid Finish workout (opens `WorkoutSummaryModal`)
on the right. Replaces the standard 5-tab nav for the duration of the
workout. `.fj-app--trainmode .fj-screen--session` pads bottom by 72px +
safe-area so the bar never covers content.

P2.7 — Visual rest ring. The floating `RestTimerBar` is retired.
SessionScreen tracks `lastCompleted: {exId, setIndex}` from
`toggleSet`; while the timer is `active && !isDone`, the first un-done
set within the just-completed exercise is the "resting target" and
adopts `.fj-session-set--resting` (blue treatment, larger numbers,
"RESTING" caption replacing the set number). A `ProgressRing` on the
right shows the rest fraction with the `mm:ss` remaining in the centre,
and `.fj-session-set__rest-actions` renders `+15s` / `skip rest` pills
in context — no more chasing a floating control. Computed inline (not
via `useMemo`) so the React Compiler can memoize it itself; the manual
useMemo could not be preserved across the `timer` object's property
access.

P2.3 — Plan rotation. The weekly schedule is now anchored on today —
row 1 is today (`TODAY · SAT` tag + accent-soft tinted card head + a
small `▶ Start` button that deep-links to Today), rows 2–7 walk
forward. Each row reads its template from `data.weeklyPlan[dayName]`
and renders a coloured `.fj-plan-chip-dot` per the template's
`TemplateColor`. The `AssignDaySheet` is unchanged in behaviour; its
title now reads `Assign Today (Sat)` when the assigned day is today.

P2.8 — Template chip strip + colour picker. The old `fj-card-grid`
of big template cards is gone. Plan opens with a `.fj-template-strip`
header row of `.fj-template-chip--{red,blue,green,amber,neutral}`
pills (one per template, with a coloured dot), then a dashed `+ new`
chip at the end — tap any chip to open `TemplateModal`. The modal
itself gained a 5-swatch `.fj-color-swatch` radio-group picker. Plan
day-rows show the matching colour dot. (P3.4 — "edit" link → separate
full-screen template editor — deliberately deferred to P3.)

P2.9 — Seeded starter recipes. `defaultData()` now seeds three
recipes (Salmon rice, Tuna pasta, Oats & whey), each with realistic
nutrition + tags. `RecipeCard` shows a small `.fj-recipe-card__seed`
tag next to the title on any recipe with `seed: true`. The flag is
preserved through edits so the "this came from the install seed"
context survives the lifter customising the recipe; deleting a seed
clears it (and we don't re-add it).

P2.10 — Protein bridge. `proteinForDay(loggedMeals, recipes, date)` in
`logic.ts` sums `servings × recipe.nutrition.protein` for entries on
the given date (treats missing nutrition as zero rather than guessing,
ignores meals on other dates). Recipes renders a `.fj-protein-bar`
above the grid showing `<sum> / <goal> g` with a filled track; turns
green once the goal hits. `RecipeDetail` gains a *Log as eaten*
button that pushes a 1-serving `LoggedMeal` for today via
`addLoggedMeal`, with an Undo toast wired to `removeLoggedMeal(id)`.

P2.2 — Recipes ↔ Today bridge. New pure
`postWorkoutRecipe(recipes)` in `logic.ts` picks the recipe to surface
(favourites first; among ties, highest per-serving protein; falls
through to `post-workout`-tagged). Today renders a
`.fj-post-meal` card below the lift list when today has exercises
**and** `postWorkoutRecipe` returns one. Tap routes the recipe id
through `sessionStorage['fj-open-recipe']` and `navigate('recipes')`;
`RecipesScreen` pops it via the lazy `useState` initializer so the
detail opens without a flash. Bidirectional: any recipe matching the
selection criterion carries a blue `.fj-recipe-card__today` pill in
the top-right of its photo tile when today has lifts.

P2.11 — Filter pill. `RecipesScreen` watches
`data.recipes.length > 20`; above the threshold the inline `Chip` row
collapses into a `Filter ▾` `.fj-recipes-filter-btn` with an active-
count badge. Tap opens `<FilterMenu>` (a small `Modal` with the
same Favorites + tag chips), with a Clear-all button. Below the
threshold the inline chips stay (the original behaviour) so first-
time users see what's available at a glance.

P2.12 — Fresh-start Monday strip. New `<FreshStartStrip>` on Today
fires only on Mondays and only when
`Preferences.freshStartDismissedWeek !== isoWeek(today)`. Reads "New
week. Last week you trained N×. Match it?" when last week had
workouts, or a calmer "A fresh page — log one workout and the week
starts." when it didn't. Dismissal writes the current ISO week back
to the preference so the strip stays gone for the rest of the week.
New pure `isoWeek(date)` helper in `lib/dates.ts` returns
`YYYY-Www` (ISO 8601 — Monday-first, Thursday-anchored year). 3
unit tests pin the week boundary across Sunday/Monday + pad single-
digit weeks.

P2.4 — Sparkline tooltips + per-day breakdown. `Sparkline.tsx` gains
`tooltip` / `pointLabels[]` / `valueFormat` props. When enabled, the
component renders a small dot per datapoint, tracks the nearest point
under the pointer on `pointermove` / `pointerdown`, and renders a
`.fj-sparkline-tip` anchored to that point's x-position with the
formatted `{label}: {value}`. A dashed vertical guide on the active
point keeps the connection visual. Used on Progress (body-weight
trend with date labels) + ExerciseDetail (top-set + e1RM trends with
date labels). A six-reading `.fj-sparkline-readout` under the
body-weight chart mirrors the visual for screen readers and lets
users page through specific values without hovering.

P2.5 — Settings → Nudges + backup pill. New `NudgesGroup` sub-section
under Preferences: streak-save reminder (Toggle + time picker; on
enable, requests `Notification.requestPermission()` — degrades
calmly when denied or unsupported, and shows a warning line when
notifications were blocked after enable) + a backup-reminder cadence
select (1 / 2 / 3 / 4 weeks). `BackupReminder` now reads
`Preferences.backupReminderWeeks` instead of the old hard-coded
`REMIND_AFTER_DAYS = 21`. Settings index "Your data" card carries a
`.fj-settings-card__pill` "N wks since backup" / "never backed up"
amber chip when overdue.

The streak-save reminder fires **in-session** (see the post-P3 review
entry below): `useStreakReminder` (mounted in `AppShell`) schedules a
one-shot timer for the next chosen `HH:mm`; on fire, if today still
isn't logged, it shows the notification (service-worker
`showNotification`, falling back to the `Notification` constructor) then
reschedules for the next day. Opening the app *after* the time has
passed waits until tomorrow, so it never double-fires. Closed-app
delivery still needs Web Push + a server (deferred — it would break the
no-account / no-servers promise); the toast + row copy are honest that
the nudge fires only while FitJournal is open.

**v2 P3 — shipped 2026-05-25** (build + 90 tests + lint + typecheck
clean — P3 is UI/animation polish, so no new pure logic to unit-test).
The visual + motion round closes the v2 backlog. Seven actionable items;
P3.5 was already delivered in P2.5, and P3.2 / P3.3 from the original
audit were absorbed by earlier v1 work (input ceilings + the
system-wide save dot / future-day guard), so they carried no new code.

P3.6 — Dark-theme softening. `tokens.css` retires pure `#000` for a
cool near-black: the dark surface ramp is now `oklch(...)` with hue 250
and a tiny chroma (`--color-bg: oklch(0.12 0.01 250)` up through
`--color-surface-3` / `--color-border`), lightness steps chosen to match
the old neutral greys so contrast ratios hold. Light theme's
`--color-surface-2` warms a few LCH points to a faint cream
(`oklch(0.925 0.006 95)`) in both the explicit `[data-theme='light']`
block and the `prefers-color-scheme` block. This is the only token-file
diff in the round.

P3.7 — Page-header rhythm. `PageHeader` gains a `kind?: 'hub' | 'tool'`
prop (default `hub`). `tool` adds `.fj-page-header--tool`, dropping the
title from `--text-display` to `--text-title`. Applied `kind="tool"` to
Plan / Recipes / Settings; Today and Progress stay hub (heavier).
ExerciseDetail and Session are left as-is (Session has its own custom
`.fj-session-head`).

P3.9 — Rotating Settings microcopy. New `RotatingTrust` component on the
Settings *index* shows one trust signal at a time — workout count /
on-disk footprint (`navigator.storage.estimate()`, async, dropped from
the pool when unsupported) / backup age — picked deterministically from
the calendar day (sum of the `YYYY-MM-DD` char codes mod pool size) so
it's stable within a day but varies over time. The steady "no account,
no servers" `.fj-settings-trust` line still shows on the sub-section
screens; the index swaps in the rotating line so the two never stack.

P3.1 + P3.8 — Drag reorder + FLIP. New shared `lib/flip.ts`:
`useFlip(containerRef, key)` records the clean viewport rect of every
`[data-flip-key]` child on each commit (captured *before* any inverting
transform is applied, so the baseline never lags a move — see the
post-P3 review fix below), and when `key` next changes inverts each
moved row to its old position then releases it over 150 ms `ease-out`
(skips the first commit so rows don't slide in on mount; honours
`prefers-reduced-motion`; clears inline styles on `transitionend`).
Wired into:
- **Today lift rows** — `liftTableRef` on `.fj-table`, key = ordered
  exercise ids, `data-flip-key={e.id}` per row. Animates the existing
  ▲▼ `ReorderButtons` (Today keeps chevrons, per the brief — no drag
  handle on the crowded row).
- **TemplateModal exercise rows** — draft rows now carry a stable local
  `_k` (`DraftExercise = TemplateExercise & { _k: string }`, stripped on
  save) so identity survives reorders; `key`/`data-flip-key` use it. A
  `GripVertical` `.fj-template-row__grip` is `draggable` (HTML5 DnD);
  the row handles `onDragOver`/`onDrop` and calls the existing
  `moveRow`. ▲▼ buttons stay as the keyboard-accessible fallback.

P3.4 — Template manager (the strip's `edit` link). New
`TemplateManagerModal` (shown only when `templates.length > 1`) lists
every template as a `.fj-tmpl-manage-row` — grip + colour dot +
tap-to-edit body + ▲▼ + delete (with Undo). Reorders persist via a new
`reorderTemplate(fromIndex, toIndex)` store action and FLIP-animate via
the same helper. The `edit` chip (`.fj-template-chip--edit`) is
right-aligned at the end of the strip.

Bug fix bundled in the same pass — **FirstRun unit-chip lag**. The
kgs/lbs chips had no CSS transition (instant by design), so the
perceived hover/active lag wasn't the chips — it was the modal
`::backdrop`'s `backdrop-filter: blur(16px)` saturating the GPU
compositor, delaying every repaint inside the dialog by a frame or two
(visible on Retina Macs and iPhones alike). Dropped to `blur(4px)`,
which keeps the frosted look for a fraction of the per-frame cost.
Affects all modals. If any lag remains the next lever is removing the
blur entirely and keeping only the overlay tint.

**Post-P3 review — fixes (2026-05-28)** (build + 90 tests + lint +
typecheck clean). A full re-audit of the P2/P3 work against the handoff
spec surfaced two issues, both fixed:

- **FLIP reorder baseline was a move behind** (`lib/flip.ts`). The hook
  re-measured positions *after* `playFlip` had applied the inverting
  transforms, so `getBoundingClientRect()` (which includes transforms)
  read each moved row's pre-move spot and the saved baseline never
  advanced. Only the *first* reorder animated; later ones computed
  zero/wrong deltas, so rows jumped or stayed still. Fix: `playFlip` now
  captures each row's clean position *before* applying its transform and
  returns that map as the next baseline (the post-loop `recordPositions`
  re-measure is gone). Affects all three reorder surfaces — Today lifts,
  `TemplateModal` exercise rows, `TemplateManagerModal`. No tests (it's
  DOM-animation timing, which the suite can't observe) — verified by
  trace.
- **Streak-save reminder now actually fires.** The earlier "stores
  intent only" gap is closed. New `lib/useStreakReminder.ts` — a hook
  mounted in `AppShell` that, when the reminder is enabled and
  permission is granted, sets a one-shot timer for the next chosen
  `HH:mm`; at fire time, if `isLoggedWorkout(workouts[todayKey()])` is
  false, it shows the notification (prefers the service-worker
  `registration.showNotification`, falls back to `new Notification`;
  icon = `import.meta.env.BASE_URL + 'pwa-192.png'`) then reschedules
  for the next day. The latest workouts are read through a ref so logging
  a set doesn't reset the timer. Opening the app after the time has
  passed waits until tomorrow. The Settings toast + row description were
  corrected to say the nudge fires *while the app is open* rather than
  the old "your device will nudge at the chosen time" (which implied a
  closed-app push that a server-less PWA can't deliver).

## Multi-device sync — shipped 2026-05-30

Optional offline-first sync against Supabase, retiring the per-device data
silo. Design and file-by-file behaviour are documented in the **Multi-device
sync** section above; this entry records the ship. Build + 104 tests (was 90 —
+14 in `data/sync.test.ts`) + lint + typecheck clean.

- **New:** `lib/supabase.ts` (the client seam + `isSyncConfigured`),
  `data/sync.ts` (pure decompose/recompose/stampChanges/mergeRemote +
  `synchronize`), `data/sync.test.ts`, `.env.example`. `@supabase/supabase-js`
  added.
- **Changed:** `data/types.ts` (+`RecordMeta`/`SyncMeta` — sidecar types, no
  `SCHEMA_VERSION` bump since they live outside `AppData`); `data/storage.ts`
  (generalised `idbGet(key)`/`idbPut(value,key)`, added the syncmeta
  load/save/empty helpers); `data/store.tsx` (sync orchestration wired into the
  existing save path — the 25 actions untouched); `data/store-context.ts`
  (+`SyncState`, `sync`/`signIn`/`signOut`/`syncNow` on `StoreValue`);
  `pages/Settings.tsx` (`SyncCard` at the top of *Your data*);
  `.github/workflows/deploy.yml` (passes the two `VITE_SUPABASE_*` secrets into
  the build).
- **Decisions:** hosted Supabase (free tier) over self-hosting — migration to a
  self-hosted instance later is an env-var swap. Per-record LWW + tombstones,
  not CRDTs (single-user). `templates` synced as one singleton to preserve
  manual order. Recipe photos sync inside the recipe JSONB (fine at personal
  scale; could move to Supabase Storage if rows get heavy).
