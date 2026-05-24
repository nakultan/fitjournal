import { useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  HeartPulse,
  Info,
  Lock,
  SlidersHorizontal,
  Upload,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button, Card, Modal, PageHeader, Toggle, useToast } from '@/components'
import { useStore } from '@/data/store-context'
import { importData } from '@/data/storage'
import { downloadBackup, downloadCsv } from '@/lib/backup'
import { LOG_WORKOUT_SHORTCUT_NAME, parseHealthPayload } from '@/lib/healthBridge'
import type { SettingsSection } from '@/lib/router'
import type {
  AppData,
  DistanceUnit,
  Preferences,
  ThemePreference,
  TodayLayout,
  WeightUnit,
} from '@/data/types'

/** The eight numeric keys a Shortcut can hand to the bridge. */
const HEALTH_KEYS = [
  'steps',
  'distanceMi',
  'flightsClimbed',
  'activeEnergy',
  'exerciseMinutes',
  'restingHeartRate',
  'bodyMass',
  'sleepHours',
]

const SECTION_META: Record<
  SettingsSection,
  { title: string; subtitle: string; Icon: LucideIcon }
> = {
  preferences: {
    title: 'Preferences',
    subtitle: 'Theme, units, goals, daily reminder',
    Icon: SlidersHorizontal,
  },
  data: {
    title: 'Your data',
    subtitle: 'Back up to JSON or CSV, restore from a file',
    Icon: Download,
  },
  health: {
    title: 'Apple Health',
    subtitle: 'Shortcut-based sync, manual import fallback',
    Icon: HeartPulse,
  },
  about: {
    title: 'About FitJournal',
    subtitle: 'Privacy, what runs where, what doesn’t',
    Icon: Info,
  },
}
const SECTION_ORDER: SettingsSection[] = ['preferences', 'data', 'health', 'about']

export function SettingsScreen() {
  const { viewingSettingsSection, viewSettings } = useStore()
  const section = viewingSettingsSection
  const meta = section ? SECTION_META[section] : null

  return (
    <div className="fj-screen">
      <PageHeader
        title={meta ? meta.title : 'Settings'}
        subtitle={meta ? meta.subtitle : 'Preferences, your data, and integrations'}
        actions={
          section ? (
            <Button variant="ghost" onClick={() => viewSettings(null)}>
              <ChevronLeft size={16} /> Settings
            </Button>
          ) : undefined
        }
      />
      <div className="fj-settings-trust" role="note">
        <Lock size={14} aria-hidden="true" />
        <span>Everything stays on this device — no account, no servers.</span>
      </div>

      {!section && <SettingsIndex onPick={(s) => viewSettings(s)} />}
      {section === 'preferences' && <PreferencesSection />}
      {section === 'data' && <DataSection />}
      {section === 'health' && <HealthSection />}
      {section === 'about' && <AboutSection />}
    </div>
  )
}

/* ---------- Index ---------- */
function SettingsIndex({ onPick }: { onPick: (s: SettingsSection) => void }) {
  return (
    <div className="fj-settings-index">
      {SECTION_ORDER.map((id) => {
        const m = SECTION_META[id]
        return (
          <Card
            key={id}
            className="fj-settings-card"
            onClick={() => onPick(id)}
            aria-label={`${m.title}. ${m.subtitle}.`}
          >
            <span className="fj-settings-card__icon">
              <m.Icon size={20} />
            </span>
            <span className="fj-settings-card__body">
              <span className="fj-settings-card__title">{m.title}</span>
              <span className="fj-settings-card__sub">{m.subtitle}</span>
            </span>
            <ChevronRight size={18} color="var(--color-text-dim)" aria-hidden="true" />
          </Card>
        )
      })}
      <p className="fj-muted" style={{ textAlign: 'center', marginTop: 'var(--space-6)' }}>
        FitJournal runs entirely on this device — no account, no servers, no internet required.
      </p>
    </div>
  )
}

