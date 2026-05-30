/**
 * Offline-first sync engine.
 *
 * IndexedDB stays the source of truth; this layer reconciles it with the
 * Supabase `records` table. The journal is decomposed into one record per
 * syncable unit (a workout day, a recipe, a logged meal, and a handful of
 * singletons), each carrying an `updatedAt` stamp in the local `SyncMeta`
 * sidecar. Reconciliation is **per-record last-write-wins** with tombstones —
 * the right granularity for one person who occasionally edits on two devices:
 * logging a workout on the phone never clobbers a recipe edited on the laptop.
 *
 * The pure functions (`decompose` / `recompose` / `stampChanges` /
 * `mergeRemote`) hold all the logic and are unit-tested; `synchronize` is the
 * thin network orchestration on top.
 */
import type { AppData, LoggedMeal, Preferences, Recipe, SyncMeta, Template, Workout } from './types'
import { defaultData } from './storage'
import { supabase } from '@/lib/supabase'

/** The unit of sync. Collections become many records; a few slow-changing
 *  pieces (preferences, goals, the weekly plan, health, last-backup time and
 *  the small, order-sensitive template list) are stored as singletons. */
export type RecordKind = 'workout' | 'recipe' | 'loggedMeal' | 'singleton'

// Singleton ids: preferences, goals, weeklyPlan, health, lastBackupAt, and
// templates. `templates` is a singleton (not per-row) so its user-defined
// order survives a round-trip; it's small and rarely edited on two devices at
// once, so the coarser merge granularity is an easy trade.

export interface FlatRecord {
  kind: RecordKind
  id: string
  data: unknown
}

/** A row as it lives in Supabase / travels over the wire. */
interface RemoteRow {
  kind: string
  id: string
  data: unknown
  updated_at: string
  deleted: boolean
}

/** A row queued to upsert. `user_id` is added at push time from the session. */
interface PushRow {
  kind: string
  id: string
  data: unknown
  updated_at: string
  deleted: boolean
}

const EPOCH = '1970-01-01T00:00:00.000Z'
const keyOf = (r: { kind: string; id: string }) => `${r.kind}:${r.id}`
const nowIso = () => new Date().toISOString()

/** Stable structural compare — good enough to detect a changed record, since
 *  React only produces a new object reference when something actually changed. */
function sameData(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// --- Decompose / recompose -------------------------------------------------

/** Flatten a journal into its syncable records. */
export function decompose(data: AppData): FlatRecord[] {
  const out: FlatRecord[] = []
  for (const [date, w] of Object.entries(data.workouts)) {
    out.push({ kind: 'workout', id: date, data: w })
  }
  for (const r of data.recipes) {
    out.push({ kind: 'recipe', id: r.id, data: r })
  }
  for (const m of data.loggedMeals ?? []) {
    out.push({ kind: 'loggedMeal', id: m.id, data: m })
  }
  out.push({ kind: 'singleton', id: 'preferences', data: data.preferences })
  out.push({ kind: 'singleton', id: 'goals', data: data.goals })
  out.push({ kind: 'singleton', id: 'weeklyPlan', data: data.weeklyPlan })
  out.push({ kind: 'singleton', id: 'health', data: data.health })
  out.push({ kind: 'singleton', id: 'lastBackupAt', data: data.lastBackupAt })
  out.push({ kind: 'singleton', id: 'templates', data: data.templates })
  // Never emit a null-valued record: the remote `data` column is NOT NULL, so
  // a null (e.g. `health`/`lastBackupAt` on a fresh account) would reject the
  // whole upsert batch. `recompose` rebuilds these from defaults when absent,
  // and a value later going null becomes a tombstone (pushed with data `{}`),
  // so omitting nulls here is lossless.
  return out.filter((r) => r.data !== null && r.data !== undefined)
}

/** Rebuild a journal from its surviving (non-deleted) records. Missing
 *  singletons fall back to defaults; recipes are ordered newest-first
 *  (createdAt desc, id asc) since they carry no manual order. */
export function recompose(records: FlatRecord[]): AppData {
  const base = defaultData()
  const data: AppData = {
    schemaVersion: base.schemaVersion,
    workouts: {},
    templates: [],
    weeklyPlan: base.weeklyPlan,
    recipes: [],
    goals: base.goals,
    preferences: base.preferences,
    health: base.health,
    lastBackupAt: base.lastBackupAt,
    loggedMeals: [],
  }
  const recipes: Recipe[] = []
  for (const r of records) {
    switch (r.kind) {
      case 'workout':
        data.workouts[r.id] = r.data as Workout
        break
      case 'recipe':
        recipes.push(r.data as Recipe)
        break
      case 'loggedMeal':
        ;(data.loggedMeals as LoggedMeal[]).push(r.data as LoggedMeal)
        break
      case 'singleton':
        if (r.id === 'preferences') {
          data.preferences = { ...base.preferences, ...(r.data as Preferences) }
        } else if (r.id === 'goals') {
          data.goals = r.data as Record<string, number>
        } else if (r.id === 'weeklyPlan') {
          data.weeklyPlan = r.data as AppData['weeklyPlan']
        } else if (r.id === 'health') {
          data.health = r.data as AppData['health']
        } else if (r.id === 'lastBackupAt') {
          data.lastBackupAt = (r.data as string | null) ?? null
        } else if (r.id === 'templates') {
          data.templates = r.data as Template[]
        }
        break
    }
  }
  recipes.sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? -1 : 1,
  )
  data.recipes = recipes
  return data
}

