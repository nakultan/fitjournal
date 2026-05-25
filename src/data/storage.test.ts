import { describe, it, expect } from 'vitest'
import { defaultData, exportData, importData } from '@/data/storage'
import { SCHEMA_VERSION } from '@/data/types'

describe('defaultData', () => {
  it('is a clean slate with seeded templates, starter recipes and default preferences', () => {
    const d = defaultData()
    expect(d.schemaVersion).toBe(SCHEMA_VERSION)
    expect(d.workouts).toEqual({})
    // P2.9 — three seeded starter recipes, all flagged with `seed: true` so
    // the empty-state copy can read "we seeded 3 starters".
    expect(d.recipes).toHaveLength(3)
    expect(d.recipes.every((r) => r.seed === true)).toBe(true)
    expect(d.health).toBeNull()
    expect(d.templates).toHaveLength(3)
    // P2.8 — PPL seed lands with red / blue / green swatches so Plan's
    // collapsed template strip has stable colours from the first run.
    expect(d.templates.map((t) => t.color)).toEqual(['red', 'blue', 'green'])
    expect(d.preferences.weeklyGoal).toBe(4)
    expect(d.preferences.dailyProteinGoal).toBe(140)
    expect(d.preferences.backupReminderWeeks).toBe(3)
    expect(d.loggedMeals).toEqual([])
  })
})

describe('exportData / importData round-trip', () => {
  it('exports JSON that imports back to identical data', () => {
    const original = defaultData()
    expect(importData(exportData(original))).toEqual(original)
  })
  it('exports human-readable, valid JSON', () => {
    const json = exportData(defaultData())
    expect(json).toContain('\n') // pretty-printed
    expect(() => JSON.parse(json)).not.toThrow()
  })
})

describe('importData validation', () => {
  it('rejects text that is not valid JSON', () => {
    expect(() => importData('not json {{')).toThrow(/valid JSON/)
  })
  it('rejects JSON that is not a FitJournal backup', () => {
    expect(() => importData('{"foo":1}')).toThrow(/FitJournal backup/)
  })
  it('rejects an Apple Health export picked by mistake', () => {
    expect(() => importData(JSON.stringify({ steps: 1000, distance_mi: 2 }))).toThrow()
  })
})

describe('importData normalisation', () => {
  it('fills missing fields from the defaults', () => {
    const partial = JSON.stringify({ workouts: {}, templates: [] })
    const d = importData(partial)
    expect(d.preferences.weeklyGoal).toBe(4)
    expect(d.preferences.dailyProteinGoal).toBe(140)
    // An imported backup that omits `recipes` is taken at its word — we
    // don't re-seed starter recipes into someone else's data.
    expect(d.recipes).toEqual([])
    expect(d.loggedMeals).toEqual([])
    expect(d.health).toBeNull()
  })
  it('forces the current schema version', () => {
    const stale = JSON.stringify({ workouts: {}, templates: [], schemaVersion: 99 })
    expect(importData(stale).schemaVersion).toBe(SCHEMA_VERSION)
  })
  it('preserves the workouts from the backup', () => {
    const backup = JSON.stringify({
      workouts: {
        '2026-05-20': { date: '2026-05-20', bodyWeight: 170, exercises: [], cardio: [] },
      },
      templates: [],
    })
    expect(importData(backup).workouts['2026-05-20'].bodyWeight).toBe(170)
  })
})

describe('schema migration v1 → v3', () => {
  it('expands flat exercises into per-set arrays', () => {
    const v1 = JSON.stringify({
      schemaVersion: 1,
      workouts: {
        '2026-05-20': {
          date: '2026-05-20',
          bodyWeight: null,
          exercises: [{ id: 'x1', name: 'Bench', muscle: 'chest', sets: 3, reps: 10, weight: 135 }],
          cardio: [],
        },
      },
      templates: [],
    })
    const d = importData(v1)
    expect(d.schemaVersion).toBe(SCHEMA_VERSION)
    const ex = d.workouts['2026-05-20'].exercises[0]
    expect(ex.sets).toEqual([
      { reps: 10, weight: 135 },
      { reps: 10, weight: 135 },
      { reps: 10, weight: 135 },
    ])
    expect(ex.name).toBe('Bench')
    expect(ex.muscle).toBe('chest')
  })
})

describe('schema migration v2 → v3 (P2)', () => {
  it('cycles default template colours when the field is missing', () => {
    const v2 = JSON.stringify({
      schemaVersion: 2,
      workouts: {},
      templates: [
        { id: 'a', name: 'Push', subtitle: '', exercises: [] },
        { id: 'b', name: 'Pull', subtitle: '', exercises: [] },
        { id: 'c', name: 'Legs', subtitle: '', exercises: [] },
      ],
    })
    const d = importData(v2)
    expect(d.schemaVersion).toBe(SCHEMA_VERSION)
    expect(d.templates.map((t) => t.color)).toEqual(['red', 'blue', 'green'])
  })
  it("doesn't overwrite a colour the user already chose", () => {
    const v2 = JSON.stringify({
      schemaVersion: 2,
      workouts: {},
      templates: [{ id: 'a', name: 'Push', subtitle: '', exercises: [], color: 'amber' }],
    })
    expect(importData(v2).templates[0].color).toBe('amber')
  })
  it('initialises loggedMeals to an empty array', () => {
    const v2 = JSON.stringify({ schemaVersion: 2, workouts: {}, templates: [] })
    expect(importData(v2).loggedMeals).toEqual([])
  })
})