/* ---------- Preferences ---------- */
function PreferencesSection() {
  const { data, savePreferences } = useStore()
  const prefs = data.preferences
  const patch = (change: Partial<Preferences>): void => savePreferences({ ...prefs, ...change })

  return (
    <div className="fj-settings-group">
      <div className="fj-settings-row">
        <div>
          <div className="fj-settings-row__label">Theme</div>
          <div className="fj-settings-row__desc">Follow your device, or force light or dark</div>
        </div>
        <select
          className="fj-select"
          style={{ width: 120 }}
          aria-label="Theme"
          value={prefs.theme}
          onChange={(e) => patch({ theme: e.target.value as ThemePreference })}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
      <div className="fj-settings-row">
        <div>
          <div className="fj-settings-row__label">Weight unit</div>
          <div className="fj-settings-row__desc">Used across logging and records</div>
        </div>
        <select
          className="fj-select"
          style={{ width: 120 }}
          aria-label="Weight unit"
          value={prefs.weightUnit}
          onChange={(e) => patch({ weightUnit: e.target.value as WeightUnit })}
        >
          <option value="lbs">lbs</option>
          <option value="kg">kg</option>
        </select>
      </div>
      <div className="fj-settings-row">
        <div>
          <div className="fj-settings-row__label">Distance unit</div>
          <div className="fj-settings-row__desc">Used for cardio distance</div>
        </div>
        <select
          className="fj-select"
          style={{ width: 120 }}
          aria-label="Distance unit"
          value={prefs.distanceUnit}
          onChange={(e) => patch({ distanceUnit: e.target.value as DistanceUnit })}
        >
          <option value="miles">miles</option>
          <option value="km">km</option>
        </select>
      </div>
      <div className="fj-settings-row">
        <div>
          <div className="fj-settings-row__label">Goal weight</div>
          <div className="fj-settings-row__desc">Your target body weight</div>
        </div>
        <input
          className="fj-input"
          type="number"
          inputMode="decimal"
          min={0}
          aria-label="Goal weight"
          style={{ width: 120, textAlign: 'center' }}
          value={prefs.goalWeight || ''}
          placeholder="0"
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => patch({ goalWeight: Math.max(0, Number(e.target.value) || 0) })}
        />
      </div>
      <div className="fj-settings-row">
        <div>
          <div className="fj-settings-row__label">Weekly workout goal</div>
          <div className="fj-settings-row__desc">How many workouts you aim for each week</div>
        </div>
        <input
          className="fj-input"
          type="number"
          inputMode="numeric"
          min={1}
          max={7}
          aria-label="Weekly workout goal"
          style={{ width: 120, textAlign: 'center' }}
          value={prefs.weeklyGoal}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) =>
            patch({ weeklyGoal: Math.max(1, Math.min(7, Number(e.target.value) || 1)) })
          }
        />
      </div>
      <div className="fj-settings-row">
        <div>
          <div className="fj-settings-row__label">Today layout</div>
          <div className="fj-settings-row__desc">
            Focused collapses Body weight, Cardio and Day note into tappable
            affordances until you use them
          </div>
        </div>
        <select
          className="fj-select"
          style={{ width: 120 }}
          aria-label="Today layout"
          value={prefs.todayLayout ?? 'classic'}
          onChange={(e) => patch({ todayLayout: e.target.value as TodayLayout })}
        >
          <option value="classic">Classic</option>
          <option value="focused">Focused</option>
        </select>
      </div>
      <div className="fj-settings-row">
        <div>
          <div className="fj-settings-row__label">Daily reminder</div>
          <div className="fj-settings-row__desc">
            Show a nudge on Today when a planned workout isn't logged yet
          </div>
        </div>
        <Toggle
          ariaLabel="Daily reminder"
          checked={prefs.dailyReminder}
          onChange={(v) => patch({ dailyReminder: v })}
        />
      </div>
      <div className="fj-settings-row">
        <div>
          <div className="fj-settings-row__label">Weekly recap</div>
          <div className="fj-settings-row__desc">Show a weekly summary at the top of Progress</div>
        </div>
        <Toggle
          ariaLabel="Weekly recap"
          checked={prefs.weeklySummary}
          onChange={(v) => patch({ weeklySummary: v })}
        />
      </div>
    </div>
  )
}

