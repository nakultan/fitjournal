import { useRef } from 'react'
import { Download, Footprints, HeartPulse, MapPin, SlidersHorizontal, TrendingUp } from 'lucide-react'
import { Button, Card, PageHeader, StatTile, Toggle, useToast } from '@/components'
import { useStore } from '@/data/store-context'
import { exportData } from '@/data/storage'
import type { DistanceUnit, HealthData, Preferences, WeightUnit } from '@/data/types'

export function SettingsScreen() {
  const { data, savePreferences, setHealth } = useStore()
  const { showToast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const prefs = data.preferences

  const patch = (change: Partial<Preferences>) => savePreferences({ ...prefs, ...change })

  const exportBackup = () => {
    const blob = new Blob([exportData(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fitjournal-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Backup downloaded', 'success')
  }

  const importHealth = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result)) as Record<string, unknown>
        const health: HealthData = {
          steps: typeof json.steps === 'number' ? json.steps : null,
          distanceMi: typeof json.distance_mi === 'number' ? json.distance_mi : null,
          flightsClimbed: typeof json.flights_climbed === 'number' ? json.flights_climbed : null,
          importedAt: new Date().toISOString(),
          fileName: file.name,
        }
        setHealth(health)
        showToast('Health data imported', 'success')
      } catch {
        showToast('Could not read that file — check the JSON', 'warning')
      }
    }
    reader.readAsText(file)
  }

  const health = data.health

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
            <div className="fj-settings-row__label">Weight unit</div>
            <div className="fj-settings-row__desc">Used across logging and records</div>
          </div>
          <select
            className="fj-select"
            style={{ width: 120 }}
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
            style={{ width: 120, textAlign: 'center' }}
            value={prefs.goalWeight}
            onChange={(e) => patch({ goalWeight: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="fj-settings-row">
          <div>
            <div className="fj-settings-row__label">Daily reminder</div>
            <div className="fj-settings-row__desc">Remind me to log my workout</div>
          </div>
          <Toggle
            checked={prefs.dailyReminder}
            onChange={(v) => patch({ dailyReminder: v })}
          />
        </div>
        <div className="fj-settings-row">
          <div>
            <div className="fj-settings-row__label">Weekly summary</div>
            <div className="fj-settings-row__desc">Show a weekly progress recap</div>
          </div>
          <Toggle
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
              Everything is stored only on this device. Download a backup file regularly so
              nothing is lost.
            </div>
          </div>
          <Button variant="secondary" onClick={exportBackup}>
            <Download size={15} /> Export
          </Button>
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
            <div className="fj-settings-row__label">Import health data</div>
            <div className="fj-settings-row__desc">
              Export Steps, Distance and Flights from an iPhone Shortcut to a JSON file, then
              import it here.
            </div>
          </div>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            Import JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importHealth(file)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {health && (health.steps != null || health.distanceMi != null || health.flightsClimbed != null) && (
        <Card style={{ marginBottom: 'var(--space-4)' }}>
          <div className="fj-stat-grid">
            <StatTile
              icon={<Footprints size={22} color="var(--color-accent)" />}
              value={health.steps != null ? health.steps.toLocaleString() : '—'}
              label="Steps"
            />
            <StatTile
              icon={<MapPin size={22} color="var(--color-success)" />}
              value={health.distanceMi != null ? `${health.distanceMi} mi` : '—'}
              label="Distance"
            />
            <StatTile
              icon={<TrendingUp size={22} color="var(--color-warning)" />}
              value={health.flightsClimbed != null ? health.flightsClimbed : '—'}
              label="Flights climbed"
            />
          </div>
          {health.importedAt && (
            <p className="fj-muted" style={{ marginTop: 'var(--space-3)' }}>
              Imported from {health.fileName ?? 'a file'} ·{' '}
              {new Date(health.importedAt).toLocaleString()}
            </p>
          )}
        </Card>
      )}

      <p className="fj-muted" style={{ textAlign: 'center', marginTop: 'var(--space-6)' }}>
        FitJournal runs entirely on this device — no account, no servers, no internet required.
      </p>
    </div>
  )
}
