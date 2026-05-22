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
- [ ] **Progress / Records / History** — streak, stats, PRs and the heatmap
      reflect what was just logged (today's square shows on the heatmap)
- [ ] **Plan** — create a template and assign it to a weekday; deleting a
      template asks for confirmation
- [ ] **Recipes** — add a recipe; deleting one asks for confirmation
- [ ] **Settings → Export** — downloads a backup file
- [ ] **Settings → Import** — restoring shows the confirmation dialog and first
      downloads a snapshot of the current data
- [ ] **Settings → Theme** — Light and Dark restyle the app immediately; System
      follows the device, and the choice survives a reload with no flash
- [ ] **Offline** — reload with the network off; the app still works
- [ ] **Narrow window** — shrink the window; the bottom nav and reflow kick in

## After deploy

- [ ] The live URL loads and shows the change
