# Pre-update checklist

A quick pass to run before deploying a meaningful change. Most of it is
automated; the manual smoke test is the part that catches what unit tests
can't.

## Automated — run these

- [ ] `npm run lint` — code style and common mistakes
- [ ] `npm run typecheck` — the types are sound
- [ ] `npm test` — the data & logic layer still behaves
- [ ] `npm run build` — a clean production build

## Manual smoke test

Run `npm run preview`, open the app, and click through:

- [ ] **Today** — log a body weight, a cardio entry and an exercise; a PR badge
      and toast appear when a record is beaten
- [ ] **Undo** — delete an exercise, click *Undo* in the toast; it returns
- [ ] **Edit** — tap a logged exercise or cardio row; the modal opens pre-filled,
      and saving updates the entry
- [ ] **Finish workout** — the summary modal opens with the right numbers
- [ ] **Progress** — the Overview, Exercises and History tabs show the streak,
      stats, body-weight trend, PRs and heatmap reflecting what was just logged
- [ ] **Plan** — create a template and assign it to a weekday; deleting a
      template asks for confirmation
- [ ] **Recipes** — add a recipe with a photo (it downscales) and optional
      macros; the card shows the photo and macros; sort by name / favorites /
      quickest re-orders the grid; deleting one asks for confirmation
- [ ] **Recipe detail** — the scaler scales servings and ingredient quantities
      (lines with a leading number); ingredient rows check off with strike-
      through; Cook mode opens full-screen, arrow keys step, Escape exits
- [ ] **Apple Health sync** — open the app with `?health={"steps":8000}` in
      the URL; the parameter strips away and the Progress Overview shows an
      Apple Health card with the metric
- [ ] **In-workout session** — tap *Start* on Today (or the *Session* chip in
      Weight Lifting) → the live session opens; editing weight/reps writes
      through to the log; tapping the check button starts the rest-timer pill;
      *+15s* extends it, the chime fires at zero, and *Finish workout* opens
      the summary then returns to Today
- [ ] **Exercise detail** — Progress → Exercises → tap a strength row → the
      detail screen shows top-set & estimated-1RM trend lines and a session
      history; tapping a history row jumps to that day in Today
- [ ] **Settings → Export** — downloads a backup file
- [ ] **Settings → Import** — restoring shows the confirmation dialog and first
      downloads a snapshot of the current data
- [ ] **Settings → Theme** — Light and Dark restyle the app immediately; System
      follows the device, and the choice survives a reload with no flash
- [ ] **Offline** — reload with the network off; the app still works
- [ ] **Narrow window** — shrink the window; the bottom nav and reflow kick in
- [ ] **Navigation** — switch screens, then press the browser back button; it
      steps back through them, and a reload stays on the current screen

## After deploy

- [ ] The live URL loads and shows the change
