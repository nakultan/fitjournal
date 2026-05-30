# FitJournal

A personal fitness journal — workouts, weight, and progress — that runs **fully
offline** and keeps all data **on your device**. Built as an installable PWA: a
real desktop app that needs no internet, and that can be added to an iPhone home
screen for free. Optionally, **sign in to sync** your journal across your phone
and laptop — still offline-first, with the device as the source of truth.

**Live:** https://nakultan.github.io/fitjournal/

## Status

**All five phases complete** — the app is fully responsive (a phone layout with
a bottom nav and bottom-sheet modals) and installable on an iPhone home screen,
on top of the full feature set and polish pass.

## What it does

- **Today** — a calm ambient header (date · streak · weekly-goal progress,
  with the day's plan as a heavier title) sits above the lift list itself; a
  one-tap monospace **🌙 Calm** chip flips the layout density right from the
  header. On Monday mornings, a dismissible *fresh-start* strip echoes last
  week's workout count ("Last week you trained 3×. Match it?") — gentle
  reinforcement at the start of the loop, not the end. The lift list sits
  under a small `Today's Lifts · N ex` strip; each row carries a green
  delta pill (`+5 lb`, `+2.5 lb`, `+2 reps`, `same as last` — accurate to
  the plate) and, when the planned top would beat the standing record, an
  amber `PR shot ★` pill alongside it. Log body weight, cardio, and
  exercises set by set (tap any entry to edit it, or reorder with the ▲/▼
  chevrons); jot a short *day note* — energy, sleep, soreness — that
  follows the workout into History and the summary. Once today has any
  lifts, a calm *post-workout meal* card appears below the list (pulled
  from your favourites or any recipe tagged `post-workout`) — one tap
  deep-links to the recipe with calories + protein already on screen. A
  sticky green **Start session** FAB in the thumb zone (sub-label: lift
  count + the heaviest top-set you're aiming for) drops you into the
  in-workout **Train Mode** view: the standard 5-tab nav steps aside, the
  resting set adopts a blue treatment with a circular countdown ring and
  inline `+15s` / `skip rest` pills (no floating timer to chase), each set
  is read-only `weight × reps` by default with a pencil button to edit,
  the row itself is the "Complete set" target, the per-exercise subtitle
  tracks `set X of N · last time · try X` (the green "try X" is the
  auto-bump suggestion), and a sticky 2-action bar (`⏸ Pause` /
  `✓ Finish workout`) lives at the bottom. Finish with a session recap,
  and a celebration when you set a record
- **Progress** — three rooms behind their own URLs, picked from a vertical
  **CHANGE ROOM** stack of Card rows (icon + title + metaphor sub; the
  active room shows a `here` pill, the others a chevron): **Story** opens
  with a one-line hero summary ("+12% tonnage this month" / "12-day streak
  in motion" / a weekly count, depending on what's loudest) above the
  weekly recap, body-weight trend (hover/tap any sparkline point to read
  the exact value, with a six-reading textual readout below for screen
  readers), 30-day stats and the collapse-by-default charts / insights /
  muscle balance; **Records** is your strength + cardio PRs, per-exercise
  goals and the PR timeline (tap any strength row to open its progression
  view with three category-coloured pills — green PR, blue e1RM, amber
  Goal — a next-session "try N×R @ W" recommendation, an amber distance-
  to-goal trajectory, and both sparklines now carry value-on-hover
  tooltips); **History** is the past-workouts list and the activity heatmap
- **Plan** — templates collapse to a colour-swatched chip strip (red /
  blue / green / amber per template); tap a chip to edit, or the *edit*
  link to open a manager that drag- or arrow-reorders the whole set. Each
  template editor carries a colour picker and drag-reorderable exercise
  rows (with a 150 ms slide animation). The weekly schedule rotates "next
  7 days from today" so today is row 1 with a quick Start affordance; tap
  any day to reassign it via a bottom-sheet picker
- **Recipes** — a searchable, taggable recipe keeper with a photo per
  recipe (downscaled), optional per-serving macros, a serving scaler,
  checkable ingredients and a focused cook mode that keeps the screen
  awake. A *Protein today* bar at the top sums servings × per-recipe
  protein against your daily goal; *Log as eaten* on any recipe pushes a
  serving into the day's total. Recipes the Today card is currently
  surfacing carry a blue `today` pill. Past 20 recipes the inline tag
  chips collapse behind a `Filter ▾` dropdown; new installs are seeded
  with three starter recipes (Salmon rice, Tuna pasta, Oats & whey),
  each marked `seed` so you can clearly see which are yours
- **Settings** — preferences (units, goals, a light/dark theme), opt-in
  nudges (a daily streak-save reminder that fires at your chosen time
  while the app is open — a server-less web app can't notify you while
  fully closed — and a backup-reminder cadence of 1–4 weeks), backup export (JSON or
  CSV) & restore, optional **multi-device sync** (sign in with a magic
  link to sync across devices — see below), and Apple Health sync via a
  Shortcut (with a JSON file as a fallback). An overdue-backup pill on the
  Your data card surfaces the cadence at a glance

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
  support and installability; **Lucide** icons. The dark theme is a softened
  cool near-black (a hint of blue, not a developer-terminal pure black), and
  reorder animations honour your reduced-motion setting.
- **All data lives on your device** in the browser's IndexedDB storage — no
  server or account required to use it. The app asks the browser to keep that
  storage durable. Personal records, streaks and stats are *calculated* from
  your logged workouts, never stored separately.
- **Optional multi-device sync** (see below): sign in and your journal
  reconciles across every device you use, while IndexedDB stays the source of
  truth — so the app keeps working with no connection and syncs when you're
  back online. Signed out, FitJournal behaves exactly as the local-only app.
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
  data/         types, constants, storage, derived logic, the store, the sync engine
  lib/          small helpers (dates, ids, routing, class names, backup, supabase client)
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

**Without signing in, each install keeps its own data.** Storage is per-device,
so an iPhone and a desktop hold separate journals. You can move data between
them with Settings → Export / Import — or turn on sync (below) and skip the
shuffling entirely.

## Multi-device sync (optional)

Sign in and your journal reconciles across every device you use. It stays
**offline-first** — IndexedDB remains the source of truth, and sync is layered
on top, so you can log at the gym with no signal and it pushes up when you
reconnect.

- **How to use it:** Settings → *Your data*. Create an account with an email
  and password once, then sign in with that same login on any device — your
  journal syncs automatically. The card then shows who's syncing and the
  last-synced time, with a manual **Sync now** button. Forgot your password?
  Use the **Forgot password?** link — you'll get an email link that returns you
  to the app to set a new one.
- **How it merges:** each record (a workout day, a recipe, a template set, …)
  carries a last-modified timestamp; on sync the newer version wins, and
  deletes propagate as tombstones. This is *per-record* — logging a workout on
  your phone never clobbers a recipe you edited on your laptop.
- **Privacy:** your rows are private to your account, enforced server-side by
  Postgres row-level security. Sync runs on [Supabase](https://supabase.com)
  (managed Postgres + auth). Signing out stops syncing and leaves the local
  journal untouched.

Sync is **off unless the build is configured** with Supabase credentials
(`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`). A build without them — or a
fork — runs as the original local-only app, no sync card shown.

### Setting up your own sync backend

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, create the records table + row-level security:
   ```sql
   create table public.records (
     user_id    uuid        not null references auth.users (id) on delete cascade,
     kind       text        not null,
     id         text        not null,
     data       jsonb       not null,
     updated_at timestamptz not null default now(),
     deleted    boolean     not null default false,
     primary key (user_id, kind, id)
   );
   create index records_user_updated_idx on public.records (user_id, updated_at);
   alter table public.records enable row level security;
   create policy "own rows" on public.records
     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
   ```
3. Enable the **Email** auth provider under Authentication → Providers. The app
   uses email + password sign-in. For instant account creation with no email
   step, turn **off** "Confirm email" in the email provider settings; leave it
   on if you'd rather verify each new account once via a confirmation link.
4. Copy your **Project URL** and **anon/public** key (Project Settings → Data
   API). The anon key is safe to expose in a browser build — row-level security
   is what protects the data. Never use the `service_role` key in the frontend.
5. **Local dev:** copy `.env.example` to `.env.local` and fill both values.
6. **Deployment:** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as
   GitHub repository secrets (Settings → Secrets and variables → Actions); the
   deploy workflow passes them into the build.

> Because the app talks to Supabase through the standard SDK, moving to a
> self-hosted Supabase later (e.g. on your own server) is just changing those
> two environment variables.

## Deployment

Every push to `main` triggers a GitHub Actions workflow
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) that builds the
app and publishes it to GitHub Pages.
