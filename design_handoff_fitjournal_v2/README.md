# Handoff: FitJournal v2 — UX-audit redesign

## Overview

This bundle hands off the **FitJournal v2 redesign** — a 32-item UX overhaul
covering all 7 screens plus system-wide changes. It is the answer to the
2026-05-23 UX audit (`../UX-AUDIT.md` in the repo) and absorbs every P0–P3 item
from sections 11 & 12 of that audit.

Two structural bets do most of the work:

1. **Reverse Today's hierarchy** — demote the 6-card hub, promote the lift list
   with "last time" deltas baked in, add a sticky Start-session FAB.
2. **Train Mode for Session** — full-screen takeover, 2-action bottom nav
   (Pause · Finish), rest visualised on the active set card.

## About the design files

The files in `wireframes/` are **design references** — paper-aesthetic HTML
wireframes annotated with numbered marks that map to backlog IDs. They are not
production code to copy. Your job is to **re-implement the design decisions in
the existing FitJournal codebase** (React 19 + TypeScript + Vite, styled with
the `fj-` design-token system in `src/styles/`). The codebase already has a
mature component kit (`src/components/`), a token system (`src/styles/tokens.css`),
and one file per screen (`src/pages/`). Lift the *intent* of each annotation
into the real component tree — do not import the wireframe's paper styling.

- `wireframes/FitJournal v2 - Final.html` — the v2 design, screen by screen, with
  numbered annotations and shipped-tag rows confirming which backlog IDs each
  screen delivers. **Read this first.**
- `wireframes/UX Audit.html` — the original audit that produced the backlog.
  Useful as context for *why* each change exists, but the v2 wireframe is the
  source of truth for *what* to build.

## Fidelity

**Wireframe / mid-fi.** Layout, hierarchy and copy are final; visual styling
(typography, iconography, colour, motion) is deliberately not. Treat the
wireframe's paper/handwritten aesthetic as a presentation device, **not** the
visual target — FitJournal's real visual system lives in
`src/styles/tokens.css` and `src/styles/components.css` and uses Lucide icons.

The v2 wireframe explicitly notes (in section 8 / Tally):

> "This is still wireframe. The visual design pass (typography, real
> iconography, the softened dark theme, motion polish) is a separate round."

So: implement layout, copy, hierarchy and interactions to spec; keep the
existing FitJournal visual style; treat the dark-theme softening (P3.6) as the
one visual change inside this round.

## How to use this with Claude Code

1. Drop this whole folder into the repo root: `fitjournal/design_handoff_fitjournal_v2/`.
2. Open Claude Code in `fitjournal/`. It will pick up `CLAUDE.md` automatically.
3. Point it at this README — e.g. *"Read `design_handoff_fitjournal_v2/README.md`
   and implement the v2 redesign one priority tier at a time, starting with P0."*
4. Work tier by tier (P0 → P1 → P2 → P3). Each tier should be a separate commit
   with `npm test && npm run typecheck && npm run lint` clean before moving on.

## Backlog tiers

| Tier | Count | Scope                                                                                  |
| ---- | ----- | -------------------------------------------------------------------------------------- |
| P0   | 4     | Ship-now. Today hierarchy reversal, sticky FAB, lift-row deltas, auto-save dot system-wide. |
| P1   | 11    | A11y polish, motivation loops, Calm-mode toggle, three Progress routes, ExDetail recommendations. |
| P2   | 12    | Train Mode, adaptive nav, protein bridge, fresh-start moments, visual rest ring.       |
| P3   | 9     | Softened dark theme, type rhythm, reorder FLIP animation, rotating microcopy.          |

The wireframe's "What changed" sidebar next to each screen carries the canonical
backlog IDs (P0.1, P1.7, etc) and a "shipped" pill row at the bottom confirming
which IDs that screen delivers. Use those IDs as commit-message prefixes so the
git log lines up with the audit.

---

## Screen-by-screen map (wireframe section → codebase file)

For each screen below: the source file you'll edit, the wireframe anchor to
read, and the concrete changes to apply.

### 1. Today — `src/pages/Today.tsx`

**Wireframe:** `#today` (section 1, "SCREEN ONE / Today").

The biggest single redesign. Reverse the hierarchy: the lift list is the screen,
not a row inside a dashboard.

