import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { useStore } from '@/data/store-context'
import { totalWorkoutsLogged } from '@/data/logic'
import { downloadBackup } from '@/lib/backup'
import { Button } from './Button'

const DAY_MS = 86_400_000
const DEFAULT_REMIND_AFTER_WEEKS = 3

/**
 * A calm, dismissible nudge to export a backup — the only safety net for an
 * on-device-only app. Appears once there are workouts worth losing and the
 * user has either never backed up or not done so in the configured window
 * (Preferences.backupReminderWeeks, default 3 — see P2.5). Dismissal
 * ("Later") lasts for the session; exporting clears it for the next window.
 */
export function BackupReminder() {
  const { data, markBackedUp } = useStore()
  const [dismissed, setDismissed] = useState(false)
  const reminderWeeks = data.preferences.backupReminderWeeks ?? DEFAULT_REMIND_AFTER_WEEKS

  const hasData = totalWorkoutsLogged(data.workouts) > 0
  const neverBackedUp = !data.lastBackupAt
  const overdue = useMemo(() => {
    if (!data.lastBackupAt) return true
    const ageMs = new Date().getTime() - new Date(data.lastBackupAt).getTime()
    return ageMs > reminderWeeks * 7 * DAY_MS
  }, [data.lastBackupAt, reminderWeeks])

  if (dismissed || !hasData || !overdue) return null

  const exportNow = () => {
    downloadBackup(data)
    markBackedUp()
  }

  return (
    <div className="fj-backup-reminder" role="status">
      <div className="fj-backup-reminder__msg">
        <Download size={18} />
        <span>
          {neverBackedUp
            ? "FitJournal keeps everything on this device only. Download a backup so a lost or cleared device can't erase your journal."
            : "It's been a while since your last backup. Export one to keep your journal safe."}
        </span>
      </div>
      <div className="fj-backup-reminder__actions">
        <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
          Later
        </Button>
        <Button size="sm" onClick={exportNow}>
          Export backup
        </Button>
      </div>
    </div>
  )
}