// --- Local change stamping -------------------------------------------------

/**
 * Diff the previous journal against the next one and stamp every record that
 * was added, changed, or removed with `now`. Called from the store's save path
 * so the 25 individual actions never need to know about sync.
 */
export function stampChanges(
  prev: AppData,
  next: AppData,
  meta: SyncMeta,
  now: string = nowIso(),
): SyncMeta {
  const prevFlat = new Map(decompose(prev).map((r) => [keyOf(r), r]))
  const nextFlat = new Map(decompose(next).map((r) => [keyOf(r), r]))
  const records: SyncMeta['records'] = { ...meta.records }

  for (const [key, rec] of nextFlat) {
    const before = prevFlat.get(key)
    if (!before || !sameData(before.data, rec.data)) {
      records[key] = { updatedAt: now }
    }
  }
  for (const key of prevFlat.keys()) {
    if (!nextFlat.has(key)) {
      records[key] = { updatedAt: now, deleted: true }
    }
  }
  return { records, lastPulledAt: meta.lastPulledAt }
}

// --- Merge -----------------------------------------------------------------

export interface MergeResult {
  data: AppData
  meta: SyncMeta
  toPush: PushRow[]
}

interface CellState {
  record: FlatRecord | null
  updatedAt: string
  deleted: boolean
  source: 'local' | 'remote'
}

/**
 * Reconcile local state (journal + sidecar) with rows pulled from the server.
 * Pure: returns the merged journal, the updated sidecar, and the rows that
 * must be pushed back (local winners the server hasn't seen, incl. tombstones).
 */
