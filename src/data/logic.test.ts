import { describe, it, expect } from 'vitest'
import type { AppData, CardioEntry, DayName, ExerciseEntry, MuscleGroup, Workout } from '@/data/types'
import { parseKey } from '@/lib/dates'
import {
  WORKOUT_MILESTONES,
  topSetExcluding,
  computeBestDay,
  computeCardioPRs,
  computeExerciseHistory,
  computeGoalTrajectory,
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
  computeWeightSeries,
  estimate1RM,
  exerciseKey,
  findLastTime,
  formatSets,
  isLoggedWorkout,
  postWorkoutRecipe,
  proteinForDay,
  recommendNextSession,
  totalWorkoutsLogged,
  wouldBeCardioPR,
  wouldBeStrengthPR,
} from '@/data/logic'
import { isoWeek } from '@/lib/dates'
import type { LoggedMeal, Recipe } from '@/data/types'

/* ------------------------------------------------------------- helpers ---- */

let idSeq = 0
const nextId = () => `id-${++idSeq}`

function exAt(
  name: string,
  weight: number,
  extra: { muscle?: MuscleGroup; sets?: number; reps?: number } = {},
): ExerciseEntry {
  const count = extra.sets ?? 3
  const reps = extra.reps ?? 10
  return {
    id: nextId(),
    name,
    muscle: extra.muscle ?? 'chest',
    sets: Array.from({ length: count }, () => ({ reps, weight })),
  }
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
      theme: 'system',
    },
    health: null,
    lastBackupAt: null,
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
  it('keeps the best distance per cardio type', () => {
    const w = workouts({
      // distance = (time / 60) * speed → 2 and 4
      '2026-05-01': { cardio: [cardioAt({ time: 20, speed: 6 })] },
      '2026-05-02': { cardio: [cardioAt({ time: 30, speed: 8 })] },
    })
    expect(computeCardioPRs(w).treadmill).toEqual({ bestDistance: 4, date: '2026-05-02' })
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
  it('detects a cardio PR on distance', () => {
    // cardioAt default — time 30, speed 6 → distance 3
    const w = workouts({ '2026-05-01': { cardio: [cardioAt()] } })
    expect(wouldBeCardioPR(w, 'treadmill', 4)).toBe(true)
    expect(wouldBeCardioPR(w, 'treadmill', 3)).toBe(false)
  })
})

/* ------------------------------------------- set summary & last-time ----- */

describe('formatSets', () => {
  it('joins each set as weight×reps with the unit appended', () => {
    expect(
      formatSets(
        [
          { reps: 5, weight: 185 },
          { reps: 5, weight: 205 },
          { reps: 3, weight: 215 },
        ],
        'lbs',
      ),
    ).toBe('185×5, 205×5, 215×3 lbs')
  })
  it('is a friendly placeholder for no sets', () => {
    expect(formatSets([], 'lbs')).toBe('No sets')
  })
})

describe('findLastTime', () => {
  it('returns the most recent prior session of an exercise (case-insensitive)', () => {
    const w = workouts({
      '2026-05-10': { ex: [exAt('Bench Press', 100)] },
      '2026-05-12': { ex: [exAt('bench press', 110)] },
      '2026-05-20': { ex: [exAt('Bench Press', 120)] },
    })
    const hit = findLastTime(w, 'Bench Press', '2026-05-20')
    expect(hit?.date).toBe('2026-05-12')
    expect(hit?.entry.sets[0].weight).toBe(110)
  })
  it('ignores entries on or after the cutoff day', () => {
    const w = workouts({ '2026-05-20': { ex: [exAt('Bench', 100)] } })
    expect(findLastTime(w, 'Bench', '2026-05-20')).toBeNull()
  })
  it('returns null for a name that has never been logged', () => {
    expect(findLastTime({}, 'Squat', '2026-05-20')).toBeNull()
  })
})

/* ------------------------------------------- estimated 1RM & history ----- */