/* ---------- Data ---------- */
function relativeTime(ms: number): string {
  const diff = Math.max(0, Date.now() - ms)
  if (diff < 60_000) return 'just now'
  const mins = Math.round(diff / 60_000)
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function DataSection() {
  const { data, restoreData, markBackedUp, lastSavedAt } = useStore()
  const { showToast } = useToast()
  const importFileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ data: AppData; fileName: string } | null>(null)

  const exportBackup = (): void => {
    downloadBackup(data)
    markBackedUp()
    showToast('Backup downloaded', 'success')
  }

  const exportCsv = (): void => {
    downloadCsv(data)
    showToast('CSV downloaded', 'success')
  }

  const handleImportFile = (file: File): void => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        setPending({ data: importData(String(reader.result)), fileName: file.name })
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not read that file', 'warning')
      }
    }
    reader.readAsText(file)
  }

  const confirmImport = (): void => {
    if (!pending) return
    // Snapshot the current data to a file first, so a mistaken restore can
    // be undone — the overwrite is otherwise irreversible.
    downloadBackup(data)
    restoreData(pending.data)
    setPending(null)
    showToast('Backup restored — your previous data was downloaded first', 'success')
  }

  return (
    <div className="fj-settings-group">
      <div className="fj-settings-row">
        <div>
          <div className="fj-settings-row__label">Back up your data</div>
          <div className="fj-settings-row__desc">
            Everything is stored only on this device. Download a JSON backup regularly so
            nothing is lost — or a CSV for spreadsheet analysis.
          </div>
        </div>
        <div className="fj-row" style={{ gap: 'var(--space-2)' }}>
          <Button variant="secondary" onClick={exportBackup}>
            <Download size={15} /> JSON
          </Button>
          <Button variant="secondary" onClick={exportCsv}>
            <Download size={15} /> CSV
          </Button>
        </div>
      </div>
      <div className="fj-settings-row">
        <div>
          <div className="fj-settings-row__label">Restore from a backup</div>
          <div className="fj-settings-row__desc">
            Load a previously exported file. This replaces everything currently in the app.
          </div>
        </div>
        <Button variant="secondary" onClick={() => importFileRef.current?.click()}>
          <Upload size={15} /> Import
        </Button>
        <input
          ref={importFileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleImportFile(file)
            e.target.value = ''
          }}
        />
      </div>

      <div className="fj-settings-meta">
        <span>
          Auto-saved{' '}
          {lastSavedAt > 0 ? relativeTime(lastSavedAt) : 'as you go'}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          Last backup{' '}
          {data.lastBackupAt
            ? relativeTime(new Date(data.lastBackupAt).getTime())
            : 'never'}
        </span>
      </div>

      {pending && (
        <Modal
          open
          onClose={() => setPending(null)}
          title="Restore this backup?"
          footer={
            <>
              <Button variant="ghost" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmImport}>
                Replace my data
              </Button>
            </>
          }
        >
          <p style={{ marginBottom: 'var(--space-3)' }}>
            This replaces <strong>everything</strong> currently in FitJournal with the contents
            of <strong>{pending.fileName}</strong>.
          </p>
          <p>
            The backup holds <strong>{Object.keys(pending.data.workouts).length}</strong> workout
            days, <strong>{pending.data.templates.length}</strong> templates and{' '}
            <strong>{pending.data.recipes.length}</strong> recipes. A copy of your current data
            will be downloaded first, so you can undo this.
          </p>
        </Modal>
      )}
    </div>
  )
}

