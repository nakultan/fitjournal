# FitJournal

A personal fitness journal — workouts, weight, and progress — that runs **fully
offline** and keeps all data **on your device**. Built as an installable PWA: a
real desktop app that needs no internet, and that can be added to an iPhone home
screen for free.

**Live:** https://nakultan.github.io/fitjournal/

## Status

**All five phases complete** — the app is fully responsive (a phone layout with
a bottom nav and bottom-sheet modals) and installable on an iPhone home screen,
on top of the full feature set and polish pass. See [`AUDIT.md`](AUDIT.md) for
a full product audit and the ranked backlog.

## What it does

- **Today** — a hub showing your streak, weekly-goal progress and today's planned
  workout; log body weight, cardio, and exercises; finish with a celebration
- **Progress** — a weekly recap, streak, 30-day stats, an 8-week chart, automatic
  insights, muscle balance
- **Records** — strength & cardio personal records, per-exercise goals, a PR timeline
- **History** — a 13-week activity heatmap and a list of past workouts
- **Plan** — build workout templates and assign them to a weekly schedule
- **Recipes** — a searchable, taggable recipe collection
- **Settings** — preferences, backup export & restore, and health-data (JSON) import

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
- **All data lives on your device** in the browser's localStorage — no server,
  no account, no cloud. Personal records, streaks and stats are *calculated*
  from your logged workouts, never stored separately.
- **Back up regularly:** Settings → Export downloads a JSON copy of everything,
  and Settings → Import restores one — after first downloading a snapshot of
  your current data, so a restore can be undone. The app nudges you to export
  when it has been a while, and warns you if a save to the device fails. There
  is still no cloud safety net, so keeping a recent export is wise.

## Project structure

```
src/
  components/   AppShell + design-system components (Button, Card, Modal, ...)
  pages/        the seven screens
  data/         types, constants, storage, derived logic, the store
  lib/          small helpers (dates, ids, class names, backup)
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

**Each install keeps its own data.** Storage is per-device, so your iPhone and
your desktop hold separate journals — there is no cloud sync. To move data
between them, use Settings → Export on one device and Settings → Import on the
other.

## Deployment

Every push to `main` triggers a GitHub Actions workflow
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) that builds the
app and publishes it to GitHub Pages.
