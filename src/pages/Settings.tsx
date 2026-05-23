import { useRef, useState } from 'react'
import { Download, HeartPulse, SlidersHorizontal, Upload } from 'lucide-react'
import { Button, Modal, PageHeader, Toggle, useToast } from '@/components'
import { useStore } from '@/data/store-context'
import { importData } from '@/data/storage'
import { downloadBackup, downloadCsv } from '@/lib/backup'
import { LOG_WORKOUT_SHORTCUT_NAME, parseHealthPayload } from '@/lib/healthBridge'
import type {
  AppData,
  DistanceUnit,
  Preferences,
  ThemePreference,
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

export function SettingsScreen() {
  const { data, savePreferences, setHealth, restoreData, markBackedUp } = useStore()
  const { showToast } = useToast()
  const healthFileRef = useRef<HTMLInputElement>(null)
  const importFileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ data: AppData; fileName: string } | null>(null)
  const prefs = data.preferences
  const health = data.health

  const patch = (change: Partial<Preferences>): void =>
    savePreferences({ ...prefs, ...change })

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
    <div className="fj-screen">
      <PageHeader title="Settings" subtitle="Preferences, your data, and integrations" />

      {/* Preferences */}
      <div className="fj-settings-group">
        <div className="fj-settings-group__title">
          <SlidersHorizontal
            size={12}
            style={{ verticalAlign: '-1px', marginRight: 6 }}
          />
          Preferences
        </div>
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
            min={0}
            aria-label="Goal weight"
            style={{ width: 120, textAlign: 'center' }}
            value={prefs.goalWeight}
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
            min={1}
            max={7}
            aria-label="Weekly workout goal"
            style={{ width: 120, textAlign: 'center' }}
            value={prefs.weeklyGoal}
            onChange={(e) =>
              patch({ weeklyGoal: Math.max(1, Math.min(7, Number(e.target.value) || 1)) })
            }
          />
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

      {/* Data & backup */}
      <div className="fj-settings-group">
        <div className="fj-settings-group__title">
          <Download size={12} style={{ verticalAlign: '-1px', marginRight: 6 }} />
          Your data
        </div>
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
      </div>

      {/* Apple Health */}
      <div className="fj-settings-group">
        <div className="fj-settings-group__title">
          <HeartPulse size={12} style={{ verticalAlign: '-1px', marginRight: 6 }} />
          Apple Health
        </div>
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

      <p className="fj-muted" style={{ textAlign: 'center', marginTop: 'var(--space-6)' }}>
        FitJournal runs entirely on this device — no account, no servers, no internet required.
      </p>

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
