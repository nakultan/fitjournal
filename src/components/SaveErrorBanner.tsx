import { AlertTriangle } from 'lucide-react'
import { useStore } from '@/data/store-context'
import { downloadBackup } from '@/lib/backup'
import { Button } from './Button'

/**
 * A persistent, non-dismissible banner shown when a write to device storage
 * fails (quota exceeded, storage disabled or blocked). The in-memory changes
 * are not yet on disk, so it urges an immediate export before they are lost.
 */
export function SaveErrorBanner() {
  const { data, saveFailed } = useStore()
  if (!saveFailed) return null

  return (
    <div className="fj-save-error" role="alert">
      <AlertTriangle size={18} className="fj-save-error__icon" />
      <span className="fj-save-error__msg">
        <strong>FitJournal couldn&apos;t save to this device.</strong> Recent changes
        aren&apos;t stored yet — export a backup now so they aren&apos;t lost.
      </span>
      <Button size="sm" variant="secondary" onClick={() => downloadBackup(data)}>
        Export backup
      </Button>
    </div>
  )
}
