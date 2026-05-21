/**
 * Derived computations. Everything here is a pure function of stored data —
 * PRs, streaks, stats, insights and the heatmap are calculated, never saved.
 */
import type { AppData, CardioType, DayName, Workout } from './types'
import { CARDIO_LABELS } from './constants'
import { addDays, dateKey, dayNameOf, parseKey } from '@/lib/dates'

type Workouts = Record<string, Workout>
type WeeklyPlan = AppData['weeklyPlan']

const DAY_MS = 86_400_000

/** Lowercased exercise name — the key PRs and goals are tracked by. */
export function exerciseKey(name: string): string {
  return name.trim().toLowerCase()
}

/** A workout "counts" only if it has at least one logged entry. */
export function isLoggedWorkout(w: Workout | undefined): w is Workout {
  return !!w && (w.exercises.length > 0 || w.cardio.length > 0)
}

// ---------------------------------------------------------------- PRs -----

export interface StrengthPR {
  name: string
  weight: number
  date: string
}
export interface CardioPR {
  mostCalories: number
  date: string
}
export interface TimelineEntry {
  date: string
  kind: 'weight' | 'calories'
  label: string
  value: string
}

export function computeStrengthPRs(workouts: Workouts): Record<string, StrengthPR> {
  const prs: Record<string, StrengthPR> = {}
  for (const dk of Object.keys(workouts).sort()) {
    for (const e of workouts[dk].exercises) {
      if (e.weight <= 0) continue
      const k = exerciseKey(e.name)
      const best = prs[k]
      if (!best || e.weight > best.weight) {
        prs[k] = { name: e.name, weight: e.weight, date: dk }
      }
    }
  }
  return prs
}

export function computeCardioPRs(workouts: Workouts): Partial<Record<CardioType, CardioPR>> {
  const prs: Partial<Record<CardioType, CardioPR>> = {}
  for (const dk of Object.keys(workouts).sort()) {
    for (const c of workouts[dk].cardio) {
      if (c.calories <= 0) continue
      const best = prs[c.type]
      if (!best || c.calories > best.mostCalories) {
        prs[c.type] = { mostCalories: c.calories, date: dk }
      }
    }
  }
  return prs
}

/** Every moment a record was beaten, newest first. */
export function computePRTimeline(workouts: Workouts): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  const bestWeight: Record<string, number> = {}
  const bestCalories: Partial<Record<CardioType, number>> = {}
  for (const dk of Object.keys(workouts).sort()) {
    const w = workouts[dk]
    for (const e of w.exercises) {
      if (e.weight <= 0) continue
      const k = exerciseKey(e.name)
      if (e.weight > (bestWeight[k] ?? 0)) {
        bestWeight[k] = e.weight
        entries.push({ date: dk, kind: 'weight', label: e.name, value: `${e.weight} lbs` })
      }
    }
    for (const c of w.cardio) {
      if (c.calories <= 0) continue
      if (c.calories > (bestCalories[c.type] ?? 0)) {
        bestCalories[c.type] = c.calories
        entries.push({
          date: dk,
          kind: 'calories',
          label: CARDIO_LABELS[c.type],
          value: `${c.calories} kcal`,
        })
      }
    }
  }
  return entries.reverse()
}

/** Would logging this strength entry set a new record? */
export function wouldBeStrengthPR(workouts: Workouts, name: string, weight: number): boolean {
  if (weight <= 0) return false
  const best = computeStrengthPRs(workouts)[exerciseKey(name)]
  return !best || weight > best.weight
}

/** Would logging this cardio entry set a new calorie record? */
export function wouldBeCardioPR(workouts: Workouts, type: CardioType, calories: number): boolean {
  if (calories <= 0) return false
  const best = computeCardioPRs(workouts)[type]
  return !best || calories > best.mostCalories
}

// ------------------------------------------------------------- streak -----

export interface StreakResult {
  current: number
  longest: number
}

/** Does the weekly plan have at least one training day assigned? */
function hasWeeklyPlan(weeklyPlan: WeeklyPlan): boolean {
  return Object.values(weeklyPlan).some((p) => !!p && p.exercises.length > 0)
}

/**
 * A planned rest day — a weekday with no training assigned. Rest days *bridge*
 * the streak (they never break it) but don't add to the count, so resting on
 * schedule never costs you a streak. Only meaningful once a plan exists.
 */
function isPlannedRest(weeklyPlan: WeeklyPlan, date: Date): boolean {
  const plan = weeklyPlan[dayNameOf(date)]
  return !plan || plan.exercises.length === 0
}

