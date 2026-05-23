/**
 * Browser-side backup helper. Turns the full app data into a downloaded file
 * — JSON for a round-trippable backup (matches `importData`), or CSV for
 * spreadsheet analysis. Shared by Settings, the backup reminder, and the
 * save-error banner so the export logic lives once.
 */
import type { AppData } from '@/data/types'
import { exportData } from '@/data/storage'

const CSV_COLUMNS = [
  'date',
  'kind',
  'name',
  'muscle',
  'set',
  'reps',
  'weight',
  'cardio_minutes',
  'cardio_speed',
  'cardio_calories',
  'body_weight',
  'note',
] as const

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Download a full JSON backup of the given app data. */
export function downloadBackup(data: AppData): void {
  triggerDownload(
    new Blob([exportData(data)], { type: 'application/json' }),
    `fitjournal-backup-${todayStamp()}.json`,
  )
}

type CsvCell = string | number | null | undefined

const toRow = (cells: CsvCell[]): string => cells.map(csvEscape).join(',')

/**
 * Flatten the journal to a CSV: one row per logged set, cardio entry,
 * body-weight reading, and day note. Days are emitted in ascending order;
 * the day note is attached to the first row of the day, or as its own row
 * if the day has no other content.
 */
export function exportCsv(data: AppData): string {
  const rows: string[] = [CSV_COLUMNS.join(',')]
  for (const dk of Object.keys(data.workouts).sort()) {
    const w = data.workouts[dk]
    let pendingNote: string | undefined = w.note
    const takeNote = (): string | undefined => {
      const out = pendingNote
      pendingNote = undefined
      return out
    }
    if (w.bodyWeight != null) {
      rows.push(
        toRow([dk, 'bodyweight', '', '', '', '', '', '', '', '', w.bodyWeight, takeNote()]),
      )
    }
    for (const e of w.exercises) {
      e.sets.forEach((s, i) => {
        rows.push(
          toRow([dk, 'exercise', e.name, e.muscle, i + 1, s.reps, s.weight, '', '', '', '', takeNote()]),
        )
      })
    }
    for (const c of w.cardio) {
      rows.push(
        toRow([dk, 'cardio', c.type, '', '', '', '', c.time, c.speed, c.calories, '', takeNote()]),
      )
    }
    if (pendingNote) {
      rows.push(toRow([dk, 'note', '', '', '', '', '', '', '', '', '', pendingNote]))
    }
  }
  return rows.join('\n')
}

/** Download the CSV export. */
export function downloadCsv(data: AppData): void {
  triggerDownload(
    new Blob([exportCsv(data)], { type: 'text/csv;charset=utf-8' }),
    `fitjournal-${todayStamp()}.csv`,
  )
}