describe('estimate1RM', () => {
  it('returns the weight unchanged for a single rep', () => {
    expect(estimate1RM(225, 1)).toBe(225)
  })
  it('applies the Epley formula for higher reps', () => {
    expect(estimate1RM(225, 5)).toBeCloseTo(225 * (1 + 5 / 30), 6)
  })
  it('is zero for non-positive inputs', () => {
    expect(estimate1RM(0, 5)).toBe(0)
    expect(estimate1RM(225, 0)).toBe(0)
    expect(estimate1RM(-1, 5)).toBe(0)
  })
})

describe('computeExerciseHistory', () => {
  it('aggregates every prior session, oldest first, with top-set and 1RM', () => {
    const w = workouts({
      '2026-05-01': { ex: [exAt('Bench Press', 135, { sets: 1, reps: 10 })] },
      '2026-05-02': {
        ex: [
          {
            id: 'm',
            name: 'bench press',
            muscle: 'chest',
            sets: [
              { reps: 5, weight: 185 },
              { reps: 5, weight: 205 },
              { reps: 3, weight: 215 },
            ],
          },
          exAt('Squat', 225, { muscle: 'legs' }),
        ],
      },
    })
    const hist = computeExerciseHistory(w, 'BENCH PRESS')
    expect(hist).toHaveLength(2)
    expect(hist[0].date).toBe('2026-05-01')
    expect(hist[0].topSet).toBe(135)
    expect(hist[1].topSet).toBe(215)
    expect(hist[1].topSetReps).toBe(3)
    expect(hist[1].oneRm).toBeCloseTo(215 * (1 + 3 / 30), 6)
    expect(hist[1].volume).toBe(5 * 185 + 5 * 205 + 3 * 215)
    expect(hist[1].totalSets).toBe(3)
  })

  it('returns an empty list for an unknown or empty key', () => {
    expect(computeExerciseHistory({}, 'whatever')).toEqual([])
    expect(computeExerciseHistory({}, '')).toEqual([])
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

  it('forgives a single unplanned missed day', () => {
    // 05-18 is missed, with no plan — the automatic grace day bridges it.
    const w = workouts({
      '2026-05-16': { ex: [exAt('A', 50)] },
      '2026-05-17': { ex: [exAt('A', 50)] },
      '2026-05-19': { ex: [exAt('A', 50)] },
      '2026-05-20': { ex: [exAt('A', 50)] },
    })
    expect(computeStreak(w, {}, REF)).toEqual({ current: 4, longest: 4 })
  })

  it('breaks when a second day is missed', () => {
    // Two gaps (05-17 and 05-18) — one is forgiven, the second breaks the streak.
    const w = workouts({
      '2026-05-16': { ex: [exAt('A', 50)] },
      '2026-05-19': { ex: [exAt('A', 50)] },
      '2026-05-20': { ex: [exAt('A', 50)] },
    })
    expect(computeStreak(w, {}, REF).current).toBe(2)
  })

  it('bridges planned rest days — resting on schedule keeps the streak', () => {
    // Plan trains Mon/Wed/Fri. Logged Mon 05-18 and Wed 05-20; Tue 05-19 is rest.
    const w = workouts({
      '2026-05-18': { ex: [exAt('A', 50)] },
      '2026-05-20': { ex: [exAt('A', 50)] },
    })
    const plan = mkPlan('Monday', 'Wednesday', 'Friday')
    expect(computeStreak(w, plan, REF).current).toBe(2)
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

describe('computeWeightSeries', () => {
  const wd = (date: string, bodyWeight: number | null): Workout => ({
    date,
    bodyWeight,
    exercises: [],
    cardio: [],
  })

  it('returns logged weigh-ins with a trailing 7-day average', () => {
    const w: Record<string, Workout> = {
      '2026-05-18': wd('2026-05-18', 180),
      '2026-05-19': wd('2026-05-19', 178),
      '2026-05-20': wd('2026-05-20', 182),
    }
    const series = computeWeightSeries(w, REF, 90)
    expect(series.map((p) => p.weight)).toEqual([180, 178, 182])
    expect(series[0].avg).toBe(180)
    expect(series[2].avg).toBe(180) // (180 + 178 + 182) / 3
  })

  it('skips days with no body weight and respects the window', () => {
    const w: Record<string, Workout> = {
      '2026-05-20': wd('2026-05-20', 180),
      '2026-05-19': wd('2026-05-19', null),
      '2026-01-01': wd('2026-01-01', 200),
    }
    expect(computeWeightSeries(w, REF, 90).map((p) => p.date)).toEqual(['2026-05-20'])
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
        cardio: [cardioAt({ time: 20, speed: 0 }), cardioAt({ time: 15, speed: 0 })],
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

  it('does not flag a chest/back imbalance on sparse data', () => {
    // Two sets of chest, one of back — a ratio that would fire without the
    // minimum-volume gate (chest + back = 3, well under the 12-set floor).
    const w = workouts({
      '2026-05-20': {
        ex: [
          exAt('Bench', 50, { muscle: 'chest', sets: 2, reps: 10 }),
          exAt('Row', 50, { muscle: 'back', sets: 1, reps: 10 }),
        ],
      },
    })
    const insights = computeInsights(appData(w), REF)
    expect(insights.some((i) => i.id === 'imb-back' || i.id === 'imb-chest')).toBe(false)
  })

  it('flags a chest/back imbalance once enough volume is logged', () => {
    // 10 chest sets vs 3 back sets — total 13 (over the 12-set floor) and
    // 10/3 ≈ 3.33 (over the 1.8× threshold). The warning should fire.
    const w = workouts({
      '2026-05-19': {
        ex: [exAt('Bench', 50, { muscle: 'chest', sets: 10, reps: 10 })],
      },
      '2026-05-20': {
        ex: [exAt('Row', 50, { muscle: 'back', sets: 3, reps: 10 })],
      },
    })
    const insights = computeInsights(appData(w), REF)
    expect(insights.some((i) => i.id === 'imb-back')).toBe(true)
  })

  it('returns null from recommendNextSession when there is no history', () => {
    expect(recommendNextSession([], REF)).toBeNull()
  })

  it('bumps the next-session weight after recent, complete sessions', () => {
    const w = workouts({
      '2026-05-13': { ex: [exAt('Bench', 180, { sets: 3, reps: 8 })] },
      '2026-05-19': { ex: [exAt('Bench', 180, { sets: 3, reps: 8 })] },
    })
    const rec = recommendNextSession(computeExerciseHistory(w, 'bench'), REF)
    expect(rec).toEqual({ sets: 3, reps: 8, weight: 185, bumped: true })
  })

  it('repeats the last session when reps are too low to bump', () => {
    const w = workouts({
      '2026-05-13': { ex: [exAt('Bench', 200, { sets: 3, reps: 3 })] },
      '2026-05-19': { ex: [exAt('Bench', 200, { sets: 3, reps: 3 })] },
    })
    const rec = recommendNextSession(computeExerciseHistory(w, 'bench'), REF)
    expect(rec).toEqual({ sets: 3, reps: 3, weight: 200, bumped: false })
  })

  it('does not bump after a long layoff', () => {
    const w = workouts({
      '2026-03-01': { ex: [exAt('Bench', 180, { sets: 3, reps: 8 })] },
    })
    const rec = recommendNextSession(computeExerciseHistory(w, 'bench'), REF)
    expect(rec).toEqual({ sets: 3, reps: 8, weight: 180, bumped: false })
  })

  it('topSetExcluding returns prior best without the named date', () => {
    // The classic PR-shot scenario: today's session is the new high, but the
    // PR-shot check must compare against history-minus-today.
    const w = workouts({
      '2026-05-13': { ex: [exAt('Bench', 180)] },
      '2026-05-19': { ex: [exAt('Bench', 175)] },
      '2026-05-20': { ex: [exAt('Bench', 200)] },
    })
    expect(topSetExcluding(w, 'Bench', '2026-05-20')).toBe(180)
    // No prior history → 0 (so PR-shot label stays quiet on a brand-new exercise).
    expect(topSetExcluding(w, 'Squat', '2026-05-20')).toBe(0)
  })

  it('only counts sessions within the 7-day window', () => {
    // 8 days ago is outside the window — even with a recent session today,
    // recent count stays at 1 so the bump never fires.
    const w = workouts({
      '2026-05-12': { ex: [exAt('Bench', 180, { sets: 3, reps: 8 })] },
      '2026-05-20': { ex: [exAt('Bench', 180, { sets: 3, reps: 8 })] },
    })
    const rec = recommendNextSession(computeExerciseHistory(w, 'bench'), REF)
    expect(rec?.bumped).toBe(false)
  })

  it('computes a goal trajectory from a rising trend', () => {
    const w = workouts({
      '2026-05-01': { ex: [exAt('Bench', 170, { sets: 3, reps: 5 })] },
      '2026-05-08': { ex: [exAt('Bench', 175, { sets: 3, reps: 5 })] },
      '2026-05-15': { ex: [exAt('Bench', 180, { sets: 3, reps: 5 })] },
    })
    const trajectory = computeGoalTrajectory(computeExerciseHistory(w, 'bench'), 250)
    // Climbing roughly 5 lb a week from 180 (1RM ~210) → still some weeks to go.
    expect(trajectory?.remaining).toBeGreaterThan(0)
    expect(trajectory?.weeks).toBeGreaterThan(0)
  })

  it('hides weeks-to-goal when the trend is flat or negative', () => {
    const w = workouts({
      '2026-05-01': { ex: [exAt('Bench', 180, { sets: 3, reps: 5 })] },
      '2026-05-08': { ex: [exAt('Bench', 180, { sets: 3, reps: 5 })] },
      '2026-05-15': { ex: [exAt('Bench', 180, { sets: 3, reps: 5 })] },
    })
    const trajectory = computeGoalTrajectory(computeExerciseHistory(w, 'bench'), 250)
    expect(trajectory?.weeks).toBeNull()
    expect(trajectory?.remaining).toBeGreaterThan(0)
  })

  it('returns null when the goal is already reached', () => {
    const w = workouts({
      '2026-05-15': { ex: [exAt('Bench', 260, { sets: 3, reps: 5 })] },
    })
    const trajectory = computeGoalTrajectory(computeExerciseHistory(w, 'bench'), 250)
    expect(trajectory).toBeNull()
  })

  it('still surfaces a trajectory when e1RM exceeds the goal but top set has not', () => {
    // Regression for an earlier bug where `best = max(topSet, oneRm)` made
    // the trajectory disappear as soon as the Epley projection cleared the
    // goal — even though the lifter hadn't actually put the weight on the bar.
    // Top set 180 × 5 → e1RM ≈ 210; goal 200 should still show "20 lb to go".
    const w = workouts({
      '2026-05-01': { ex: [exAt('Bench', 170, { sets: 3, reps: 5 })] },
      '2026-05-08': { ex: [exAt('Bench', 175, { sets: 3, reps: 5 })] },
      '2026-05-15': { ex: [exAt('Bench', 180, { sets: 3, reps: 5 })] },
    })
    const trajectory = computeGoalTrajectory(computeExerciseHistory(w, 'bench'), 200)
    expect(trajectory).not.toBeNull()
    expect(trajectory?.remaining).toBeCloseTo(20, 0)
  })

  it('does not flag a weekly trend swing on a near-empty week', () => {
    // Last week had 12 sets; this week has only 4 — without the new
    // thisWeek >= 8 gate this would surface a "volume down 67%" warning
    // that's just normal week-to-week variance on a hobbyist's schedule.
    const w = workouts({
      '2026-05-12': { ex: [exAt('A', 50, { sets: 12, reps: 8 })] },
      '2026-05-19': { ex: [exAt('A', 50, { sets: 4, reps: 8 })] },
    })
    const insights = computeInsights(appData(w), REF)
    expect(insights.some((i) => i.id === 'trend-down' || i.id === 'trend-up')).toBe(false)
  })
})

/* ----------------------------------------- protein bridge (P2.10 / P2.2) -- */

function mkRecipe(id: string, name: string, extra: Partial<Recipe> = {}): Recipe {
  return {
    id,
    name,
    tags: [],
    prepTime: 0,
    cookTime: 0,
    servings: 1,
    ingredients: [],
    steps: [],
    notes: '',
    favorite: false,
    createdAt: '2026-05-01',
    ...extra,
  }
}

describe('proteinForDay', () => {
  const recipes = [
    mkRecipe('r1', 'Salmon', { nutrition: { protein: 40 } }),
    mkRecipe('r2', 'Oats', { nutrition: { protein: 30 } }),
    mkRecipe('r3', 'Cookies' /* no nutrition */),
  ]
  const meals = (entries: { recipeId: string; date: string; servings?: number }[]): LoggedMeal[] =>
    entries.map((x) => ({
      id: `${x.recipeId}-${x.date}`,
      recipeId: x.recipeId,
      date: x.date,
      servings: x.servings ?? 1,
    }))

  it('sums protein across the day, scaled by servings', () => {
    const totals = proteinForDay(
      meals([
        { recipeId: 'r1', date: '2026-05-20', servings: 1 },
        { recipeId: 'r2', date: '2026-05-20', servings: 2 },
      ]),
      recipes,
      '2026-05-20',
    )
    expect(totals).toBe(100)
  })
  it('ignores meals on other dates', () => {
    const totals = proteinForDay(
      meals([
        { recipeId: 'r1', date: '2026-05-19', servings: 1 },
        { recipeId: 'r2', date: '2026-05-20', servings: 1 },
      ]),
      recipes,
      '2026-05-20',
    )
    expect(totals).toBe(30)
  })
  it('treats missing nutrition as zero rather than guessing', () => {
    const totals = proteinForDay(
      meals([{ recipeId: 'r3', date: '2026-05-20', servings: 1 }]),
      recipes,
      '2026-05-20',
    )
    expect(totals).toBe(0)
  })
  it('returns 0 when there are no logged meals', () => {
    expect(proteinForDay([], recipes, '2026-05-20')).toBe(0)
    expect(proteinForDay(undefined, recipes, '2026-05-20')).toBe(0)
  })
})

describe('postWorkoutRecipe', () => {
  const seedRecipe = mkRecipe('seed1', 'Salmon', {
    tags: ['post-workout'],
    nutrition: { protein: 30 },
  })
  const fav = mkRecipe('fav1', 'Fav', { favorite: true, nutrition: { protein: 20 } })
  const plain = mkRecipe('plain', 'Plain')

  it('returns null when nothing matches', () => {
    expect(postWorkoutRecipe([plain])).toBeNull()
    expect(postWorkoutRecipe([])).toBeNull()
  })
  it('prefers a favorite over a post-workout tag', () => {
    expect(postWorkoutRecipe([seedRecipe, fav])?.id).toBe('fav1')
  })
  it('falls back to the highest-protein post-workout pick when no favorite', () => {
    const low = mkRecipe('low', 'Low', {
      tags: ['post-workout'],
      nutrition: { protein: 10 },
    })
    expect(postWorkoutRecipe([low, seedRecipe])?.id).toBe('seed1')
  })
})

/* ----------------------------------------- isoWeek helper (P2.12) --------- */

describe('isoWeek', () => {
  it('reads the correct ISO week for a known Wednesday', () => {
    // 2026-05-20 is ISO week 21 of 2026.
    expect(isoWeek(parseKey('2026-05-20'))).toBe('2026-W21')
  })
  it('rolls forward on Monday but not Sunday', () => {
    // 2026-05-17 is Sunday — still ISO week 20.
    expect(isoWeek(parseKey('2026-05-17'))).toBe('2026-W20')
    // 2026-05-18 is Monday — week 21.
    expect(isoWeek(parseKey('2026-05-18'))).toBe('2026-W21')
  })
  it('pads single-digit week numbers', () => {
    // Early January often gets week 01 (or, depending on leap, week 52/53
    // of the previous ISO year). 2026-01-05 is a Monday of ISO week 02.
    expect(isoWeek(parseKey('2026-01-05'))).toBe('2026-W02')
  })
})
