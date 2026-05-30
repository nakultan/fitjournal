import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Cloud,
  Download,
  HeartPulse,
  Info,
  Lock,
  RefreshCw,
  SlidersHorizontal,
  Upload,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button, Card, Modal, PageHeader, Toggle, useToast } from '@/components'
import { useStore } from '@/data/store-context'
import { totalWorkoutsLogged } from '@/data/logic'
import { importData } from '@/data/storage'
import { downloadBackup, downloadCsv } from '@/lib/backup'
import { LOG_WORKOUT_SHORTCUT_NAME, parseHealthPayload } from '@/lib/healthBridge'
import type { SettingsSection } from '@/lib/router'
import type {
  AppData,
  BackupReminderWeeks,
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
        kind="tool"
        actions={
          section ? (
            <Button variant="ghost" onClick={() => viewSettings(null)}>
              <ChevronLeft size={16} /> Settings
            </Button>
          ) : undefined
        }
      />
      {/* P3.9 — on the index, a rotating trust signal (workout count / disk
          footprint / backup age) varies by day; on the sub-sections the
          steady "no account, no servers" line stays put. */}
      {section ? (
        <div className="fj-settings-trust" role="note">
          <Lock size={14} aria-hidden="true" />
          <span>Everything stays on this device — no account, no servers.</span>
        </div>
      ) : (
        <RotatingTrust />
      )}

      {!section && <SettingsIndex onPick={(s) => viewSettings(s)} />}
      {section === 'preferences' && <PreferencesSection />}
      {section === 'data' && <DataSection />}
      {section === 'health' && <HealthSection />}
      {section === 'about' && <AboutSection />}
    </div>
  )
}

/* ---------- Rotating trust microcopy (P3.9) ----------
 * One trust signal at a time — workout count, on-disk footprint, or backup
 * age — picked deterministically from the calendar day so it's stable for
 * the day but varies over time. The app makes its work visible without
 * being noisy. Disk footprint comes from `navigator.storage.estimate()`,
 * which is async and may be unsupported; the candidate is simply dropped
 * from the pool when it can't be measured.
 */
