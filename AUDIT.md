# FitJournal — Full Product Audit

_Audit date: 2026-05-21_

## Context

FitJournal is a privacy-first, offline-first personal fitness journal (React 19 + TypeScript +
Vite, shipped as an installable PWA). All data lives on-device in `localStorage`; there is no
account, no server, no telemetry.

This document is a full product audit — not a redesign — surfacing UX liabilities, trust issues,
friction, amateur-feeling behaviors, missing premium behaviors, weak flows, abandonment risks,
design inconsistencies, and performance risks, each ranked by **severity**, **user impact**, and
**implementation difficulty**. No application code is changed by this audit; fixing any
individual finding is a separate, explicitly-scoped follow-up.

The audit was produced by reading the data layer (`storage.ts`, `store.tsx`, `logic.ts`,
`types.ts`), the core screen (`Today.tsx`), `Settings.tsx`, `Progress.tsx`, the design tokens,
and the project docs (`README.md`, `CLAUDE.md`).

---

## What is genuinely strong (audit baseline)

A premium product is built by protecting strengths, not just fixing faults. FitJournal already
does several things right, and the recommendations below are written to preserve them:

- **The privacy promise is real and kept.** No network calls, no analytics, no third-party
  SDKs, no account. The product's claim ("runs entirely on this device") is true.
- **Clean layered architecture** (`pages → components → store → logic/storage`), pure derived
  logic, and a real unit-test suite over `logic.ts` / `storage.ts`.