/** Longest run of trained days, bridging planned rest days. */
function longestStreak(workouts: Workouts, weeklyPlan: WeeklyPlan): number {
  const logged = Object.keys(workouts)
    .filter((k) => isLoggedWorkout(workouts[k]))
    .sort()
  if (logged.length === 0) return 0
  const planned = hasWeeklyPlan(weeklyPlan)
  const last = parseKey(logged[logged.length - 1])
  let longest = 0
  let run = 0
  for (let cur = parseKey(logged[0]); cur <= last; cur = addDays(cur, 1)) {
    if (isLoggedWorkout(workouts[dateKey(cur)])) {
      run += 1
      longest = Math.max(longest, run)
    } else if (planned && isPlannedRest(weeklyPlan, cur)) {
      // rest day — bridges the run without adding to it
    } else {
      run = 0
    }
  }
  return longest
}

/**
 * Current streak of trained days ending today (or yesterday — today still
 * counts as "in progress"). Planned rest days keep the streak alive.
 */
export function computeStreak(
  workouts: Workouts,
  weeklyPlan: WeeklyPlan,
  reference: Date,
): StreakResult {
  const planned = hasWeeklyPlan(weeklyPlan)
  let current = 0
  let cursor = new Date(reference)
  for (let i = 0; i < 400; i++) {
    if (isLoggedWorkout(workouts[dateKey(cursor)])) {
      current += 1
    } else if (planned && isPlannedRest(weeklyPlan, cursor)) {
      // rest day — the streak is safe, this day just doesn't count
    } else if (i === 0) {
      // today isn't logged yet — grace, the streak runs through to yesterday
    } else {
      break
    }
    cursor = addDays(cursor, -1)
  }
  return { current, longest: Math.max(current, longestStreak(workouts, weeklyPlan)) }
}

// -------------------------------------------------------------- stats -----

export interface WeekStat {
  label: string
  totalSets: number
  workoutCount: number
  cardioDistance: number
}

export function computeWeeklyStats(
  workouts: Workouts,
  reference: Date,
  numWeeks = 8,
): WeekStat[] {
  const weeks: WeekStat[] = []
  for (let w = numWeeks - 1; w >= 0; w--) {
    const weekStart = new Date(reference)
    weekStart.setDate(reference.getDate() - reference.getDay() - w * 7)
    let totalSets = 0
    let workoutCount = 0
    let cardioDistance = 0
    for (let day = 0; day < 7; day++) {
      const wk = workouts[dateKey(addDays(weekStart, day))]
      if (isLoggedWorkout(wk)) {
        workoutCount += 1
        for (const e of wk.exercises) totalSets += e.sets
        for (const c of wk.cardio) cardioDistance += (c.time / 60) * c.speed
      }
    }
    weeks.push({ label: `W${numWeeks - w}`, totalSets, workoutCount, cardioDistance })
  }
  return weeks
}

export interface TotalStats {
  totalWorkouts: number
  totalSets: number
  totalCardioDistance: number
}

/** Totals over the 30 days ending at `reference`. */
export function computeTotalStats(workouts: Workouts, reference: Date): TotalStats {
  const end = new Date(reference)
  end.setHours(23, 59, 59, 999)
  let totalWorkouts = 0
  let totalSets = 0
  let totalCardioDistance = 0
  for (const dk of Object.keys(workouts)) {
    const diff = (end.getTime() - parseKey(dk).getTime()) / DAY_MS
    if (diff < 0 || diff > 30) continue
    const w = workouts[dk]
    if (isLoggedWorkout(w)) totalWorkouts += 1
    for (const e of w.exercises) totalSets += e.sets
    for (const c of w.cardio) totalCardioDistance += (c.time / 60) * c.speed
  }
  return { totalWorkouts, totalSets, totalCardioDistance }
}

/** Sets per muscle group over the last `weeks` weeks. */
export function computeMuscleBalance(
  workouts: Workouts,
  reference: Date,
  weeks = 4,
): Record<string, number> {
  const cutoff = addDays(reference, -weeks * 7)
  const sets: Record<string, number> = {}
  for (const dk of Object.keys(workouts)) {
    const d = parseKey(dk)
    if (d < cutoff || d > reference) continue
    for (const e of workouts[dk].exercises) {
      sets[e.muscle] = (sets[e.muscle] ?? 0) + e.sets
    }
  }
  return sets
}

export interface Plateau {
  exercise: string
  sessions: number
  weight: number
}

