import { describe, it, expect } from 'vitest'
import type { AppData, CardioEntry, DayName, ExerciseEntry, Workout } from '@/data/types'
import { parseKey } from '@/lib/dates'
import {
  WORKOUT_MILESTONES,
  computeBestDay,
  computeCardioPRs,
  computeHeatmap,
  computeInsights,
  computeMuscleBalance,
  computePRTimeline,
  computePlateaus,
  computeSessionSummary,
  computeStreak,
  computeStrengthPRs,
  computeTotalStats,
  computeWeekProgress,
  computeWeeklyStats,
  exerciseKey,
  isLoggedWorkout,
  totalWorkoutsLogged,
  wouldBeCardioPR,
  wouldBeStrengthPR,
} from '@/data/logic'

/* ------------------------------------------------------------- helpers ---- */

let idSeq = 0
const nextId = () => `id-${++idSeq}`

function exAt(name: string, weight: number, extra: Partial<ExerciseEntry> = {}): ExerciseEntry {
  return { id: nextId(), name, muscle: 'chest', sets: 3, reps: 10, weight, ...extra }
}

function cardioAt(extra: Partial<CardioEntry> = {}): CardioEntry {
  return { id: nextId(), type: 'treadmill', time: 30, speed: 6, calories: 300, ...extra }
}

function mkDay(exercises: ExerciseEntry[] = [], cardio: CardioEntry[] = []): Workout {
  return { date: 'd', bodyWeight: null, exercises, cardio }
}

/** Build a `Record<dateKey, Workout>` from a compact spec. */
function workouts(
  spec: Record<string, { ex?: ExerciseEntry[]; cardio?: CardioEntry[] }>,
): Record<string, Workout> {
  const out: Record<string, Workout> = {}
  for (const [dk, v] of Object.entries(spec)) {
    out[dk] = { date: dk, bodyWeight: null, exercises: v.ex ?? [], cardio: v.cardio ?? [] }
  }
  return out
}

/** A weekly plan with training assigned to the given weekdays (rest otherwise). */
function mkPlan(...days: DayName[]): AppData['weeklyPlan'] {
  const plan: AppData['weeklyPlan'] = {}
  for (const d of days) {
    plan[d] = {
      templateId: 't',
      templateName: 'T',
      exercises: [{ name: 'A', muscle: 'chest', sets: 3, reps: 10 }],
    }
  }
  return plan
}

function appData(w: Record<string, Workout>): AppData {
  return {
    schemaVersion: 1,
    workouts: w,
    templates: [],
    weeklyPlan: {},
    recipes: [],
    goals: {},
    preferences: {
      weightUnit: 'lbs',
      distanceUnit: 'miles',
      goalWeight: 170,
      weeklyGoal: 4,
      dailyReminder: true,
      weeklySummary: true,
    },
    health: null,
  }
}

/* 2026-05-20 is a Wednesday — used as "today" throughout. */
const REF = parseKey('2026-05-20')

/* ------------------------------------------------------------- basics ----- */

describe('exerciseKey', () => {
  it('trims and lowercases so names match case-insensitively', () => {
    expect(exerciseKey('  Bench Press ')).toBe('bench press')
  })
})

describe('isLoggedWorkout', () => {
  it('is false for undefined or an empty day', () => {
    expect(isLoggedWorkout(undefined)).toBe(false)
    expect(isLoggedWorkout(mkDay())).toBe(false)
  })
  it('is true once there is an exercise or a cardio entry', () => {
    expect(isLoggedWorkout(mkDay([exAt('A', 50)]))).toBe(true)
    expect(isLoggedWorkout(mkDay([], [cardioAt()]))).toBe(true)
  })
})

/* ---------------------------------------------------------------- PRs ----- */

describe('computeStrengthPRs', () => {
  it('keeps the heaviest lift per exercise, case-insensitively', () => {
    const w = workouts({
      '2026-05-01': { ex: [exAt('Bench Press', 100)] },
      '2026-05-08': { ex: [exAt('bench press', 110)] },
      '2026-05-15': { ex: [exAt('Bench Press', 105)] },
    })
    const prs = computeStrengthPRs(w)
    expect(prs['bench press'].weight).toBe(110)
    expect(prs['bench press'].date).toBe('2026-05-08')
  })
  it('ignores entries with no weight', () => {
    expect(computeStrengthPRs(workouts({ '2026-05-01': { ex: [exAt('Squat', 0)] } }))).toEqual({})
  })
})