- **Humane streak design.** `computeStreak` ([src/data/logic.ts:165](src/data/logic.ts#L165))
  bridges *planned* rest days and gives "today" a grace period — resting on schedule never
  costs a streak. This is thoughtful and rare.
- **Forgiving deletes.** Exercise/cardio rows delete via an *undo* toast rather than a
  confirmation wall ([src/pages/Today.tsx:563](src/pages/Today.tsx#L563)) — calm and reversible.
- **Restore is gated.** Importing a backup shows a confirm modal with item counts before
  overwriting ([src/pages/Settings.tsx:283](src/pages/Settings.tsx#L283)).
- **Incremental persistence.** Every add/edit is saved immediately, so a backgrounded or killed
  app loses no *logged* data.
- **A real design system.** Tokens for color/spacing/type/radius/motion; `prefers-reduced-motion`
  is respected; warm, mostly-consistent microcopy; good empty states everywhere.

These are the foundations. The findings below are about making the product *trustworthy and
premium at the edges* — which is exactly where it currently leaks.

---

## How findings are ranked

Each finding carries three independent ratings:

- **Severity** — how badly it violates the product's core promises (privacy, offline integrity,
  simplicity, speed, calm). `Critical` › `High` › `Medium` › `Low`.
- **User impact** — how many users feel it and how often. `High` (most users, routinely) ›
  `Medium` › `Low`.
- **Effort** — implementation difficulty. `Trivial` (minutes) › `Low` › `Medium` › `High`.

The master table is ordered by overall priority (severity weighted by impact). The "Suggested
sequencing" section at the end re-sorts the same findings by *value-per-effort* so the team can
pick a starting point.

---

## Implementation status

**Phases 1 and 2 were implemented and shipped on 2026-05-21.** Resolved findings — **C1, H1,
H4, L2, L5** (Phase 1) and **C3, H2, H3, M3, M4, M5** (Phase 2) — are marked ✅ in the table
and detail sections below. All other findings remain open.

---

## Master ranked table

| ID | Finding | Categories | Severity | Impact | Effort |
|----|---------|-----------|----------|--------|--------|
| C1 ✅ | Silent save failure — `saveData` swallows storage errors; data looks saved but is lost on reload | Trust, Performance, Abandonment | **Critical** | High | Low |
| C2 | `localStorage` is the entire database — volatile; Safari/iOS can evict it silently | Trust, Performance, Abandonment | **Critical** | High | Med–High |
| C3 ✅ | No way to edit a logged entry — breaks the template/plan → log flow | Weak flow, Friction, Missing premium, Abandonment | **Critical** | High | Medium |
| H1 ✅ | No backup prompts or first-run backup education despite "export is your only way back" | Trust, Missing premium, Abandonment | **High** | High | Low |
| H2 ✅ | Unit preference does nothing — `lbs`/`mi` are hardcoded everywhere | Amateur-feeling, Trust, Inconsistency | **High** | High | Low–Med |
| H3 ✅ | History truncates at 60 workouts — older journal is unreachable in-app | UX liability, Weak flow, Abandonment | **High** | Med–High | Low–Med |
| H4 ✅ | Restore overwrites everything with no rollback / pre-restore snapshot | Trust, Weak flow | **High** | Medium | Low |
| M1 | Streak is loss-framed and visually dominant — risks the "broke it, quit" spiral | Behavioral, Abandonment, Calm UX | Medium | Med–High | Low–Med |
| M2 | Full celebration (confetti + chime + haptic) on *every* finished workout — reward inflation | Behavioral, Calm UX | Medium | Medium | Low |
| M3 ✅ | Add-Exercise modal loses all input on dismiss, with no "discard?" guard | Friction, Data loss | Medium | Medium | Low |
| M4 ✅ | No "last time" performance shown when logging an exercise (only last note) | Missing premium, Friction | Medium | Med–High | Low |
| M5 ✅ | Date navigation is ±1-day buttons only — no calendar jump | Friction, Weak flow, Mobile ergonomics | Medium | Medium | Medium |
| M6 | `saveData` fires on every keystroke — full DB re-serialized each time | Performance | Medium | Low–Med | Low |
| M7 | Naive PR model — strength PR = max weight only; cardio PR = most calories | Amateur-feeling, Trust | Medium | Medium | Medium |
| M8 | Touch targets below 44px (date-nav ~34px, icon buttons ~32px, `sm` buttons) | Accessibility, Mobile ergonomics | Medium | Medium | Low |
| M9 | Missing ARIA labels on tappable rows; decorative icons not hidden; weak focus rings | Accessibility | Medium | Medium | Low–Med |
| M10 | No schema migration path — `normalize` just stamps the current version | Trust, Performance | Medium | Low now / High later | Medium |
| M11 | Dark-only theme — no choice for bright-gym or light-preference users | Missing premium, Accessibility | Medium | Medium | Medium |
| M12 | No dynamic-type support — fixed `px` type scale breaks with OS font scaling | Accessibility, Mobile ergonomics | Medium | Medium | Medium |
| L1 | Numeric inputs accept negatives, no `min`, silent coercion, no validation feedback | Amateur-feeling, Friction | Low | Low–Med | Low |
| L2 ✅ | Cardio "Add" with empty fields silently no-ops — no feedback | Friction, Amateur-feeling | Low | Low | Trivial |
| L3 | Capitalization/label inconsistency ("Add exercise" vs "Add Exercise", etc.) | Design inconsistency | Low | Low | Trivial |
| L4 | Insights can stack into a wall of orange warnings on Progress — not calm | Calm UX | Low–Med | Low–Med | Low |
| L5 ✅ | "Apple Health" section is really a manual JSON import — overpromises integration | Trust, Microcopy | Low | Low | Trivial |
| L6 | Recipes filter is not memoized — minor jank at scale | Performance | Low | Low | Trivial |

---

## Critical findings

### C1 — Silent save failure: the app can lose data without telling anyone
**Severity: Critical · Impact: High · Effort: Low**

> ✅ **Resolved** — shipped 2026-05-21 (Phase 1).

`saveData` catches every write error and only `console.warn`s it
([src/data/storage.ts:124](src/data/storage.ts#L124)):

```ts
export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('[fitjournal] could not save data', e)
  }
}
```

If `localStorage` is full (`QuotaExceededError`), disabled, or blocked (Safari private mode,
strict privacy settings), the write fails *silently*. The React in-memory state still updates,
so the UI shows the workout as logged — the streak ticks, the summary celebrates — but nothing
reached disk. On the next reload, every change since the failure is gone. For an app whose
entire value proposition is "your journal is safe on this device," a silent data-loss path is
the single most serious trust violation in the product.

**Direction:** surface the failure. On a failed write, show a persistent (non-auto-dismiss)
warning and prompt an immediate export ("Couldn't save — download a backup now"). Block the
celebratory UI from implying success when the write failed. This is low effort and the highest-
value fix in the audit.

### C2 — `localStorage` is the entire database, and it is volatile
**Severity: Critical · Impact: High · Effort: Medium–High**

The localStorage key `fitjournal` *is* the database (`CLAUDE.md` says so explicitly). But
`localStorage` is the most fragile storage tier in a browser:

- **iOS/Safari evicts script-writable storage** after ~7 days of no interaction (ITP). A user
  who adds FitJournal to their iPhone home screen — the install path the README markets most —
  and doesn't open it for a week can find the entire journal wiped, silently.
- "Clear site data," browser storage pressure, and OS cleanups can all erase it.
- No `navigator.storage.persist()` request is made, so the data is never marked durable.

Combined with C1 (no save-failure surfacing) and H1 (no backup nudges), this is the product's
top abandonment risk: total, silent loss with no recovery path.

**Direction:** migrate the database from `localStorage` to **IndexedDB** (not subject to the
7-day cap and far higher quota), and request **persistent storage** via
`navigator.storage.persist()`. The `storage.ts` interface (`loadData`/`saveData`) is already a
clean seam — the swap is contained to that file plus making the load path async. Probability of
loss varies by user, but the consequence is catastrophic and irreversible, so it is rated
Critical.

### C3 — You cannot edit a logged entry — and that breaks the core template flow
**Severity: Critical · Impact: High · Effort: Medium**

> ✅ **Resolved** — shipped 2026-05-21 (Phase 2).

A logged exercise row renders the values plus a delete button only — there is no edit affordance
([src/pages/Today.tsx:135-157](src/pages/Today.tsx#L135)). The consequence becomes severe when
combined with templates: `loadTemplateIntoDay` and `loadPlanIntoDay` append exercises with
`weight: 0` ([src/data/store.tsx:86-121](src/data/store.tsx#L86)):

```ts
...template.exercises.map((te) => ({ id: uid(), name: te.name, muscle: te.muscle,
  sets: te.sets, reps: te.reps, weight: 0 }))
```

So when a user loads "Push Day," they get five exercises pinned at **0 lbs** and **no way to
record what they actually lifted** — short of deleting each row and re-entering it through the
Add-Exercise modal. The Plan/Template feature (a headline feature, pre-seeded on first run) and
the logging feature do not connect. A typo anywhere else (135 instead of 185) has the same
remedy: delete the row, re-type everything. This is a broken core loop, not a polish item.

**Direction:** make logged rows tap-to-edit (inline or a small edit modal reusing the
Add-Exercise form). This single change fixes the template flow, removes the most painful
friction in daily use, and is a baseline premium expectation for any logger.

---

## High findings

### H1 — The app never asks the user to back up, though backup is their only safety net
**Severity: High · Impact: High · Effort: Low**

> ✅ **Resolved** — shipped 2026-05-21 (Phase 1).

The README states plainly: *"There is no cloud safety net, so a recent export is your only way
back."* Yet the app never proactively prompts an export — backup lives only on the Settings
screen, which a habitual user may never open. `CLAUDE.md` even lists "occasional backup
reminders" as a known open item. A user who logs faithfully for months and never visits
Settings has **zero backups** when their device is lost, reset, or storage is cleared (see C2).

**Direction:** an occasional, calm, dismissible nudge — e.g. "It's been 3 weeks since your last
backup" — and a one-line note at first run explaining the on-device model. Keep it gentle (this
is a calm product); even a once-a-month prompt closes most of the exposure.

### H2 — The unit preference is dead: `lbs` and `mi` are hardcoded everywhere
**Severity: High · Impact: High · Effort: Low–Medium**

> ✅ **Resolved** — shipped 2026-05-21 (Phase 2). Implemented as label substitution
> (the displayed unit follows the preference); stored numbers are not converted, since
> existing data carries no unit metadata.

Settings offers `weightUnit` (lbs/kg) and `distanceUnit` (miles/km)
([src/pages/Settings.tsx:97-121](src/pages/Settings.tsx#L97)) — but the preference is never
read by the rest of the app. Body weight is labeled `lbs`
([src/pages/Today.tsx:439](src/pages/Today.tsx#L439)), the exercise table hardcodes
`<small>lbs</small>` ([src/pages/Today.tsx:151](src/pages/Today.tsx#L151)), the modal label is
"Weight (lbs)" ([src/pages/Today.tsx:739](src/pages/Today.tsx#L739)), PR toasts say "lbs",
every insight string in `logic.ts` says "lbs", and Progress shows distance in "mi". A user in
the metric world sets "kg," sees the setting stick, and then every number in the product still
says "lbs." A setting that visibly does nothing is a hallmark amateur signal and quietly
corrodes trust in *every* other setting.

**Direction:** thread the unit through display (label substitution at minimum; value conversion
ideally). If full conversion is deferred, the honest interim is to remove the control until it
works — a missing feature is better than a broken one.

### H3 — History is truncated at 60 workouts; the older journal is unreachable
**Severity: High · Impact: Medium–High · Effort: Low–Medium**

> ✅ **Resolved** — shipped 2026-05-21 (Phase 2). Replaced the 60-row cap with
> "Show more" pagination (30 at a time).

The History list renders only the most recent 60 logged days (`.slice(0, 60)`). The 13-week
heatmap covers a quarter; beyond that, older workouts still exist in storage but cannot be
viewed *anywhere in the app* — only by reading the exported JSON. A product called a "journal"
that becomes unable to show you last spring's training, after roughly two months of consistent
use, contradicts its own purpose and removes a key reason a long-term user stays.

**Direction:** paginate or "load more" instead of hard-capping; group by month for scannability.
The data is already there — this is purely a presentation cap.

### H4 — Restore overwrites everything with no rollback
**Severity: High · Impact: Medium · Effort: Low**

> ✅ **Resolved** — shipped 2026-05-21 (Phase 1).

`confirmImport` calls `restoreData`, which replaces the entire `AppData`
([src/pages/Settings.tsx:49-54](src/pages/Settings.tsx#L49)). The confirm modal is good — it
shows counts and warns the data "can't be recovered" — but a single mistaken import (e.g.
opening an old backup just to "check something") permanently destroys current data with no undo.

**Direction:** before applying a restore, auto-export the *current* state to a file (or keep a
one-slot in-storage snapshot) so a wrong restore is reversible. Low effort, removes the last
unguarded data-loss path.

---

## Medium findings

### M1 — The streak is loss-framed and visually dominant
**Severity: Medium · Impact: Medium–High · Effort: Low–Medium**

The streak is the largest element on the Today hub — a big flame and a big number
([src/pages/Today.tsx:222-233](src/pages/Today.tsx#L222)). Streaks are intrinsically
loss-framed: their emotional weight comes from the threat of losing them. The rest-day bridging
is a genuinely thoughtful mitigation, but an *honest* miss (illness, travel, a hard week) still
drops the count to 0. For a product that explicitly chooses **sustainability over addiction**,
a prominent zero-able counter is the mechanic most likely to trigger the "I broke it, why
bother" abandonment spiral.

**Direction:** keep the streak but de-emphasize loss. Always show "best" alongside "current" so
a reset still leaves something standing; consider framing around total consistency (workouts
this month/year) and/or a single forgiveness day. This aligns the headline metric with the
product philosophy.

### M2 — Every finished workout triggers the full celebration
**Severity: Medium · Impact: Medium · Effort: Low**

`WorkoutSummaryModal` fires `celebrate()` (chime + haptic) on mount and always renders confetti
([src/pages/Today.tsx:330-336](src/pages/Today.tsx#L330)) — every single workout, PR or not. A
reward that fires unconditionally stops being a reward; daily confetti habituates and cheapens
the genuine milestone moments. Calm, premium products tier their feedback.

**Direction:** make the everyday "finish" quietly satisfying (a clean summary, a soft check),
and reserve confetti + chime for real PRs and milestones — the data to distinguish them
(`hasPR`, `milestone`) is already computed right there.

### M3 — The Add-Exercise modal silently discards in-progress input
**Severity: Medium · Impact: Medium · Effort: Low**

> ✅ **Resolved** — shipped 2026-05-21 (Phase 2).

The modal holds name/sets/reps/weight/notes in local `useState`
([src/pages/Today.tsx:610-758](src/pages/Today.tsx#L610)). Tapping the overlay or pressing
Escape calls `close()`, which resets everything — no "discard changes?" guard. A user who has
typed a full exercise plus notes and mis-taps loses it all with no undo (unlike row deletes,
which *do* have undo).

**Direction:** guard dismissal when fields are dirty (confirm, or preserve the draft until the
modal is reopened).

### M4 — Logging an exercise doesn't show last time's performance
**Severity: Medium · Impact: Medium–High · Effort: Low**

> ✅ **Resolved** — shipped 2026-05-21 (Phase 2).

The Add-Exercise modal surfaces the last *note* for an exercise
([src/pages/Today.tsx:636-645](src/pages/Today.tsx#L636)) — a nice touch — but not the last
*weight × sets × reps*. The user re-types numbers the app already knows from their own history.
"Last time: 185 lbs × 8 × 3" is a defining premium behavior of a good logger: it lowers
cognitive load, speeds entry, and anchors progressive overload. The data is already computed
(`computeStrengthPRs`, full workout history).

**Direction:** show last performance for the entered exercise name, and optionally pre-fill from
it.

### M5 — Reaching an older date takes many taps
**Severity: Medium · Impact: Medium · Effort: Medium**

> ✅ **Resolved** — shipped 2026-05-21 (Phase 2).

Date navigation on Today is ±1-day chevrons only
([src/pages/Today.tsx:69-77](src/pages/Today.tsx#L69)). Logging a workout you forgot 10 days
ago means tapping "previous" 10 times. History lets you jump to a date, but only to days that
already have a workout — there is no way to *navigate to* an empty past day to backfill it.

**Direction:** add a date picker / calendar jump to the Today date control.

### M6 — Persistence runs on every keystroke
**Severity: Medium · Impact: Low–Medium · Effort: Low**

`useEffect(() => saveData(data), [data])` ([src/data/store.tsx:28-30](src/data/store.tsx#L28))
re-serializes the *entire* `AppData` and writes localStorage on every state change — including
each keystroke in the body-weight input, which calls `setBodyWeight` on every change
([src/pages/Today.tsx:435](src/pages/Today.tsx#L435)). At small data sizes this is invisible;
as the journal grows to years of workouts, stringifying the whole database on every keystroke
becomes a real jank source on lower-end phones.

**Direction:** debounce writes (e.g. ~300–500ms trailing). Pairs naturally with the C2 IndexedDB
migration.

### M7 — The "personal records" model is naive enough to mislead
**Severity: Medium · Impact: Medium · Effort: Medium**

`computeStrengthPRs` tracks **max weight only** ([src/data/logic.ts:42-55](src/data/logic.ts#L42)).
Bench 225×1 logged once means a later 225×10 never registers as a PR — a clear strength gain the
app calls nothing. Cardio PRs are "most calories" ([src/data/logic.ts:57-69](src/data/logic.ts#L57)),
a noisy, machine-estimated metric that rewards a bigger calorie readout over genuine improvement.
For a product that celebrates "records" with confetti, records that don't reflect real progress
quietly erode trust in the whole feedback layer.

**Direction:** consider weight×reps (estimated 1RM) for strength PRs, and time/distance/pace for
cardio. This is a product decision as much as a code change — flag for the owner.

### M8 — Touch targets fall below the 44px minimum
**Severity: Medium · Impact: Medium · Effort: Low**

Date-nav buttons are ~34×34px, row icon buttons ~32×32px, and the `sm` button variant renders
shorter than 44px. These are high-frequency targets (day navigation, row delete). Per WCAG 2.5.5
and platform guidance, interactive targets should be ≥44×44px. Undersized targets disproportionately
hurt the exact context this app is used in: one-handed, mid-workout, on a phone.

**Direction:** raise hit areas to ≥44px (padding/margin can extend the tap area without
enlarging the visual icon).

### M9 — Screen-reader and keyboard support has gaps
**Severity: Medium · Impact: Medium · Effort: Low–Medium**

Modals are handled well (focus trap, Escape, `aria-modal`). But: tappable History rows use
`role="button"` with no `aria-label` (a screen reader reads a confusing pile of nested text);
decorative Lucide icons lack `aria-hidden`; insight cards have no list semantics; and there is no
explicit, high-contrast focus ring for keyboard users.

**Direction:** add `aria-label`s to custom button rows, `aria-hidden` to decorative icons, and a
visible focus outline token applied to all interactive elements.

### M10 — There is no schema migration path
**Severity: Medium (latent) · Impact: Low now / High later · Effort: Medium**

`SCHEMA_VERSION` exists, but `normalize` ([src/data/storage.ts:76-88](src/data/storage.ts#L76))
just merges onto defaults and *stamps the current version* regardless of the input's actual
version. The first time the schema genuinely changes, old saves and — worse — old *backup files*
will be silently mis-shaped, with the version number lying about it. Because backups are the
only safety net, a backup that can't be safely restored after an update is a serious latent
trust risk.

**Direction:** implement a real versioned migration chain keyed on the stored `schemaVersion`
before the first schema change ships.

### M11 — Dark-only, with no theme choice
**Severity: Medium · Impact: Medium · Effort: Medium**

`tokens.css` hardcodes a dark palette and sets `color-scheme: dark`
([src/styles/tokens.css:73](src/styles/tokens.css#L73)); there is no light theme and no
`prefers-color-scheme` handling. A pure-black UI is hard to read in a bright gym and excludes
users who prefer or need light mode.

**Direction:** add light tokens and a theme control (the token architecture makes this clean —
the work is producing a second palette, not re-plumbing).

### M12 — No dynamic-type support
**Severity: Medium · Impact: Medium · Effort: Medium**

The type scale is fixed `px` ([src/styles/tokens.css:60-65](src/styles/tokens.css#L60)). Users
who raise their OS font size for readability get no response from the app, and layouts may break
if forced. This is a real accessibility and mobile-ergonomics gap.

**Direction:** move the type scale to `rem` on a `16px` root so it honors the user's text-size
setting; verify layouts at larger sizes.

---

## Low findings

### L1 — Numeric inputs are unvalidated
**Severity: Low · Impact: Low–Medium · Effort: Low**

Weight/sets/reps/cardio fields are `type="number"` with no `min`, and values are coerced via
`Number(x) || 0`. Negative weights and implausible numbers are accepted; bad input fails
silently rather than being flagged. **Direction:** add `min="0"`, sane `max`es, and light inline
validation.

### L2 — Cardio "Add" silently does nothing on empty fields
**Severity: Low · Impact: Low · Effort: Trivial**

> ✅ **Resolved** — shipped 2026-05-21 (Phase 1).

`submit` returns early with no feedback if time/speed/calories are all empty
([src/pages/Today.tsx:475-476](src/pages/Today.tsx#L475)). The user taps "Add" and nothing
happens. **Direction:** disable the button when empty, or show a brief hint.

### L3 — Capitalization and label casing are inconsistent
**Severity: Low · Impact: Low · Effort: Trivial**

"Add exercise" (section button) vs "Add Exercise" (modal title and modal button); sentence-case
Settings labels vs the design system's uppercase micro labels. **Direction:** pick one casing
rule per element type and apply it.

### L4 — Insights can stack into a wall of warnings
**Severity: Low–Medium · Impact: Low–Medium · Effort: Low**

`computeInsights` can emit several `warning`-tone items at once (multiple plateaus + imbalances),
and Progress renders all of them ([src/pages/Progress.tsx:163-180](src/pages/Progress.tsx#L163)).
A column of orange alerts is the opposite of calm. The Today hub already does this well — it
rotates a *single* nudge. **Direction:** cap and prioritize the insight list (e.g. top 3, mixed
tone) on Progress too.

### L5 — "Apple Health" overpromises
**Severity: Low · Impact: Low · Effort: Trivial**

> ✅ **Resolved** — shipped 2026-05-21 (Phase 1).

The section is titled "Apple Health" but is actually a manual import of a JSON file the user
produces via an iPhone Shortcut ([src/pages/Settings.tsx:220-249](src/pages/Settings.tsx#L220)).
The label implies a live integration that doesn't exist. **Direction:** rename to something
honest, e.g. "Import health data (JSON)."

### L6 — Recipes filter is not memoized
**Severity: Low · Impact: Low · Effort: Trivial**

The Recipes search/tag filter recomputes on every render rather than via `useMemo`. Negligible
today; cheap to fix. **Direction:** wrap in `useMemo` keyed on `[search, filters, recipes]`.

---

## Suggested sequencing (value per effort)

The same findings, re-sorted for a practical starting order. Nothing here is a redesign — each
is a contained, philosophy-preserving correction.

**1 — Do first: critical + cheap (highest value-per-effort)** · ✅ shipped 2026-05-21
- **C1** surface save failures — Critical, Low effort. The single best fix in the audit.
- **H1** add gentle backup nudges + first-run note — High, Low effort.
- **H4** snapshot current data before a restore — High, Low effort.
- **L2 / L5** disable empty cardio "Add"; rename "Apple Health" — Trivial.

**2 — Core-experience repairs** · ✅ shipped 2026-05-21
- **C3** tap-to-edit logged entries — fixes the broken template→log flow.
- **H2** make the unit preference real (or remove it until it is).
- **H3** paginate History instead of hard-capping at 60.
- **M3 / M4** guard the modal against discard; show "last time" performance.
- **M5** add a date-picker / calendar jump so backfilling an older day isn't many taps.

**3 — Behavioral & calm-UX tuning (preserve sustainability over addiction)**
- **M1** soften streak loss-framing; **M2** tier the celebration; **L4** cap the insight list.

**4 — Durability & performance**
- **C2** migrate storage to IndexedDB + request persistent storage — Critical but Medium–High
  effort; the most important *architectural* fix. **M6** debounce writes alongside it.
- **M10** add a real schema-migration chain before any schema change ships.

**5 — Accessibility & polish**
- **M8** touch targets, **M9** ARIA/focus, **M12** dynamic type, **M11** light theme,
  **L1** input validation, **L3** casing consistency, **L6** memoize the Recipes filter.
- **M7** revisit the PR model — flag as a product decision for the owner.