/** Exercises whose weight hasn't improved across their last 4 logged sessions. */
export function computePlateaus(workouts: Workouts): Plateau[] {
  const history: Record<string, { name: string; weight: number }[]> = {}
  for (const dk of Object.keys(workouts).sort()) {
    for (const e of workouts[dk].exercises) {
      const k = exerciseKey(e.name)
      ;(history[k] ??= []).push({ name: e.name, weight: e.weight })
    }
  }
  const plateaus: Plateau[] = []
  for (const k of Object.keys(history)) {
    const list = history[k]
    if (list.length < 4) continue
    const last4 = list.slice(-4)
    const maxWeight = Math.max(...last4.map((e) => e.weight))
    if (maxWeight > 0 && maxWeight <= last4[0].weight) {
      plateaus.push({ exercise: last4[0].name, sessions: last4.length, weight: maxWeight })
    }
  }
  return plateaus
}

// ----------------------------------------------------------- insights -----

export type InsightTone = 'success' | 'warning' | 'info'
export interface Insight {
  id: string
  tone: InsightTone
  text: string
}

export function computeInsights(data: AppData, reference: Date): Insight[] {
  const out: Insight[] = []
  const { workouts, goals } = data

  const streak = computeStreak(workouts, data.weeklyPlan, reference)
  if (streak.current >= 3) {
    out.push({
      id: 'streak',
      tone: 'success',
      text: `${streak.current}-day streak — keep the momentum going.`,
    })
  }

  // Milestones — celebrate round numbers of workouts logged.
  const total = totalWorkoutsLogged(workouts)
  if (WORKOUT_MILESTONES.includes(total)) {
    out.push({
      id: 'milestone',
      tone: 'success',
      text: `Milestone reached — ${total} workouts logged. That's real consistency.`,
    })
  } else if (total >= 5) {
    const next = WORKOUT_MILESTONES.find((m) => m > total)
    if (next && next - total <= 4) {
      out.push({
        id: 'milestone-near',
        tone: 'info',
        text: `${next - total} more ${next - total === 1 ? 'workout' : 'workouts'} until you reach ${next} logged.`,
      })
    }
  }

  // Weekly volume trend — this week's sets vs last week's.
  const trendWeeks = computeWeeklyStats(workouts, reference, 2)
  const prevWeek = trendWeeks[0]
  const thisWeek = trendWeeks[1]
  if (prevWeek.totalSets >= 12 && thisWeek.totalSets > 0) {
    const change = Math.round(
      ((thisWeek.totalSets - prevWeek.totalSets) / prevWeek.totalSets) * 100,
    )
    if (change >= 15) {
      out.push({
        id: 'trend-up',
        tone: 'success',
        text: `Training volume is up ${change}% on last week — strong momentum.`,
      })
    } else if (change <= -30) {
      out.push({
        id: 'trend-down',
        tone: 'info',
        text: `Volume is down ${Math.abs(change)}% on last week — a lighter week is fine, just keep showing up.`,
      })
    }
  }

  // Most consistent weekday.
  const best = computeBestDay(workouts)
  if (best && total >= 8 && best.count >= 3) {
    out.push({
      id: 'best-day',
      tone: 'info',
      text: `${best.day} is your most consistent day — ${best.count} workouts logged on it.`,
    })
  }

  for (const p of computePlateaus(workouts)) {
    out.push({
      id: `plateau-${p.exercise}`,
      tone: 'warning',
      text: `${p.exercise} has held around ${p.weight} lbs for ${p.sessions} sessions. Try varying reps or adding a set.`,
    })
  }

  const balance = computeMuscleBalance(workouts, reference)
  if (balance.chest && balance.back) {
    const ratio = balance.chest / balance.back
    if (ratio > 1.8) {
      out.push({
        id: 'imb-back',
        tone: 'warning',
        text: 'Back volume is well below chest — add more pulling work.',
      })
    } else if (1 / ratio > 1.8) {
      out.push({
        id: 'imb-chest',
        tone: 'warning',
        text: 'Chest volume is well below back — add more pressing work.',
      })
    }
  }
  const upper =
    (balance.chest ?? 0) + (balance.back ?? 0) + (balance.shoulders ?? 0) + (balance.arms ?? 0)
  if (balance.legs && upper > 0 && balance.legs / upper < 0.3) {
    out.push({
      id: 'imb-legs',
      tone: 'warning',
      text: "Leg volume is low next to upper body — don't skip leg day.",
    })
  }

  const stats = computeTotalStats(workouts, reference)
  if (stats.totalWorkouts >= 5) {
    out.push({
      id: 'avg',
      tone: 'info',
      text: `Averaging ${(stats.totalWorkouts / 4.3).toFixed(1)} workouts/week over the last 30 days.`,
    })
  }

  const prs = computeStrengthPRs(workouts)
  for (const [k, target] of Object.entries(goals)) {
    const pr = prs[k]
    if (!pr) continue
    const pct = Math.round((pr.weight / target) * 100)
    if (pr.weight >= target) {
      out.push({
        id: `goal-${k}`,
        tone: 'success',
        text: `${pr.name} goal reached — ${pr.weight} lbs (goal ${target}).`,
      })
    } else if (pct >= 75) {
      out.push({
        id: `goal-${k}`,
        tone: 'info',
        text: `${pr.name} is at ${pct}% of your ${target} lb goal — keep pushing.`,
      })
    }
  }

  return out
}