/* ---------- Apple Health ---------- */
function HealthSection() {
  const { data, setHealth } = useStore()
  const { showToast } = useToast()
  const healthFileRef = useRef<HTMLInputElement>(null)
  const health = data.health

  const importHealthFile = (file: File): void => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result))
        const parsedHealth = parseHealthPayload(parsed, file.name)
        if (!parsedHealth) {
          showToast('No health numbers found in that file', 'warning')
          return
        }
        setHealth(parsedHealth)
        showToast('Health data imported', 'success')
      } catch {
        showToast('Could not read that file — check the JSON', 'warning')
      }
    }
    reader.readAsText(file)
  }

  // The exact URL the companion Shortcut should open — works whether the app
  // is loaded from production, an installed PWA, or a local preview build.
  const appUrl = typeof location !== 'undefined' ? location.origin + location.pathname : '/'

  return (
    <div className="fj-settings-group">
      <div className="fj-settings-row">
        <div>
          <div className="fj-settings-row__label">Sync with Apple Health</div>
          <div className="fj-settings-row__desc">
            FitJournal stays a pure web app, so it can't read Health directly. An
            Apple Shortcut reads your Health data and hands it to FitJournal in one tap.
          </div>
          {health?.importedAt && (
            <div
              className="fj-settings-row__desc"
              style={{ color: 'var(--color-success)', marginTop: 4 }}
            >
              Last synced {new Date(health.importedAt).toLocaleString()}
            </div>
          )}
        </div>
      </div>
      <details className="fj-howto">
        <summary>How to set up the sync</summary>
        <ol className="fj-howto__steps">
          <li>In the Shortcuts app on your iPhone, create a new Shortcut.</li>
          <li>
            For each metric you want, add a <strong>Get Health Sample</strong> action — Steps,
            Walking + Running Distance, Flights Climbed, Active Energy, Exercise Minutes,
            Resting Heart Rate, Weight, Sleep.
          </li>
          <li>
            Add a <strong>Dictionary</strong> action. Add one key per metric, using these names:
            <span className="fj-howto__keys">
              {HEALTH_KEYS.map((k) => (
                <code key={k}>{k}</code>
              ))}
            </span>
            Set each value to its sample. Every field is optional — include only what you want
            to sync.
          </li>
          <li>
            Pass the Dictionary through <strong>Get Text from Input</strong>, then{' '}
            <strong>URL Encode</strong> the text.
          </li>
          <li>
            Add <strong>Open URLs</strong> with{' '}
            <code>{appUrl}?health=</code> followed by the encoded text.
          </li>
          <li>Run it from the Home Screen, the share sheet, or a daily automation.</li>
        </ol>
        <p className="fj-howto__note">
          Numbers only — anything non-numeric is silently dropped on import.
        </p>
      </details>
      <details className="fj-howto">
        <summary>How to log workouts back to Health</summary>
        <p className="fj-howto__intro">
          Optional companion. After tapping <em>Finish &amp; review workout</em>, a{' '}
          <strong>Log to Health</strong> button appears on the summary — it opens
          this Shortcut with the day&apos;s totals as JSON text.
        </p>
        <ol className="fj-howto__steps">
          <li>
            Create a new Shortcut and name it exactly{' '}
            <code>{LOG_WORKOUT_SHORTCUT_NAME}</code>.
          </li>
          <li>
            Add <strong>Get Dictionary from Input</strong> (Shortcut Input). Fields
            available:
            <span className="fj-howto__keys">
              <code>date</code>
              <code>exerciseCount</code>
              <code>totalSets</code>
              <code>totalVolume</code>
              <code>weightUnit</code>
              <code>cardioMinutes</code>
              <code>bodyWeight</code>
            </span>
          </li>
          <li>
            Add <strong>Log Workout</strong> (HealthKit) — use{' '}
            <code>cardioMinutes</code> for the duration and pick a workout type that
            fits your training.
          </li>
          <li>
            Optional: write a body-mass sample to Health when <code>bodyWeight</code>{' '}
            is present.
          </li>
        </ol>
        <p className="fj-howto__note">
          The button only shows once you&apos;ve done at least one inbound sync.
        </p>
      </details>
      <div className="fj-settings-row">
        <div>
          <div className="fj-settings-row__label">Import from a file instead</div>
          <div className="fj-settings-row__desc">
            No Shortcut? Import a JSON file with the same fields as a one-off.
          </div>
        </div>
        <Button variant="secondary" onClick={() => healthFileRef.current?.click()}>
          <Upload size={15} /> Import JSON
        </Button>
        <input
          ref={healthFileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) importHealthFile(file)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

/* ---------- About ---------- */
function AboutSection() {
  return (
    <div className="fj-settings-group">
      <div className="fj-settings-row">
        <div>
          <div className="fj-settings-row__label">
            <Lock
              size={14}
              style={{ verticalAlign: '-2px', marginRight: 6, color: 'var(--color-success)' }}
            />
            On-device only
          </div>
          <div className="fj-settings-row__desc">
            FitJournal runs entirely on this device — no account, no servers, no internet
            required. Your workouts, recipes, and Apple Health data never leave your phone.
          </div>
        </div>
      </div>
      <div className="fj-settings-row">
        <div>
          <div className="fj-settings-row__label">Why you should back up</div>
          <div className="fj-settings-row__desc">
            Browser storage is durable but not eternal — clearing site data, switching
            phones, or losing a device can lose your journal. Export a JSON backup from
            Your data every few weeks.
          </div>
        </div>
      </div>
      <details className="fj-howto">
        <summary>What&apos;s new</summary>
        <ul className="fj-howto__steps">
          <li>
            Resume Session pill — pick a live workout back up from any screen.
          </li>
          <li>
            Focused Today layout (Preferences) — collapses cardio, body weight, and
            day note into add-row buttons until you need them.
          </li>
          <li>
            Plan: tap a day to assign a template — no more stacked dropdowns.
          </li>
          <li>
            Settings is grouped into cards with deep-link routes.
          </li>
          <li>
            Recipes: launch Cook mode straight from the grid.
          </li>
          <li>
            Quieter Progress Overview — charts and insights collapse behind a single
            toggle so the top of the screen stays calm.
          </li>
        </ul>
      </details>
    </div>
  )
}
