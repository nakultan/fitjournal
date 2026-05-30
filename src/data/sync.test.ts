import { describe, it, expect } from 'vitest'
import { decompose, recompose, stampChanges, mergeRemote } from './sync'
import { defaultData, emptySyncMeta } from './storage'
import type { AppData, Recipe, SyncMeta, Workout } from './types'

function workout(date: string, bodyWeight: number | null = null): Workout {
  return { date, bodyWeight, exercises: [], cardio: [] }
}

/** A journal with strictly decreasing recipe createdAt, so recompose's
 *  newest-first ordering round-trips cleanly. */
function sampleData(): AppData {
  const d = defaultData()
  d.recipes = d.recipes.map((r, i) => ({ ...r, createdAt: `2026-05-2${5 - i}` }))
  d.workouts = { '2026-05-29': workout('2026-05-29', 180) }
  d.loggedMeals = [{ id: 'meal-1', recipeId: d.recipes[0].id, date: '2026-05-29', servings: 1 }]
  d.goals = { 'bench press': 225 }
  return d
}

/** Stamp every current record at one timestamp — a convenient "already synced
 *  at T" sidecar for merge tests. */
function metaAt(data: AppData, updatedAt: string, lastPulledAt: string | null): SyncMeta {
  const records: SyncMeta['records'] = {}
  for (const r of decompose(data)) records[`${r.kind}:${r.id}`] = { updatedAt }
  return { records, lastPulledAt }
}

describe('decompose / recompose', () => {
  it('round-trips a journal back to itself', () => {
    const d = sampleData()
    expect(recompose(decompose(d))).toEqual(d)
  })

  it('emits one record per workout, recipe, meal plus the singletons', () => {
    const d = sampleData()
    const flat = decompose(d)
    expect(flat.filter((r) => r.kind === 'workout')).toHaveLength(1)
    expect(flat.filter((r) => r.kind === 'recipe')).toHaveLength(3)
    expect(flat.filter((r) => r.kind === 'loggedMeal')).toHaveLength(1)
    // preferences, goals, weeklyPlan, health, lastBackupAt, templates
    expect(flat.filter((r) => r.kind === 'singleton')).toHaveLength(6)
  })

  it('keeps the user-defined template order (templates are one singleton)', () => {
    const d = sampleData()
    const names = d.templates.map((t) => t.name)
    expect(recompose(decompose(d)).templates.map((t) => t.name)).toEqual(names)
  })
})

describe('stampChanges', () => {
  const NOW = '2026-05-29T10:00:00.000Z'

  it('stamps an added record', () => {
    const prev = defaultData()
    const next = { ...prev, workouts: { '2026-05-29': workout('2026-05-29') } }
    const meta = stampChanges(prev, next, emptySyncMeta(), NOW)
    expect(meta.records['workout:2026-05-29']).toEqual({ updatedAt: NOW })
  })

  it('stamps a changed singleton', () => {
    const prev = defaultData()
    const next = { ...prev, preferences: { ...prev.preferences, weeklyGoal: 6 } }
    const meta = stampChanges(prev, next, emptySyncMeta(), NOW)
    expect(meta.records['singleton:preferences']).toEqual({ updatedAt: NOW })
  })

  it('tombstones a removed record', () => {
    const prev = { ...defaultData(), workouts: { '2026-05-29': workout('2026-05-29') } }
    const next = { ...prev, workouts: {} }
    const meta = stampChanges(prev, next, emptySyncMeta(), NOW)
    expect(meta.records['workout:2026-05-29']).toEqual({ updatedAt: NOW, deleted: true })
  })

  it('leaves untouched records alone', () => {
    const d = defaultData()
    const meta = stampChanges(d, d, emptySyncMeta(), NOW)
    expect(meta.records).toEqual({})
  })
})