// -------------------------------------------------- habit & sessions -----

/** Workout-count milestones worth celebrating. */
export const WORKOUT_MILESTONES = [10, 25, 50, 100, 200, 365, 500, 1000]

/** Total number of days with a logged workout, all time. */
export function totalWorkoutsLogged(workouts: Workouts): number {
  return Object.values(workouts).filter(isLoggedWorkout).length
}

/** The weekday the user trains most often (null until there is data). */
export function computeBestDay(workouts: Workouts): { day: DayName; count: number } | null {
  const tally = new Map<DayName, number>()
  for (const dk of Object.keys(workouts)) {
    if (!isLoggedWorkout(workouts[dk])) continue
    const day = dayNameOf(parseKey(dk))
    tally.set(day, (tally.get(day) ?? 0) + 1)
  }
  let best: { day: DayName; count: number } | null = null
  for (const [day, count] of tally) {
    if (!best || count > best.count) best = { day, count }
  }
  return best
}

export interface WeekProgress {
  done: number
  goal: number
  /** 0–100, capped. */
  pct: number
  remaining: number
  totalSets: number
}

/** Workouts logged in the current calendar week (Sun–Sat) measured against the goal. */
export function computeWeekProgress(
  workouts: Workouts,
  reference: Date,
  goal: number,
): WeekProgress {
  const start = new Date(reference)
  start.setDate(reference.getDate() - reference.getDay())
  let done = 0
  let totalSets = 0
  for (let i = 0; i < 7; i++) {
    const w = workouts[dateKey(addDays(start, i))]
    if (isLoggedWorkout(w)) {
      done += 1
      for (const e of w.exercises) totalSets += e.sets
    }
  }
  const pct = goal > 0 ? Math.min(100, Math.round((done / goal) * 100)) : 0
  return { done, goal, pct, remaining: Math.max(0, goal - done), totalSets }
}

export interface SessionSummary {
  hasContent: boolean
  exerciseCount: number
  totalSets: number
  /** Sets × reps × weight, summed across the session. */
  totalVolume: number
  cardioCount: number
  cardioMinutes: number
  /** Records broken on this day. */
  prs: TimelineEntry[]
}

/** One day's workout rolled up for the post-workout summary. */
export function computeSessionSummary(workouts: Workouts, dk: string): SessionSummary {
  const w = workouts[dk]
  const prs = computePRTimeline(workouts).filter((e) => e.date === dk)
  let totalSets = 0
  let totalVolume = 0
  let cardioMinutes = 0
  for (const e of w?.exercises ?? []) {
    totalSets += e.sets
    totalVolume += e.sets * e.reps * e.weight
  }
  for (const c of w?.cardio ?? []) {
    cardioMinutes += c.time
  }
  return {
    hasContent: isLoggedWorkout(w),
    exerciseCount: w?.exercises.length ?? 0,
    totalSets,
    totalVolume,
    cardioCount: w?.cardio.length ?? 0,
    cardioMinutes,
    prs,
  }
}

// ----------------------------------------------------------- heatmap -----

export type HeatLevel = 0 | 1 | 2 | 3 | 4
export interface HeatCell {
  dateKey: string
  level: HeatLevel
  count: number
  future: boolean
}

/** A 13-week (13×7) activity grid whose last column is the current week. */
export function computeHeatmap(workouts: Workouts, reference: Date): HeatCell[] {
  const cells: HeatCell[] = []
  const start = new Date(reference)
  // Back up to the Sunday 12 weeks before this week, so the 13th (last) column
  // is the current week — including today and any days still to come.
  start.setDate(reference.getDate() - reference.getDay() - 84)
  for (let col = 0; col < 13; col++) {
    for (let row = 0; row < 7; row++) {
      const d = addDays(start, col * 7 + row)
      const dk = dateKey(d)
      const w = workouts[dk]
      const count = w ? w.exercises.length + w.cardio.length : 0
      let level: HeatLevel = 0
      if (count >= 6) level = 4
      else if (count >= 4) level = 3
      else if (count >= 2) level = 2
      else if (count >= 1) level = 1
      cells.push({ dateKey: dk, level, count, future: d > reference })
    }
  }
  return cells
}