describe('computeCardioPRs', () => {
  it('keeps the most calories per cardio type', () => {
    const w = workouts({
      '2026-05-01': { cardio: [cardioAt({ calories: 200 })] },
      '2026-05-02': { cardio: [cardioAt({ calories: 350 })] },
    })
    expect(computeCardioPRs(w).treadmill).toEqual({ mostCalories: 350, date: '2026-05-02' })
  })
})

describe('computePRTimeline', () => {
  it('lists every record-breaking moment, newest first', () => {
    const w = workouts({
      '2026-05-01': { ex: [exAt('Bench', 100)] },
      '2026-05-08': { ex: [exAt('Bench', 110)] },
    })
    const tl = computePRTimeline(w)
    expect(tl.map((e) => e.date)).toEqual(['2026-05-08', '2026-05-01'])
    expect(tl[0].value).toBe('110 lbs')
  })
})

describe('wouldBeStrengthPR / wouldBeCardioPR', () => {
  it('detects a strength PR only when strictly heavier', () => {
    const w = workouts({ '2026-05-01': { ex: [exAt('Bench', 100)] } })
    expect(wouldBeStrengthPR(w, 'Bench', 110)).toBe(true)
    expect(wouldBeStrengthPR(w, 'Bench', 100)).toBe(false)
    expect(wouldBeStrengthPR(w, 'New Lift', 5)).toBe(true)
    expect(wouldBeStrengthPR(w, 'Bench', 0)).toBe(false)
  })
  it('detects a cardio PR on calories', () => {
    const w = workouts({ '2026-05-01': { cardio: [cardioAt({ calories: 300 })] } })
    expect(wouldBeCardioPR(w, 'treadmill', 400)).toBe(true)
    expect(wouldBeCardioPR(w, 'treadmill', 300)).toBe(false)
  })
})

/* ------------------------------------------------------------- streaks ---- */

describe('computeStreak', () => {
  it('is zero for no workouts', () => {
    expect(computeStreak({}, {}, REF)).toEqual({ current: 0, longest: 0 })
  })

  it('counts consecutive logged days', () => {
    const w = workouts({
      '2026-05-18': { ex: [exAt('A', 50)] },
      '2026-05-19': { ex: [exAt('A', 50)] },
      '2026-05-20': { ex: [exAt('A', 50)] },
    })
    expect(computeStreak(w, {}, REF)).toEqual({ current: 3, longest: 3 })
  })

  it('gives today grace — an unlogged today does not break the streak', () => {
    const w = workouts({
      '2026-05-18': { ex: [exAt('A', 50)] },
      '2026-05-19': { ex: [exAt('A', 50)] },
    })
    expect(computeStreak(w, {}, REF).current).toBe(2)
  })

  it('breaks on a missed day when there is no plan', () => {
    const w = workouts({
      '2026-05-16': { ex: [exAt('A', 50)] },
      '2026-05-17': { ex: [exAt('A', 50)] },
      '2026-05-19': { ex: [exAt('A', 50)] },
      '2026-05-20': { ex: [exAt('A', 50)] },
    })
    expect(computeStreak(w, {}, REF)).toEqual({ current: 2, longest: 2 })
  })

  it('bridges a planned rest day — resting on schedule keeps the streak', () => {
    // Plan trains Mon/Wed/Fri. Logged Mon 05-18 and Wed 05-20; Tue 05-19 is rest.
    const w = workouts({
      '2026-05-18': { ex: [exAt('A', 50)] },
      '2026-05-20': { ex: [exAt('A', 50)] },
    })
    const plan = mkPlan('Monday', 'Wednesday', 'Friday')
    expect(computeStreak(w, plan, REF).current).toBe(2)
    // Without a plan the same gap (Tue) breaks it.
    expect(computeStreak(w, {}, REF).current).toBe(1)
  })

  it('still breaks when a planned training day is missed', () => {
    // Plan trains Mon/Wed/Fri; only Wed 05-20 logged — Mon 05-18 was missed.
    const w = workouts({ '2026-05-20': { ex: [exAt('A', 50)] } })
    expect(computeStreak(w, mkPlan('Monday', 'Wednesday', 'Friday'), REF).current).toBe(1)
  })

  it('tracks the longest streak across rest days', () => {
    const w = workouts({
      '2026-05-11': { ex: [exAt('A', 50)] },
      '2026-05-13': { ex: [exAt('A', 50)] },
      '2026-05-15': { ex: [exAt('A', 50)] },
      '2026-05-18': { ex: [exAt('A', 50)] },
      '2026-05-20': { ex: [exAt('A', 50)] },
    })
    expect(computeStreak(w, mkPlan('Monday', 'Wednesday', 'Friday'), REF)).toEqual({
      current: 5,
      longest: 5,
    })
  })
})

