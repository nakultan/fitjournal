import { describe, it, expect } from 'vitest'
import { parseHealthPayload } from '@/lib/healthBridge'

describe('parseHealthPayload', () => {
  it('keeps every finite numeric field', () => {
    const h = parseHealthPayload(
      {
        steps: 8200,
        distanceMi: 3.4,
        flightsClimbed: 12,
        activeEnergy: 540,
        exerciseMinutes: 35,
        restingHeartRate: 58,
        bodyMass: 168,
        sleepHours: 7.5,
      },
      null,
    )
    expect(h?.steps).toBe(8200)
    expect(h?.distanceMi).toBe(3.4)
    expect(h?.flightsClimbed).toBe(12)
    expect(h?.activeEnergy).toBe(540)
    expect(h?.exerciseMinutes).toBe(35)
    expect(h?.restingHeartRate).toBe(58)
    expect(h?.bodyMass).toBe(168)
    expect(h?.sleepHours).toBe(7.5)
    expect(h?.importedAt).not.toBeNull()
  })

  it('drops non-numeric and non-finite values', () => {
    const h = parseHealthPayload(
      { steps: 5000, distanceMi: 'lots', flightsClimbed: NaN, activeEnergy: Infinity },
      null,
    )
    expect(h?.steps).toBe(5000)
    expect(h?.distanceMi).toBeNull()
    expect(h?.flightsClimbed).toBeNull()
    expect(h?.activeEnergy).toBeUndefined()
  })

  it('accepts zero as a real value', () => {
    const h = parseHealthPayload({ steps: 0 }, null)
    expect(h?.steps).toBe(0)
  })

  it('returns null when nothing usable is present', () => {
    expect(parseHealthPayload({ steps: 'x', foo: 1 }, null)).toBeNull()
    expect(parseHealthPayload({}, null)).toBeNull()
    expect(parseHealthPayload(null, null)).toBeNull()
    expect(parseHealthPayload('not an object', null)).toBeNull()
  })

  it('records the source as the file name when imported from a file', () => {
    const h = parseHealthPayload({ steps: 100 }, 'health-export.json')
    expect(h?.fileName).toBe('health-export.json')
  })

  it('records a null source for a URL sync', () => {
    const h = parseHealthPayload({ steps: 100 }, null)
    expect(h?.fileName).toBeNull()
  })
})