function RotatingTrust() {
  const { data } = useStore()
  const [diskMb, setDiskMb] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      navigator.storage
        .estimate()
        .then((est) => {
          if (cancelled) return
          const usage = est.usage ?? 0
          if (usage > 0) setDiskMb(usage / (1024 * 1024))
        })
        .catch(() => {
          /* unsupported / denied — the disk line just won't appear */
        })
    }
    return () => {
      cancelled = true
    }
  }, [])

  const workouts = totalWorkoutsLogged(data.workouts)
  const messages: string[] = [`${workouts} workout${workouts === 1 ? '' : 's'} on this device`]
  if (diskMb != null) {
    messages.push(diskMb < 1 ? `${Math.round(diskMb * 1024)} KB on disk` : `${diskMb.toFixed(1)} MB on disk`)
  }
  messages.push(
    data.lastBackupAt
      ? `last backup ${relativeTime(new Date(data.lastBackupAt).getTime())}`
      : 'no backup yet — export one soon',
  )

  // Day-stable seed: sum the YYYY-MM-DD char codes, modulo the pool size.
  const daySeed = new Date().toISOString().slice(0, 10)
  let seed = 0
  for (let i = 0; i < daySeed.length; i++) seed += daySeed.charCodeAt(i)
  const message = messages[seed % messages.length]

  return (
    <div className="fj-settings-trust" role="note">
      <Lock size={14} aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

/* ---------- Index ---------- */
function SettingsIndex({ onPick }: { onPick: (s: SettingsSection) => void }) {
  const { data } = useStore()
  // P2.5 / P3.5 — surface the "N wks since backup" pressure on the Your
  // data card itself, so the lifter sees it before they have to dig. The
  // current time is captured once per mount via the lazy `useState` init so
  // `Date.now()` does not get called during render.
  const [renderTime] = useState(() => Date.now())
  const backupPill = useMemo<string | null>(() => {
    if (!data.lastBackupAt) return 'never backed up'
    const ageMs = renderTime - new Date(data.lastBackupAt).getTime()
    const weeks = Math.floor(ageMs / (7 * 86_400_000))
    if (weeks >= 1) return `${weeks} wk${weeks === 1 ? '' : 's'} since backup`
    return null
  }, [data.lastBackupAt, renderTime])
  return (
    <div className="fj-settings-index">
      {SECTION_ORDER.map((id) => {
        const m = SECTION_META[id]
        const isData = id === 'data'
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
            {isData && backupPill ? (
              <span className="fj-settings-card__pill" aria-hidden="true">
                {backupPill}
              </span>
            ) : (
              <ChevronRight size={18} color="var(--color-text-dim)" aria-hidden="true" />
            )}
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

      <NudgesGroup />
    </div>
  )
}

/* ---------- Nudges (P2.5) ----------
 * Two opt-in pre-engagement controls: a streak-save reminder fires once a
 * day via the PWA Notification API (when the user grants permission; no-op
 * otherwise), and a backup-reminder cadence picker tunes how often the
 * existing `BackupReminder` banner asks the lifter to export. Both ship
 * additively — defaults preserve the prior behaviour. */
function NudgesGroup() {
  const { data, savePreferences } = useStore()
  const { showToast } = useToast()
  const prefs = data.preferences
  const streak = prefs.streakNudge ?? { enabled: false, time: '19:00' }
  const cadence = prefs.backupReminderWeeks ?? 3
  // The Notification API is unavailable on non-secure contexts and on iOS
  // Safari outside an installed PWA. Detect at render so the toggle stays
  // honest instead of silently failing.
  const canNotify = typeof Notification !== 'undefined'
  const permission = canNotify ? Notification.permission : 'denied'

  const setStreak = (next: { enabled: boolean; time: string }): void => {
    savePreferences({ ...prefs, streakNudge: next })
  }

  const requestPermission = async (): Promise<void> => {
    if (!canNotify) return
    try {
      const result = await Notification.requestPermission()
      if (result === 'granted') {
        setStreak({ enabled: true, time: streak.time })
        showToast(`Reminder on — we'll nudge you at ${streak.time} when today isn't logged.`, 'success')
      } else {
        setStreak({ enabled: false, time: streak.time })
        showToast('Reminder needs notification permission — try again later.', 'warning')
      }
    } catch {
      showToast('Could not enable reminders on this device.', 'warning')
    }
  }

  const toggleStreak = (enabled: boolean): void => {
    if (enabled && permission !== 'granted') {
      void requestPermission()
      return
    }
    setStreak({ enabled, time: streak.time })
  }

  return (
    <>
      <h3 className="fj-settings-subhead">Nudges</h3>
      <div className="fj-settings-row">
        <div>
          <div className="fj-settings-row__label">Streak-save reminder</div>
          <div className="fj-settings-row__desc">
            A nudge at your chosen time when today isn't logged yet. It fires
            while FitJournal is open — a web app can't alert you while fully
            closed. Needs notification permission; off by default.
          </div>
          {canNotify && permission === 'denied' && streak.enabled && (
            <div
              className="fj-settings-row__desc"
              style={{ color: 'var(--color-warning)', marginTop: 4 }}
            >
              Notifications are blocked — the reminder won&apos;t fire until
              you re-enable them in your browser.
            </div>
          )}
          {!canNotify && (
            <div
              className="fj-settings-row__desc"
              style={{ color: 'var(--color-text-dim)', marginTop: 4 }}
            >
              Notifications aren&apos;t available on this device.
            </div>
          )}
        </div>
        <div className="fj-row" style={{ gap: 'var(--space-2)' }}>
          <input
            className="fj-input"
            type="time"
            aria-label="Reminder time"
            style={{ width: 120, textAlign: 'center' }}
            value={streak.time}
            onChange={(e) =>
              setStreak({ enabled: streak.enabled, time: e.target.value || '19:00' })
            }
            disabled={!canNotify}
          />
          <Toggle
            ariaLabel="Streak-save reminder"
            checked={streak.enabled && permission === 'granted'}
            onChange={toggleStreak}
          />
        </div>
      </div>
      <div className="fj-settings-row">
        <div>
          <div className="fj-settings-row__label">Backup reminder cadence</div>
          <div className="fj-settings-row__desc">
            How often the calm "Export a backup" banner reappears. Defaults to 3 weeks.
          </div>
        </div>
        <select
          className="fj-select"
          style={{ width: 120 }}
          aria-label="Backup reminder cadence"
          value={cadence}
          onChange={(e) =>
            savePreferences({
              ...prefs,
              backupReminderWeeks: Number(e.target.value) as BackupReminderWeeks,
            })
          }
        >
          {[1, 2, 3, 4].map((w) => (
            <option key={w} value={w}>
              {w} wk{w === 1 ? '' : 's'}
            </option>
          ))}
        </select>
      </div>
    </>
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
      <SyncCard />
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

/* ---------- Multi-device sync (Supabase) ----------
 * A calm block at the top of Your data. Signed out, it offers a magic-link
 * sign-in; signed in, it shows who's syncing, the live status, and a manual
 * "Sync now". The whole block hides when the build has no Supabase
 * credentials (`sync.configured` false) so the offline-only app is unchanged. */
function SyncCard() {
  const { sync, signIn, signUp, resetPassword, updatePassword, signOut, syncNow } = useStore()
  const { showToast } = useToast()
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  if (!sync.configured) return null

  const handleSubmit = async (): Promise<void> => {
    const e = email.trim()
    const p = password
    if (!e) return

    if (mode === 'reset') {
      setBusy(true)
      const err = await resetPassword(e)
      setBusy(false)
      if (err) {
        showToast(err, 'warning')
      } else {
        showToast('Password-reset link sent — check your email.', 'success')
        setMode('signin')
      }
      return
    }

    if (!p) return
    if (mode === 'signup' && p.length < 6) {
      showToast('Password must be at least 6 characters.', 'warning')
      return
    }
    setBusy(true)
    if (mode === 'signin') {
      const err = await signIn(e, p)
      setBusy(false)
      if (err) showToast(err, 'warning')
      // On success, onAuthStateChange flips the card to the signed-in view.
    } else {
      const { error, needsConfirm } = await signUp(e, p)
      setBusy(false)
      if (error) {
        showToast(error, 'warning')
      } else if (needsConfirm) {
        showToast('Account created — confirm via the email we sent, then sign in.', 'success')
        setMode('signin')
        setPassword('')
      } else {
        showToast('Account created — you’re signed in and syncing.', 'success')
      }
    }
  }

  // After following a reset link the user lands in a recovery session — prompt
  // for the new password before anything else.
  if (sync.recovering) {
    return <RecoverPasswordRow updatePassword={updatePassword} />
  }

  const statusLabel =
    sync.status === 'syncing'
      ? 'Syncing…'
      : sync.status === 'error'
        ? 'Sync error — will retry'
        : sync.lastSyncedAt
          ? `Last synced ${relativeTime(sync.lastSyncedAt)}`
          : 'Synced'

  if (!sync.signedIn) {
    const title =
      mode === 'signin' ? 'Sign in to sync' : mode === 'signup' ? 'Create a sync account' : 'Reset your password'
    const desc =
      mode === 'signin'
        ? 'Sign in with your email and password to sync your journal across every device. Your data stays private to your account.'
        : mode === 'signup'
          ? 'Pick an email and password. Use the same login on your phone and laptop and your journal syncs automatically.'
          : 'Enter your account email and we’ll send a link to set a new password.'
    const submitLabel = mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'
    const busyLabel = mode === 'signin' ? 'Signing in…' : mode === 'signup' ? 'Creating…' : 'Sending…'

    return (
      <div className="fj-settings-row">
        <div>
          <div className="fj-settings-row__label">
            <Cloud size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            {title}
          </div>
          <div className="fj-settings-row__desc">{desc}</div>
          <div className="fj-settings-row__desc" style={{ marginTop: 6 }}>
            {mode === 'signin' && (
              <>
                No account yet? <LinkButton onClick={() => setMode('signup')}>Create one</LinkButton>
                {' · '}
                <LinkButton onClick={() => setMode('reset')}>Forgot password?</LinkButton>
              </>
            )}
            {mode === 'signup' && (
              <>
                Already have an account? <LinkButton onClick={() => setMode('signin')}>Sign in</LinkButton>
              </>
            )}
            {mode === 'reset' && (
              <LinkButton onClick={() => setMode('signin')}>Back to sign in</LinkButton>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <input
            className="fj-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@email.com"
            aria-label="Email"
            style={{ width: 200 }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && mode === 'reset') void handleSubmit()
            }}
          />
          {mode !== 'reset' && (
            <input
              className="fj-input"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder="Password"
              aria-label="Password"
              style={{ width: 200 }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSubmit()
              }}
            />
          )}
          <Button
            onClick={() => void handleSubmit()}
            disabled={busy || !email.trim() || (mode !== 'reset' && !password)}
          >
            {busy ? busyLabel : submitLabel}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="fj-settings-row">
        <div>
          <div className="fj-settings-row__label">
            <Cloud size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Multi-device sync
          </div>
          <div className="fj-settings-row__desc">
            Signed in as {sync.email}. Your journal syncs across every device you sign in on,
            and keeps working offline — changes sync when you reconnect.
          </div>
          <div
            className="fj-settings-row__desc"
            style={{
              marginTop: 4,
              color: sync.status === 'error' ? 'var(--color-warning)' : 'var(--color-text-dim)',
            }}
          >
            {statusLabel}
          </div>
        </div>
        <div className="fj-row" style={{ gap: 'var(--space-2)' }}>
          <Button
            variant="secondary"
            onClick={() => void syncNow()}
            disabled={sync.status === 'syncing'}
          >
            <RefreshCw size={15} /> Sync now
          </Button>
        </div>
      </div>
      <div className="fj-settings-row">
        <div>
          <div className="fj-settings-row__label">Sign out</div>
          <div className="fj-settings-row__desc">
            Stops syncing on this device. Your journal stays here — nothing is deleted.
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            void signOut()
            showToast('Signed out — this device is local-only again.', 'success')
          }}
        >
          Sign out
        </Button>
      </div>
    </>
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