/* --------------------------------------------------------------- stats ---- */

describe('computeWeeklyStats', () => {
  it('buckets sets and workouts into Sunday-aligned weeks', () => {
    const w = workouts({
      '2026-05-12': { ex: [exAt('A', 50, { sets: 4 })] },
      '2026-05-19': { ex: [exAt('A', 50, { sets: 5 })] },
    })
    const stats = computeWeeklyStats(w, REF, 2)
    expect(stats).toHaveLength(2)
    expect(stats[0]).toMatchObject({ label: 'W1', totalSets: 4, workoutCount: 1 })
    expect(stats[1]).toMatchObject({ label: 'W2', totalSets: 5, workoutCount: 1 })
  })
})

describe('computeTotalStats', () => {
  it('totals only the last 30 days', () => {
    const w = workouts({
      '2026-05-20': { ex: [exAt('A', 50, { sets: 3 })] },
      '2026-05-10': { ex: [exAt('A', 50, { sets: 2 })] },
      '2026-04-01': { ex: [exAt('A', 50, { sets: 9 })] },
    })
    const t = computeTotalStats(w, REF)
    expect(t.totalWorkouts).toBe(2)
    expect(t.totalSets).toBe(5)
  })
})

describe('computeMuscleBalance', () => {
  it('sums sets per muscle group inside the window', () => {
    const w = workouts({
      '2026-05-20': {
        ex: [
          exAt('Bench', 50, { muscle: 'chest', sets: 4 }),
          exAt('Row', 50, { muscle: 'back', sets: 3 }),
        ],
      },
    })
    expect(computeMuscleBalance(w, REF)).toEqual({ chest: 4, back: 3 })
  })
})

describe('computePlateaus', () => {
  const benchOn = (dates: string[], weights: number[]) =>
    workouts(
      Object.fromEntries(dates.map((d, i) => [d, { ex: [exAt('Bench', weights[i])] }])),
    )

  it('flags an exercise stuck across its last four sessions', () => {
    const w = benchOn(
      ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04'],
      [100, 100, 100, 100],
    )
    const p = computePlateaus(w)
    expect(p).toHaveLength(1)
    expect(p[0]).toMatchObject({ exercise: 'Bench', weight: 100 })
  })
  it('does not flag an exercise that is still improving', () => {
    const w = benchOn(
      ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04'],
      [100, 100, 100, 110],
    )
    expect(computePlateaus(w)).toEqual([])
  })
  it('needs at least four sessions before judging', () => {
    const w = benchOn(['2026-05-01', '2026-05-02'], [100, 100])
    expect(computePlateaus(w)).toEqual([])
  })
})

/* ------------------------------------------------------------- heatmap ---- */

describe('computeHeatmap', () => {
  it('produces a 13×7 grid', () => {
    expect(computeHeatmap({}, REF)).toHaveLength(91)
  })
  it('is all level 0 with no workouts', () => {
    expect(computeHeatmap({}, REF).every((c) => c.level === 0)).toBe(true)
  })
  it('maps entry count to an intensity level', () => {
    const w = workouts({ '2026-05-04': { ex: [exAt('A', 50), exAt('B', 50)] } })
    const cell = computeHeatmap(w, REF).find((c) => c.dateKey === '2026-05-04')
    expect(cell).toMatchObject({ count: 2, level: 2 })
  })
  it("includes today and flags later days in the week as 'future'", () => {
    const w = workouts({ '2026-05-20': { ex: [exAt('A', 50)] } })
    const cells = computeHeatmap(w, REF)
    expect(cells.find((c) => c.dateKey === '2026-05-20')).toMatchObject({
      count: 1,
      future: false,
    })
    expect(cells.find((c) => c.dateKey === '2026-05-21')?.future).toBe(true)
  })
})

