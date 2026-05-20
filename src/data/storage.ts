import type { AppData, Preferences, Template } from './types'
import { SCHEMA_VERSION } from './types'
import { uid } from '@/lib/uid'

const STORAGE_KEY = 'fitjournal'

const DEFAULT_PREFERENCES: Preferences = {
  weightUnit: 'lbs',
  distanceUnit: 'miles',
  goalWeight: 170,
  dailyReminder: true,
  weeklySummary: true,
}

/** Push / Pull / Legs — a friendly starting point for a fresh install. */
function seedTemplates(): Template[] {
  return [
    {
      id: uid(),
      name: 'Push Day',
      subtitle: 'Chest, Shoulders, Triceps',
      exercises: [
        { name: 'Bench Press', muscle: 'chest', sets: 4, reps: 10 },
        { name: 'Incline DB Press', muscle: 'chest', sets: 3, reps: 10 },
        { name: 'Overhead Press', muscle: 'shoulders', sets: 3, reps: 8 },
        { name: 'Lateral Raises', muscle: 'shoulders', sets: 3, reps: 15 },
        { name: 'Tricep Pushdown', muscle: 'arms', sets: 3, reps: 12 },
      ],
    },
    {
      id: uid(),
      name: 'Pull Day',
      subtitle: 'Back, Biceps',
      exercises: [
        { name: 'Barbell Row', muscle: 'back', sets: 4, reps: 8 },
        { name: 'Lat Pulldown', muscle: 'back', sets: 3, reps: 10 },
        { name: 'Seated Cable Row', muscle: 'back', sets: 3, reps: 10 },
        { name: 'Face Pulls', muscle: 'shoulders', sets: 3, reps: 15 },
        { name: 'Barbell Curl', muscle: 'arms', sets: 3, reps: 10 },
      ],
    },
    {
      id: uid(),
      name: 'Leg Day',
      subtitle: 'Quads, Hamstrings, Glutes',
      exercises: [
        { name: 'Squat', muscle: 'legs', sets: 4, reps: 8 },
        { name: 'Romanian Deadlift', muscle: 'legs', sets: 3, reps: 10 },
        { name: 'Leg Press', muscle: 'legs', sets: 3, reps: 12 },
        { name: 'Leg Curl', muscle: 'legs', sets: 3, reps: 12 },
        { name: 'Calf Raises', muscle: 'legs', sets: 4, reps: 15 },
      ],
    },
  ]
}

/** A clean starting state. */
export function defaultData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    workouts: {},
    templates: seedTemplates(),
    weeklyPlan: {},
    recipes: [],
    goals: {},
    preferences: { ...DEFAULT_PREFERENCES },
    health: null,
  }
}

/** Load saved data, filling in any missing fields from the defaults. */
export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultData()
    const parsed = JSON.parse(raw) as Partial<AppData>
    const base = defaultData()
    return {
      ...base,
      ...parsed,
      preferences: { ...base.preferences, ...(parsed.preferences ?? {}) },
      schemaVersion: SCHEMA_VERSION,
    }
  } catch {
    return defaultData()
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('[fitjournal] could not save data', e)
  }
}

/** Serialise everything to a JSON string (used by the backup export). */
export function exportData(data: AppData): string {
  return JSON.stringify(data, null, 2)
}
