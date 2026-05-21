import { describe, it, expect } from 'vitest'
import { defaultData, exportData, importData } from '@/data/storage'
import { SCHEMA_VERSION } from '@/data/types'

describe('defaultData', () => {
  it('is a clean slate with seeded templates and default preferences', () => {
    const d = defaultData()
    expect(d.schemaVersion).toBe(SCHEMA_VERSION)
    expect(d.workouts).toEqual({})
    expect(d.recipes).toEqual([])
    expect(d.health).toBeNull()
    expect(d.templates).toHaveLength(3)
    expect(d.preferences.weeklyGoal).toBe(4)
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
    expect(d.recipes).toEqual([])
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