- **P0.1 — Ambient header replaces the hub card.** Today currently opens with a
  6-card dashboard (streak, weekly progress, body weight, etc). Replace it with
  a single monospace strip: `SAT · MAY 24 · 12🔥 · 3/4 wk` above a heavier
  display title (`Push Day`, or the assigned template name; "Rest day" or "No
  plan" otherwise). The numbers don't disappear — they live in Progress.
- **P0.2 — Sticky "▶ Start session" FAB.** Bottom-right, ~56pt, green,
  positioned above the bottom nav. Sub-label shows lift count + suggested top-set
  weight (e.g. `6 LIFTS · TRY 185`). Promote the *Start* action from
  `WeightBanner`/inline button to a thumb-zone FAB. Hide when day has no
  exercises (use the existing `fj-today-hero` empty state instead).
- **P0.3 — Lift rows carry deltas.** Every exercise row gets a trailing pill:
  `+5 lb`, `+2 reps`, `same as last`, or `PR shot ★`. Source the delta from
  `findLastTime()` in `data/logic.ts`; "PR shot" fires when the next planned
  top-set exceeds the current PR for that exercise. Move existing `last:`
  strings out of grey 10pt and into a real visual element.
- **P0.4 — Auto-save dot in every PageHeader (system-wide).** The existing
  `fj-save-dot` ripple (currently only on Today) extends to every screen's
  `PageHeader`. Hook into `lastSavedAt` from the store. See `PageHeader.tsx`.
- **P1.1 — "🌙 Calm" header toggle.** Promote the existing
  `Preferences.todayLayout` (`classic` / `focused`) toggle from buried Settings
  to a header chip on Today itself. Same persistence path, just a more visible
  control. Rename `focused` → `calm` in copy (not in the type — keep the
  migration cost zero).
- **P1.4 — PR-shot flag.** Same row as the delta pill; amber, star glyph.
  Computed against current PR + the day's planned top set.
- **P1.8 — First-set-of-day ratchets streak with CountUp + soft haptic.** When
  the user checks the first set of the day, animate the streak number via
  `CountUp.tsx` and trigger `tap()` from `lib/feedback.ts`. Don't fire on the
  second + subsequent sets.
- **P1.9 — Future-day picker guard.** In the date picker, set `max` to today's
  `YYYY-MM-DD`; disable the `▶` arrow when already on today. Silent prevention,
  no toast.
- **P2.2 / P2.10 — Recipes ↔ Today bridge.** A single post-workout meal card
  appears below the lift list when (a) today has exercises and (b) at least one
  recipe is starred or tagged `post-workout`. Card shows recipe name, kcal, and
  grams of protein with a `Cook` button that calls `navigateTo('recipes')` and
  opens that recipe's Cook mode. Bidirectional: see Recipes §6.
- **P2.12 — Fresh-start Monday strip.** Amber `Card` between header and lift
  list, shown only on the first Today-visit of an ISO week, only on Monday or
  the user's first lift day of the week. Copy: "**New week.** Last week you
  trained 3×. Match it?" — interpolate the real count. Dismissible; persist
  dismissal as `Preferences.freshStartDismissedWeek: string` (the ISO week).
- **P3.7 — Page-header rhythm.** Today (a *hub* screen) gets the heavier display
  title + monospace ambient strip; tool screens (Plan, Recipes, Settings) keep
  a lighter sub-display. Implement as a `kind="hub" | "tool"` prop on
  `PageHeader`. Progress is also a hub.

### 2. Session — `src/pages/Session.tsx`

**Wireframe:** `#session` (section 2, "SCREEN TWO / Session — Train Mode").

Promote Session from "a screen with a bottom nav" to a full-screen takeover.

- **P2.1 — Full-screen takeover.** Hide the standard 5-tab `BottomNav` while
  `viewingPage === 'session'`. The simplest path: have `AppShell.tsx` skip the
  nav when the current page is `session`. Also hide the side rail on desktop.
- **P2.6 — Adaptive bottom bar.** Replace the bottom nav with a 2-action bar:
  outline `⏸ Pause` (left) and solid-fill `✓ Finish workout` (right). Pause
  collapses the session view back to Today without ending it. Finish opens
  `WorkoutSummaryModal` (already exists in `Today.tsx`).
- **P2.7 — Visual rest countdown ring.** The current floating rest-timer pill
  moves into the active set card: the card adopts a blue treatment
  (`box--accent` analogue), the set numbers grow, and a circular progress ring
  occupies the right side. Existing chime/haptic on zero (`feedback.ts`) stays.
- **P1.11 — One primary CTA: "Complete set".** Resolve the row-tap collision:
  tap on a set row = complete. Edit moves to long-press OR an explicit pencil
  icon. The current implementation conflates the two. Use a long-press hook or
  a small edit affordance, your call — wireframe shows separate `edit / +15s
  rest / skip rest` pills below the primary green button.
- **P0.3 — Subtitle promotion.** Per-exercise subtitle becomes the dominant
  line: `set 3 of 3 · last time: 3×8 @ 180 · try 185`. The "try 185" segment is
  green and computed from the auto-bump heuristic (see Exercise Detail P1.3).
- **P0.4 — "Auto-saved" in the in-session status strip.** Top-right of the
  session view; reuse the same `fj-save-dot` component.

### 3. Progress — `src/pages/Progress.tsx`

**Wireframe:** `#progress` (section 3, "SCREEN THREE / Progress — three rooms").

Retire the segmented control. Three rooms, three URLs, three identities.

- **P1.2 — Hero sentence on entry.** Replace the row of stat tiles with a
  single composed sentence: `"+12% tonnage this month."` plus a 1-line subtitle
  with the supporting numbers. Compose the sentence from `weeklyStats` /
  monthly tonnage. **If the math doesn't justify a sentence, don't show one** —
  fall through to a calm "Train once and a story starts" empty state.
- **P1.2 / P1.10 — Three rooms instead of three tabs.** The current Overview /
  Exercises / History segmented control becomes three full routes:
  - `#/progress/story`  (was Overview) — weekly recap, insights, body weight
  - `#/progress/records` (was Exercises, *renamed*) — PRs, goals, PR timeline
  - `#/progress/history` — past workouts + heatmap
  Extend `lib/router.ts` with a `ProgressSection` type mirroring how
  `SettingsSection` already works. Default `#/progress` redirects to
  `#/progress/story`. The store derives `viewingProgressSection` from the hash.
  The room-picker UI on entry is three `Card` rows with metaphor icons.
- **P2.4 — Sparkline tooltips + per-day breakdown.** `Sparkline.tsx` gains a
  `tooltip?: boolean` prop. On hover (desktop) or tap (mobile), surface the
  exact value for the focused datapoint. A textual readout below the chart
  (`Mon 0 · Tue 1 · Wed 0 …`) mirrors the visual for a11y.
- **P1.5 — Per-room empty states.** See system-wide §8.

### 4. Exercise Detail — `src/pages/ExerciseDetail.tsx`

**Wireframe:** `#exdetail` (section 4, "SCREEN FOUR / Exercise Detail").

- **P1.3 — "Next session — try 3×8 @ 190" recommendation.** A blue card below
  the goal row. Auto-bump from last session: +5 lb on top set if last week's
  reps were complete and within recovery range (use a 7-day session count
  heuristic). Pure function — add `recommendNextSession(history)` to
  `data/logic.ts` with a unit test.
- **P1.6 — Distance-to-goal as a trajectory.** Amber card: "**20 lb to go** ·
  ~6 weeks at current rate." Compute weeks-to-goal from the linear fit of the
  last 8 top-set values (or e1RM, whichever is closer to the goal); if the
  trend is flat/negative, hide the weeks half and keep the lb-to-go half.
- **P1.7 — PR / e1RM / Goal pills visually distinguished.** Three pills, all
  pill-shape, **different palette per category**: green = PR (past achievement),
  blue = e1RM (projection), amber = Goal (future commitment). Same vocabulary
  the Today P0.3 deltas use. Tokens: `--color-success`, `--color-accent`,
  `--color-warning`.
- **P1.5 — Per-exercise empty state:** "Log Bench three times — we'll start
  projecting." Differentiated from the generic "no data yet".

### 5. Plan — `src/pages/Plan.tsx`

**Wireframe:** `#plan` (section 5, "SCREEN FIVE / Plan").

- **P2.3 — "Next 7 days from today" rotation.** Schedule rotates so today is
  row 1, tomorrow row 2, … (same 7-day model, anchored on now). Each row keeps
  the existing `AssignDaySheet` open-on-tap behaviour. Use `lib/dates.ts` to
  compute the rolling 7.
- **P2.8 / P3.4 — Templates collapse to a strip.** Once `templates.length >= 1`,
  the template management section collapses to a header chip row — one
  `.fj-pill` per template, colour-swatched. Tap a chip = open template editor
  modal (`Card`-based, not the full screen). `+ new` chip at the end. An
  `edit` link reveals the full-screen template editor. New field on the
  `Template` type: `color: 'red' | 'blue' | 'green' | 'amber' | 'neutral'`,
  default `neutral`. Migration: assign cyclic defaults during a v2→v3 migration
  step in `storage.ts`.
- **P3.1 / P3.8 — Drag reorder ⋮⋮ + 150ms FLIP animation.** Today the
  `ReorderButtons` are ▲▼ chevrons; add a drag handle on Plan rows
  (`HTML5 DnD` is enough — no library needed). Apply a FLIP animation on the
  reorder commit: capture `getBoundingClientRect()` before/after, animate the
  delta with `transform` at 150ms `ease-out`. Extract this into
  `lib/flip.ts` so Today's lift rows + Plan rows share the implementation.
- **P1.5 — Empty state:** "You haven't planned a week yet. Want to start with
  Push/Pull/Legs?" The "Start with PPL" CTA invokes the existing PPL seeding
  used in `defaultData()` (extract that into a callable
  `seedPushPullLegs(state)` in `storage.ts`).

### 6. Recipes — `src/pages/Recipes.tsx`

**Wireframe:** `#recipes` (section 6, "SCREEN SIX / Recipes").

- **P2.9 — Seeded starter recipes on install.** Mirror the seeded
  Push/Pull/Legs templates: on `defaultData()` insert three starters — Salmon
  rice, Tuna pasta, Oats & whey. Mark with a `seed: true` flag on the `Recipe`
  type so the empty-state copy can read "We seeded 3 starters — add your own
  when ready." Removing a seed clears the flag from the dataset; it does not
  re-add itself.
- **P2.10 — "Protein today" bridge bar.** Top of Recipes, below the page
  header. Shows `Σ protein from recipes logged today / dailyProteinGoal g` with
  a 8px filled bar. New `Preferences.dailyProteinGoal: number` (default 140).
  "Log as eaten" affordance on recipe detail pushes a `LoggedMeal` (new type)
  into `AppData.loggedMeals[]` scoped by date. **Bridge, not a nutrition
  page** — resist scope creep.
- **P2.11 — Filter pill swallows the tag-chip row.** Once `recipes.length > 20`
  or the tag count exceeds 6, collapse the inline tag chips into a single
  `Filter ▾` dropdown using the existing `Select`. Below the threshold keep the
  inline chips.
- **P2.2 — "Today" badge on recipes referenced from Today's post-workout
  card.** Recipe cards show a blue `today` pill in the top-right when the user
  has a recipe linked to today's session (see Today §1). Bidirectional with the
  Today bridge.
- **P1.5 — Empty state:** uses the seed copy.

### 7. Settings — `src/pages/Settings.tsx`

**Wireframe:** `#settings` (section 7, "SCREEN SEVEN / Settings").

- **P2.5 / P3.5 — Nudges sub-section.** New card under Settings → Preferences:
  - `Streak-save reminder at <time>` — toggle + time picker. Uses the PWA
    Notification API when permission is granted; degrades to nothing
    otherwise. New `Preferences.streakNudge: { enabled: boolean; time: 'HH:mm' }`.
  - `Backup reminder every <N> wks` — select 1/2/3/4. Drives the existing
    `BackupReminder` threshold (currently hard-coded 3 weeks).
  Backup status surfaces on the "Your data" card itself as a `3 wks since
  backup` pill (use `lastBackupAt` + `relativeTime()` from P3.3).
- **P3.9 — Rotating microcopy.** A single line at the top of Settings rotating
  through trust signals: workout count · disk footprint · backup age. Compute
  disk footprint via `navigator.storage.estimate()`. Pick one of the three at
  random on each mount (seeded by date so it's stable for a day).

### 8. System-wide

**Wireframe:** `#system` (section 8, "System-wide").

- **P3.6 — Dark-theme softening.** In `styles/tokens.css`, replace pure
  `#000`-derived dark surfaces with `oklch(0.12 0.01 250)` — a hint of cool.
  Light theme `--color-surface-2` shifts ~4 LCH points warm. Audit every dark
  surface; nothing else should change.
- **P3.7 — Page-header rhythm.** See Today §1.
- **P0.4 — Save-state dot in every PageHeader.** See Today §1.
- **P3.8 — Reorder FLIP animation.** See Plan §5; share via `lib/flip.ts`.
- **P1.5 — Diverse empty states.** One per screen, each with its own metaphor.
  See the wireframe `#system` callout for copy:
  - Today: chalkboard pattern — "Today's a fresh page."
  - Progress/Story: "Train once and a story starts."
  - Records: single-rep dot — "Your first PR is one rep away."
  - History: heatmap of grey squares waiting to fill.
  - Plan: calendar with one circled day.
  - Recipes: 3 seeded starters with "We started you off."
- **P1.10 — A11y polish bundle.**
  - Tab strips (segmented controls) → `role="tablist"`, children
    `role="tab"`, arrow-key navigation, `aria-selected`.
  - Date label → `aria-haspopup="dialog"`.
  - Skip-link already in place — don't break it.

---

## Interactions & behaviour

- **Animations.** One blanket rule: **150ms `ease-out`** for reorder FLIP,
  set-row state changes, and toggle flips. Match the existing motion-token
  cadence in `tokens.css`. The CountUp on streak (P1.8) takes ~600ms with an
  ease-out curve; lift the easing from `CountUp.tsx`.
- **Haptics / chime.** Reuse `lib/feedback.ts`. `celebrate()` for PRs and
  weekly-goal completion. `tap()` for the streak ratchet, set completion, and
  Cook-mode wake-lock toggles. Never on routine taps.
- **Persistence.** All new preferences (`todayLayout`, `streakNudge`,
  `backupReminderWeeks`, `dailyProteinGoal`, `freshStartDismissedWeek`,
  `progressSection`) land on the existing `Preferences` type; bump
  `SCHEMA_VERSION` and write a v2→v3 migration in `storage.ts` that fills
  defaults. The migration must be additive-only — old saves keep working.
- **Routing.** `lib/router.ts` extends with `ProgressSection` (story / records /
  history) and rewrites bare `#/progress` to `#/progress/story`. Browser back
  button works across the rooms.

## State to add (new fields on existing types)

```ts
// data/types.ts — additive
interface Preferences {
  // …existing
  streakNudge?:           { enabled: boolean; time: `${number}:${number}` };
  backupReminderWeeks?:   1 | 2 | 3 | 4;          // default 3
  dailyProteinGoal?:      number;                 // grams; default 140
  freshStartDismissedWeek?: string;               // ISO week, e.g. "2026-W21"
  progressSection?:       'story' | 'records' | 'history';
}
interface Template {
  // …existing
  color?: 'red' | 'blue' | 'green' | 'amber' | 'neutral';
}
interface Recipe {
  // …existing
  seed?: boolean;
}
interface LoggedMeal {                // new
  id: string;
  recipeId: string;
  date: string;                       // YYYY-MM-DD
  servings: number;
}
interface AppData {
  // …existing
  loggedMeals?: LoggedMeal[];
}
```

## Design tokens

Do **not** lift the wireframe's paper aesthetic. Use existing
`src/styles/tokens.css`. Three category-colour assignments are new and need to
hold across screens:

| Category                    | Token used                | Used in              |
| --------------------------- | ------------------------- | -------------------- |
| Past achievement (PR, +lb)  | `--color-success`         | Today deltas, ExDetail PR pill |
| Projection (e1RM, "try X")  | `--color-accent`          | ExDetail e1RM pill, "try 185" subtitle |
| Future commitment (goal, fresh-start) | `--color-warning` | ExDetail goal pill, Monday strip, PR-shot flag |

The dark-theme softening (P3.6) is the only token-file diff: replace pure-black
surfaces with `oklch(0.12 0.01 250)`, light theme `--color-surface-2` warms ~4
LCH points.

## Files in this bundle

- `README.md` — this file.
- `wireframes/FitJournal v2 - Final.html` — annotated v2 wireframe (read this).
- `wireframes/UX Audit.html` — the original audit; context for "why".

## Recommended commit cadence

One commit per backlog ID. Prefix subjects with the ID:

```
P0.1 ambient header replaces Today hub card
P0.2 sticky Start-session FAB
P0.3 lift rows carry last-time deltas
P0.4 save-state dot in every PageHeader
...
```

Run `npm test && npm run typecheck && npm run lint` before each commit; the
existing test suite (67 tests as of 2026-05-24) must stay green.
