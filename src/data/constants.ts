import type { CardioType, MuscleGroup, RecipeTag } from './types'

export const MUSCLE_GROUPS: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'abs']

export const CARDIO_TYPES: CardioType[] = ['treadmill', 'bike', 'stairmaster']

export const CARDIO_LABELS: Record<CardioType, string> = {
  treadmill: 'Treadmill',
  bike: 'Bike',
  stairmaster: 'Stairmaster',
}

/** Speed unit shown per cardio type. */
export const CARDIO_SPEED_UNIT: Record<CardioType, string> = {
  treadmill: 'mph',
  bike: 'mph',
  stairmaster: 'spm',
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
}