export function mergeRemote(
  localData: AppData,
  meta: SyncMeta,
  remoteRows: RemoteRow[],
  now: string = nowIso(),
): MergeResult {
  const localFlat = new Map(decompose(localData).map((r) => [keyOf(r), r]))
  const state = new Map<string, CellState>()

  // Seed from local present records.
  for (const [key, rec] of localFlat) {
    state.set(key, {
      record: rec,
      updatedAt: meta.records[key]?.updatedAt ?? '',
      deleted: false,
      source: 'local',
    })
  }
  // Local tombstones — recorded as deleted in the sidecar, gone from the journal.
  for (const [key, m] of Object.entries(meta.records)) {
    if (m.deleted && !localFlat.has(key)) {
      state.set(key, { record: null, updatedAt: m.updatedAt, deleted: true, source: 'local' })
    }
  }
  // Fold in remote rows — newer timestamp wins (tombstone included).
  for (const row of remoteRows) {
    const key = `${row.kind}:${row.id}`
    const cur = state.get(key)
    if (!cur || row.updated_at > cur.updatedAt) {
      state.set(key, {
        record: row.deleted ? null : { kind: row.kind as RecordKind, id: row.id, data: row.data },
        updatedAt: row.updated_at,
        deleted: row.deleted,
        source: 'remote',
      })
    }
  }

  // Surviving records rebuild the journal; the sidecar mirrors every cell.
  const survivors: FlatRecord[] = []
  const records: SyncMeta['records'] = {}
  for (const [key, s] of state) {
    records[key] = s.deleted ? { updatedAt: s.updatedAt, deleted: true } : { updatedAt: s.updatedAt }
    if (!s.deleted && s.record) survivors.push(s.record)
  }

  // Push local winners the server may not have: anything changed since the last
  // pull (lastPulledAt === null ⇒ first sync ⇒ push everything local).
  const toPush: PushRow[] = []
  for (const [key, s] of state) {
    if (s.source !== 'local') continue
    const newSincePull =
      meta.lastPulledAt === null || s.updatedAt === '' || s.updatedAt > meta.lastPulledAt
    if (!newSincePull) continue
    const ts = s.updatedAt || now
    records[key] = s.deleted ? { updatedAt: ts, deleted: true } : { updatedAt: ts }
    const sep = key.indexOf(':')
    toPush.push({
      kind: key.slice(0, sep),
      id: key.slice(sep + 1),
      data: s.deleted ? {} : s.record!.data,
      updated_at: ts,
      deleted: s.deleted,
    })
  }

  const data = recompose(survivors)
  const lastPulledAt = highWater(meta.lastPulledAt, remoteRows, toPush)
  return { data, meta: { records, lastPulledAt }, toPush }
}

/** Newest ISO timestamp across the old mark, pulled rows and pushed rows, so
 *  the next pull skips everything this sync already accounted for. */
function highWater(prev: string | null, remote: RemoteRow[], pushed: PushRow[]): string {
  let max = prev ?? EPOCH
  for (const r of remote) if (r.updated_at > max) max = r.updated_at
  for (const p of pushed) if (p.updated_at > max) max = p.updated_at
  return max
}

// --- Network orchestration -------------------------------------------------

/** Fetch every row changed since the high-water mark. */
async function pullSince(since: string | null): Promise<RemoteRow[]> {
  const { data, error } = await supabase!
    .from('records')
    .select('kind,id,data,updated_at,deleted')
    .gt('updated_at', since ?? EPOCH)
    .order('updated_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as RemoteRow[]
}

/** Upsert local winners, stamping each with the owning user id (for RLS). */
async function pushRows(userId: string, rows: PushRow[]): Promise<void> {
  const payload = rows.map((r) => ({ ...r, user_id: userId }))
  const { error } = await supabase!.from('records').upsert(payload, { onConflict: 'user_id,kind,id' })
  if (error) throw error
}

/**
 * Run one full sync cycle: pull deltas, merge, push local winners. Returns the
 * merged journal + sidecar for the caller to apply, or null when sync isn't
 * possible (not configured, or signed out) — in which case the app just stays
 * local. Throws on a genuine network/database error so the caller can surface it.
 */
export async function synchronize(
  localData: AppData,
  meta: SyncMeta,
): Promise<{ data: AppData; meta: SyncMeta } | null> {
  if (!supabase) return null
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return null

  const remoteRows = await pullSince(meta.lastPulledAt)
  const merged = mergeRemote(localData, meta, remoteRows)
  if (merged.toPush.length > 0) {
    await pushRows(user.id, merged.toPush)
  }
  return { data: merged.data, meta: merged.meta }
}