/* --------------------------------------------------- habit & sessions ----- */

describe('totalWorkoutsLogged', () => {
  it('counts only days with logged content', () => {
    const w = workouts({
      '2026-05-20': { ex: [exAt('A', 50)] },
      '2026-05-19': {},
      '2026-05-18': { cardio: [cardioAt()] },
    })
    expect(totalWorkoutsLogged(w)).toBe(2)
  })
})

describe('computeBestDay', () => {
  it('finds the most frequently trained weekday', () => {
    const w = workouts({
      '2026-05-11': { ex: [exAt('A', 50)] }, // Monday
      '2026-05-18': { ex: [exAt('A', 50)] }, // Monday
      '2026-05-20': { ex: [exAt('A', 50)] }, // Wednesday
    })
    expect(computeBestDay(w)).toEqual({ day: 'Monday', count: 2 })
  })
  it('is null with no data', () => {
    expect(computeBestDay({})).toBeNull()
  })
})

describe('computeWeekProgress', () => {
  it('measures the current week against the goal', () => {
    const w = workouts({
      '2026-05-18': { ex: [exAt('A', 50, { sets: 4 })] },
      '2026-05-19': { ex: [exAt('A', 50, { sets: 3 })] },
    })
    expect(computeWeekProgress(w, REF, 4)).toEqual({
      done: 2,
      goal: 4,
      pct: 50,
      remaining: 2,
      totalSets: 7,
    })
  })
  it('caps the percentage at 100 and never goes negative', () => {
    const w = workouts({
      '2026-05-18': { ex: [exAt('A', 50)] },
      '2026-05-19': { ex: [exAt('A', 50)] },
      '2026-05-20': { ex: [exAt('A', 50)] },
    })
    const wp = computeWeekProgress(w, REF, 2)
    expect(wp.pct).toBe(100)
    expect(wp.remaining).toBe(0)
  })
})

describe('computeSessionSummary', () => {
  it('rolls up one day — sets, volume, cardio and PRs', () => {
    const w = workouts({
      '2026-05-20': {
        ex: [
          exAt('Bench', 100, { sets: 3, reps: 10 }),
          exAt('Squat', 200, { sets: 5, reps: 5 }),
        ],
        cardio: [cardioAt({ time: 20, calories: 0 }), cardioAt({ time: 15, calories: 0 })],
      },
    })
    const s = computeSessionSummary(w, '2026-05-20')
    expect(s.hasContent).toBe(true)
    expect(s.exerciseCount).toBe(2)
    expect(s.totalSets).toBe(8)
    expect(s.totalVolume).toBe(3 * 10 * 100 + 5 * 5 * 200)
    expect(s.cardioCount).toBe(2)
    expect(s.cardioMinutes).toBe(35)
    expect(s.prs).toHaveLength(2)
  })
  it('handles a day with nothing logged', () => {
    const s = computeSessionSummary({}, '2026-05-20')
    expect(s.hasContent).toBe(false)
    expect(s.totalVolume).toBe(0)
  })
})

/* ------------------------------------------------------------ insights ---- */

describe('WORKOUT_MILESTONES', () => {
  it('includes the headline milestones', () => {
    expect(WORKOUT_MILESTONES).toEqual(expect.arrayContaining([10, 50, 100]))
  })
})

describe('computeInsights', () => {
  it('surfaces an active streak', () => {
    const w = workouts({
      '2026-05-18': { ex: [exAt('A', 50)] },
      '2026-05-19': { ex: [exAt('A', 50)] },
      '2026-05-20': { ex: [exAt('A', 50)] },
    })
    const insights = computeInsights(appData(w), REF)
    expect(insights.some((i) => i.id === 'streak')).toBe(true)
  })

  it('celebrates a workout-count milestone', () => {
    const spec: Record<string, { ex: ExerciseEntry[] }> = {}
    for (let d = 1; d <= 10; d++) {
      spec[`2026-05-${String(d).padStart(2, '0')}`] = { ex: [exAt('A', 50)] }
    }
    const insights = computeInsights(appData(workouts(spec)), parseKey('2026-05-10'))
    expect(insights.some((i) => i.id === 'milestone')).toBe(true)
  })
})
