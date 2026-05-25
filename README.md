# FitJournal

A personal fitness journal — workouts, weight, and progress — that runs **fully
offline** and keeps all data **on your device**. Built as an installable PWA: a
real desktop app that needs no internet, and that can be added to an iPhone home
screen for free.

**Live:** https://nakultan.github.io/fitjournal/

## Status

**All five phases complete** — the app is fully responsive (a phone layout with
a bottom nav and bottom-sheet modals) and installable on an iPhone home screen,
on top of the full feature set and polish pass.

## What it does

- **Today** — a calm ambient header (date · streak · weekly-goal progress,
  with the day's plan as a heavier title) sits above the lift list itself; a
  one-tap **Calm / Classic** chip flips the layout density right from the
  header. Each lift row carries a delta pill ("+5 lb", "+2 reps", "same as
  last", or "PR shot ★") sourced from the last time you logged that exercise.
  Log body weight, cardio, and exercises set by set (tap any entry to edit it,
  or reorder with the ▲/▼ chevrons); jot a short *day note* — energy, sleep,
  soreness — that follows the workout into History and the summary. A sticky
  green **Start session** FAB in the thumb zone (sub-label: lift count + the
  heaviest top-set you're aiming for) drops you into the in-workout view: each
  set row is tap-to-complete, the per-exercise subtitle reads `N sets planned
  · last time · try X` with the auto-bump suggestion in green, and a rest
  timer chimes at zero. Finish with a session recap, and a celebration when
  you set a record
- **Progress** — three rooms behind their own URLs, with a metaphor-icon
  picker at the top: **Story** opens with a one-line hero summary ("+12%
  tonnage this month" / "12-day streak in motion" / a weekly count, depending
  on what's loudest) above the weekly recap, body-weight trend, 30-day stats
  and the collapse-by-default charts / insights / muscle balance; **Records**
  is your strength + cardio PRs, per-exercise goals and the PR timeline (tap
  any strength row to open its progression view with top-set and
  estimated-1RM trends, a next-session "try N×R @ W" recommendation, and an
  amber distance-to-goal trajectory); **History** is the past-workouts list
  and the activity heatmap
- **Plan** — build workout templates and assign them to a weekly schedule
- **Recipes** — a searchable, taggable recipe keeper with a photo per recipe
  (downscaled), optional per-serving macros, a serving scaler, checkable
  ingredients and a focused cook mode that keeps the screen awake
- **Settings** — preferences (units, goals, a light/dark theme), backup export
  (JSON or CSV) & restore, and Apple Health sync via a Shortcut (with a JSON
  file as a fallback)

## Running it

Node.js is required — only to *build* the app; the finished build is plain
static files that need nothing to run.

```bash
npm install      # one time
npm run dev      # dev server with hot reload
npm run build    # offline-ready production build in dist/
npm run preview  # serve the built app locally
npm test         # run the unit tests (data & logic layer)
npm run lint     # check code quality
npm run format   # auto-format the code
npm run typecheck
```

## How it works

- **React 19 + TypeScript**, bundled by **Vite**; `vite-plugin-pwa` for offline
  support and installability; **Lucide** icons.
- **All data lives on your device** in the browser's IndexedDB storage — no
  server, no account, no cloud. The app asks the browser to keep that storage
  durable. Personal records, streaks and stats are *calculated* from your
  logged workouts, never stored separately.
- **Back up regularly:** Settings → Export downloads a JSON copy of everything,
  and Settings → Import restores one — after first downloading a snapshot of
  your current data, so a restore can be undone. The app nudges you to export
  when it has been a while, and warns you if a save to the device fails. There
  is still no cloud safety net, so keeping a recent export is wise.
- **Apple Health sync:** the app is a pure PWA, so it can't read HealthKit
  directly. A companion Apple Shortcut reads your Health data and hands it to
  FitJournal via a `?health=` URL parameter — one tap, or a daily automation.
  Settings → *Sync with Apple Health* has the setup steps; the synced metrics
  show up on the Progress Overview. A synced body weight can be one-tap-applied
  to the Today weight banner, and a second optional Shortcut can write a
  finished workout back to Apple Health from the summary screen.

## Project structure

```
src/
  components/   AppShell + design-system components (Button, Card, Modal, ...)
  pages/        the five screens
  data/         types, constants, storage, derived logic, the store
  lib/          small helpers (dates, ids, routing, class names, backup)
  styles/       design tokens + global + component + app styles
public/         app icons
```

See [`CLAUDE.md`](CLAUDE.md) for a developer's guide to the codebase.

## Offline & installing

Once loaded, the app caches itself and works with no internet.

- **Desktop (Chrome/Edge):** an **Install** option appears in the address bar —
  the app gets its own window and icon.
- **iPhone:** open the site in Safari → **Share → Add to Home Screen**. It
  installs with its own icon, runs full-screen, and works offline. No App
  Store, no Apple fee.

**Each install keeps its own data today.** Storage is per-device, so your
iPhone and your desktop currently hold separate journals. To move data between
them, use Settings → Export on one device and Settings → Import on the other.
A real multi-device profile (sign in once, your data follows) is being scoped
as the next major direction; until it ships, the export/import workflow is the
bridge.

## Deployment

Every push to `main` triggers a GitHub Actions workflow
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) that builds the
app and publishes it to GitHub Pages.
