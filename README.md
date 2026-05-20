# FitJournal

Your personal fitness journal — workouts, weight, and progress — that runs
**fully offline** and keeps all data **on your device**.

This is the React rebuild of FitJournal, delivered as an installable **PWA**
(Progressive Web App): a real desktop app that works with no internet, and that
can later be added to an iPhone home screen for free.

## Status

**Phase 1 — project foundations.** The app currently shows a design-system
showcase. Real screens are rebuilt in Phase 2. See [`../ROADMAP.md`](../ROADMAP.md).

## Running it

Node.js is required (already installed on this machine).

```bash
npm install      # one time, after cloning
npm run dev      # start the dev server, then open the printed URL
npm run build    # produce the offline-ready app in dist/
npm run preview  # serve the built app locally to test it
```

Other scripts:

```bash
npm run lint       # check code quality
npm run format     # auto-format the code
npm run typecheck  # check TypeScript types
```

## How it's built

- **React 19 + TypeScript**, bundled by **Vite**.
- **vite-plugin-pwa** makes it installable and offline-capable.
- Data lives in the browser **on your device** — no server, no accounts, no cloud.

## Project structure

```
src/
  components/   reusable UI building blocks (Button, Card, Modal, ...)
  pages/        full screens (built out in Phase 2)
  data/         on-device storage + data types (Phase 2)
  lib/          small helpers
  styles/       design tokens + global + component styles
public/         app icons and static files
```

## Offline & installing

Once built and loaded, the app caches itself and works with no internet.
On desktop Chrome/Edge an **Install** option appears in the address bar — that
gives it its own window and icon. On iPhone (later), open it in Safari and use
**Share → Add to Home Screen**. No App Store, no fees.
