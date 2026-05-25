import type { CardioType, DistanceUnit, MuscleGroup, RecipeTag } from './types'

export const MUSCLE_GROUPS: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'abs']

export const CARDIO_TYPES: CardioType[] = ['treadmill', 'bike', 'stairmaster']

export const CARDIO_LABELS: Record<CardioType, string> = {
  treadmill: 'Treadmill',
  bike: 'Bike',
  stairmaster: 'Stairmaster',
}

/**
 * Speed unit shown for a cardio type. Treadmill and bike follow the user's
 * distance preference (mph / km/h); the stairmaster is steps-per-minute.
 */
export function cardioSpeedUnit(type: CardioType, distanceUnit: DistanceUnit): string {
  if (type === 'stairmaster') return 'spm'
  return distanceUnit === 'km' ? 'km/h' : 'mph'
}

export const RECIPE_TAGS: RecipeTag[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'high-protein',
  'meal-prep',
  'quick',
  'vegetarian',
  'post-workout',
]

export const RECIPE_TAG_LABELS: Record<RecipeTag, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  'high-protein': 'High Protein',
  'meal-prep': 'Meal Prep',
  quick: 'Quick',
  vegetarian: 'Vegetarian',
  'post-workout': 'Post-Workout',
}
