/**
 * Browser-side backup helper. Turns the full app data into a downloaded JSON
 * file — the same format `importData` reads back. Shared by Settings, the
 * backup reminder, and the save-error banner so the export logic lives once.
 */
import type { AppData } from '@/data/types'
import { exportData } from '@/data/storage'

/** Download a full JSON backup of the given app data. */
export function downloadBackup(data: AppData): void {
  const blob = new Blob([exportData(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fitjournal-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