describe('mergeRemote', () => {
  const NOW = '2026-05-29T12:00:00.000Z'

  it('first sync: pushes every local record, data unchanged', () => {
    const local = sampleData()
    const res = mergeRemote(local, emptySyncMeta(), [], NOW)
    expect(res.data).toEqual(local)
    expect(res.toPush).toHaveLength(decompose(local).length)
    expect(res.toPush.every((r) => r.updated_at === NOW)).toBe(true)
  })

  it('pulls in a remote-only record without pushing anything', () => {
    const local = defaultData()
    const meta = metaAt(local, '2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z')
    const remoteAt = '2026-05-28T00:00:00.000Z'
    const res = mergeRemote(
      local,
      meta,
      [{ kind: 'workout', id: '2026-05-28', data: workout('2026-05-28', 175), updated_at: remoteAt, deleted: false }],
      NOW,
    )
    expect(res.data.workouts['2026-05-28']).toEqual(workout('2026-05-28', 175))
    expect(res.toPush).toHaveLength(0)
    expect(res.meta.lastPulledAt).toBe(remoteAt)
  })

  it('resolves a conflict to the newer side (remote wins here)', () => {
    const local = { ...defaultData(), workouts: { d: workout('d', 100) } }
    const meta = metaAt(local, '2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z')
    const res = mergeRemote(
      local,
      meta,
      [{ kind: 'workout', id: 'd', data: workout('d', 200), updated_at: '2026-05-28T00:00:00.000Z', deleted: false }],
      NOW,
    )
    expect(res.data.workouts['d'].bodyWeight).toBe(200)
    expect(res.toPush).toHaveLength(0)
  })

  it('keeps the local side when it is newer, and pushes it', () => {
    const local = { ...defaultData(), workouts: { d: workout('d', 100) } }
    const meta = metaAt(local, '2026-05-29T00:00:00.000Z', '2021-01-01T00:00:00.000Z')
    const res = mergeRemote(
      local,
      meta,
      [{ kind: 'workout', id: 'd', data: workout('d', 200), updated_at: '2022-01-01T00:00:00.000Z', deleted: false }],
      NOW,
    )
    expect(res.data.workouts['d'].bodyWeight).toBe(100)
    expect(res.toPush.find((r) => r.id === 'd')?.data).toMatchObject({ bodyWeight: 100 })
  })

  it('applies a remote tombstone as a delete', () => {
    const local = { ...defaultData(), workouts: { d: workout('d', 100) } }
    const meta = metaAt(local, '2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z')
    const res = mergeRemote(
      local,
      meta,
      [{ kind: 'workout', id: 'd', data: {}, updated_at: '2026-05-28T00:00:00.000Z', deleted: true }],
      NOW,
    )
    expect(res.data.workouts['d']).toBeUndefined()
    expect(res.meta.records['workout:d']).toEqual({ updatedAt: '2026-05-28T00:00:00.000Z', deleted: true })
  })

  it('pushes a local tombstone the server has not seen', () => {
    const local = defaultData()
    const meta: SyncMeta = {
      records: { 'recipe:gone': { updatedAt: '2026-05-29T00:00:00.000Z', deleted: true } },
      lastPulledAt: '2021-01-01T00:00:00.000Z',
    }
    // baseline so the rest of local isn't flagged for push
    for (const r of decompose(local)) {
      meta.records[`${r.kind}:${r.id}`] = { updatedAt: '2020-01-01T00:00:00.000Z' }
    }
    const res = mergeRemote(local, meta, [], NOW)
    const tomb = res.toPush.find((r) => r.kind === 'recipe' && r.id === 'gone')
    expect(tomb).toMatchObject({ deleted: true })
  })
})

describe('recompose recipe ordering', () => {
  it('orders recipes newest-first by createdAt', () => {
    const a = { ...(defaultData().recipes[0]), id: 'a', createdAt: '2026-01-01' } as Recipe
    const b = { ...(defaultData().recipes[0]), id: 'b', createdAt: '2026-03-01' } as Recipe
    const data = recompose([
      { kind: 'recipe', id: 'a', data: a },
      { kind: 'recipe', id: 'b', data: b },
    ])
    expect(data.recipes.map((r) => r.id)).toEqual(['b', 'a'])
  })
})
