import type { AppData, Preferences, Recipe, SyncMeta, Template, TemplateColor } from './types'
import { SCHEMA_VERSION } from './types'
import { uid } from '@/lib/uid'
import { todayKey } from '@/lib/dates'

/**
 * Legacy localStorage key. The journal now lives in IndexedDB (below); this
 * key is still read once — to migrate installs from before that change —
 * and is used as a fallback store when IndexedDB is unavailable.
 */
const STORAGE_KEY = 'fitjournal'

/** IndexedDB home of the journal: one database, one store, one record. */
const DB_NAME = 'fitjournal'
const DB_VERSION = 1
const STORE_NAME = 'journal'
const RECORD_KEY = 'appdata'

const DEFAULT_PREFERENCES: Preferences = {
  weightUnit: 'lbs',
  distanceUnit: 'miles',
  goalWeight: 170,
  weeklyGoal: 4,
  dailyReminder: true,
  weeklySummary: true,
  theme: 'system',
  restTimerSeconds: 120,
  dailyProteinGoal: 140,
  backupReminderWeeks: 3,
}

/** Cyclic palette assignment for templates that pre-date the colour field
 *  (P2.8). Used both during the v2→v3 migration and when freshly seeding
 *  PPL — the three starter templates always land red / blue / green. */
const TEMPLATE_COLOR_CYCLE: TemplateColor[] = ['red', 'blue', 'green', 'amber', 'neutral']

/** Push / Pull / Legs — the seeded starter templates. Exported so the Plan
 *  empty state can re-seed if the user nukes everything and wants the
 *  starting templates back. */
export function seedPushPullLegs(): Template[] {
  return seedTemplates()
}

/** Push / Pull / Legs — a friendly starting point for a fresh install. */
function seedTemplates(): Template[] {
  return [
    {
      id: uid(),
      name: 'Push Day',
      subtitle: 'Chest, Shoulders, Triceps',
      color: 'red',
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
      color: 'blue',
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
      color: 'green',
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

/** Three starter recipes seeded on install (P2.9) — gives the empty Recipes
 *  grid something to chew on. `seed: true` lets the empty-state copy read
 *  "We seeded 3 starters" and unsets itself if the user edits one. */
export function seedStarterRecipes(): Recipe[] {
  const today = todayKey()
  return [
    {
      id: uid(),
      name: 'Salmon rice',
      tags: ['dinner', 'high-protein', 'post-workout'],
      prepTime: 5,
      cookTime: 25,
      servings: 2,
      ingredients: [
        '2 salmon fillets',
        '1 cup white rice',
        '1 tbsp soy sauce',
        '1 tsp sesame oil',
        '1 sheet nori, torn',
        'Sliced cucumber, to serve',
      ],
      steps: [
        'Rinse rice, then simmer in 2 cups water for 18 minutes.',
        'Season salmon with soy sauce and sesame oil; bake at 400°F for 12 minutes.',
        'Flake salmon over rice; top with nori and cucumber.',
      ],
      notes: 'Easy post-workout plate. Swap rice for quinoa for more protein.',
      favorite: false,
      createdAt: today,
      nutrition: { calories: 620, protein: 42, carbs: 58, fat: 22 },
      seed: true,
    },
    {
      id: uid(),
      name: 'Tuna pasta',
      tags: ['lunch', 'quick', 'high-protein'],
      prepTime: 5,
      cookTime: 10,
      servings: 2,
      ingredients: [
        '180 g whole-wheat pasta',
        '2 tins tuna in olive oil',
        '2 tbsp Greek yogurt',
        '1 tbsp lemon juice',
        'Fresh parsley',
        'Salt and pepper',
      ],
      steps: [
        'Boil pasta until al dente, drain, save 2 tbsp pasta water.',
        'Flake tuna into a bowl; stir in yogurt, lemon juice and pasta water.',
        'Toss pasta through, finish with parsley and pepper.',
      ],
      notes: 'Five-minute lunch on a heavy training day.',
      favorite: false,
      createdAt: today,
      nutrition: { calories: 580, protein: 36, carbs: 64, fat: 14 },
      seed: true,
    },
    {
      id: uid(),
      name: 'Oats & whey',
      tags: ['breakfast', 'quick', 'high-protein', 'post-workout'],
      prepTime: 2,
      cookTime: 3,
      servings: 1,
      ingredients: [
        '50 g rolled oats',
        '250 ml milk (or water)',
        '1 scoop whey protein',
        '1 tbsp peanut butter',
        '1/2 banana, sliced',
      ],
      steps: [
        'Cook oats in milk on the stove or microwave (3 minutes).',
        'Stir in whey once the oats have cooled slightly.',
        'Top with peanut butter and banana slices.',
      ],
      notes: 'The morning default — 30 g protein in five minutes.',
      favorite: false,
      createdAt: today,
      nutrition: { calories: 420, protein: 30, carbs: 50, fat: 11 },
      seed: true,
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
    recipes: seedStarterRecipes(),
    goals: {},
    preferences: { ...DEFAULT_PREFERENCES },
    health: null,
    lastBackupAt: null,
    loggedMeals: [],
  }
}

/** True for a non-null object value. */
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

// --- Schema migrations -----------------------------------------------------

/**
 * Ordered schema migrations. `MIGRATIONS[i]` upgrades a saved journal from
 * schema version `i + 1` to `i + 2`. When the saved-data shape changes:
 *
 *   1. bump `SCHEMA_VERSION` in `types.ts`;
 *   2. append one step here that reshapes the previous version's data.
 *
 * `migrate()` then walks any old save — or old *backup file* — up the chain
 * before it is normalised, so the stamped `schemaVersion` is always honest
 * and a backup taken on an earlier version stays safely restorable.
 */
const MIGRATIONS: Array<(d: Record<string, unknown>) => Record<string, unknown>> = [
  // v1 → v2: ExerciseEntry changes from a flat { sets, reps, weight } triple to
  // { sets: SetEntry[] }. Each old exercise expands into `sets` identical sets,
  // all carrying the old reps and weight.
  (d) => {
    const workouts = isObject(d.workouts) ? d.workouts : {}
    const migrated: Record<string, unknown> = {}
    for (const [dk, w] of Object.entries(workouts)) {
      if (!isObject(w)) {
        migrated[dk] = w
        continue
      }
      const exercises = Array.isArray(w.exercises) ? w.exercises : []
      migrated[dk] = {
        ...w,
        exercises: exercises.map((e) => {
          if (!isObject(e) || Array.isArray(e.sets)) return e
          const count = typeof e.sets === 'number' ? e.sets : 0
          const reps = typeof e.reps === 'number' ? e.reps : 0
          const weight = typeof e.weight === 'number' ? e.weight : 0
          return {
            id: e.id,
            name: e.name,
            muscle: e.muscle,
            sets: Array.from({ length: Math.max(1, count) }, () => ({ reps, weight })),
            ...(e.notes != null ? { notes: e.notes } : {}),
          }
        }),
      }
    }
    return { ...d, workouts: migrated, schemaVersion: 2 }
  },
  // v2 → v3 (P2): additive. Existing templates that pre-date the colour field
  // get a cyclic default so Plan's chip strip (P2.8) always has a swatch to
  // render. `loggedMeals` initialises to an empty array. Preference defaults
  // are filled lazily in `normalize()`, so a hand-edited backup that omits
  // them still works.
  (d) => {
    const templates = Array.isArray(d.templates) ? d.templates : []
    return {
      ...d,
      templates: templates.map((t, i) => {
        if (!isObject(t)) return t
        if (typeof t.color === 'string') return t
        return { ...t, color: TEMPLATE_COLOR_CYCLE[i % TEMPLATE_COLOR_CYCLE.length] }
      }),
      loggedMeals: Array.isArray(d.loggedMeals) ? d.loggedMeals : [],
      schemaVersion: 3,
    }
  },
]

/**
 * Walk parsed data up the migration chain, from its own `schemaVersion` to
 * the current one. Data with no version is treated as the first version.
 */
function migrate(input: unknown): Partial<AppData> {
  let working: Record<string, unknown> = isObject(input) ? { ...input } : {}
  let version = typeof working.schemaVersion === 'number' ? working.schemaVersion : 1
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version - 1]
    if (!step) break
    working = step(working)
    version += 1
  }
  return working as Partial<AppData>
}

/**
 * Migrate, then merge possibly-incomplete data onto the defaults — so an
 * older, partial, or just-migrated save still yields a valid AppData.
 */
function normalize(input: unknown): AppData {
  const parsed = migrate(input)
  const base = defaultData()
  // Old saves predate `recipes` being seeded — leave their (possibly empty)
  // recipes array alone rather than re-seeding starters on every load.
  const recipes = parsed.recipes ?? []
  return {
    schemaVersion: SCHEMA_VERSION,
    workouts: parsed.workouts ?? base.workouts,
    templates: parsed.templates ?? base.templates,
    weeklyPlan: parsed.weeklyPlan ?? base.weeklyPlan,
    recipes,
    goals: parsed.goals ?? base.goals,
    preferences: { ...base.preferences, ...(parsed.preferences ?? {}) },
    health: parsed.health ?? base.health,
    lastBackupAt: parsed.lastBackupAt ?? base.lastBackupAt,
    loggedMeals: parsed.loggedMeals ?? [],
  }
}

// --- IndexedDB access ------------------------------------------------------

let dbPromise: Promise<IDBDatabase> | null = null
/** Set once IndexedDB is found to be unusable, so we stop retrying it. */
let idbUnavailable = false

/** Open (once) the IndexedDB database, creating the object store if needed. */
function openDB(): Promise<IDBDatabase> {
  if (idbUnavailable) return Promise.reject(new Error('IndexedDB unavailable'))
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    req.onblocked = () => reject(new Error('IndexedDB blocked'))
  })
  dbPromise.catch(() => {
    // A failed open is treated as permanent for this session — fall back to
    // localStorage rather than retrying it on every read and write.
    idbUnavailable = true
    dbPromise = null
  })
  return dbPromise
}

/** Read a record from IndexedDB by key (null if none yet). Defaults to the
 *  journal; the sync sidecar lives under its own key in the same store. */
function idbGet(key: IDBValidKey = RECORD_KEY): Promise<unknown> {
  return openDB().then(
    (db) =>
      new Promise<unknown>((resolve, reject) => {
        const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key)
        req.onsuccess = () => resolve(req.result ?? null)
        req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'))
      }),
  )
}

/** Write a record to IndexedDB by key; rejects on quota or other failure. */
function idbPut(value: unknown, key: IDBValidKey = RECORD_KEY): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).put(value, key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'))
      }),
  )
}

// --- localStorage fallback -------------------------------------------------

/** Write the journal to localStorage; returns false if the write failed. */
function writeLocalStorage(data: AppData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch (e) {
    console.warn('[fitjournal] could not save data', e)
    return false
  }
}

// --- Public load / save ----------------------------------------------------

/**
 * Load the on-device journal. Prefers IndexedDB — durable and not subject
 * to Safari's 7-day script-storage cap. On the first run after the
 * IndexedDB switch it migrates an existing localStorage journal across; if
 * IndexedDB is unavailable it falls back to localStorage entirely. Always
 * leaves the chosen store holding a valid, current-shape journal.
 */
export async function loadData(): Promise<AppData> {
  // 1. Preferred path — read from IndexedDB.
  try {
    const stored = await idbGet()
    if (stored !== null && stored !== undefined) {
      const data = normalize(stored)
      // If a schema migration reshaped it, persist the upgrade so it is
      // durable and never has to run again.
      if (!isObject(stored) || stored.schemaVersion !== data.schemaVersion) {
        await idbPut(data).catch(() => {
          /* the upgrade write is best-effort — the next save will retry */
        })
      }
      return data
    }
  } catch {
    /* IndexedDB unavailable — fall through to the localStorage path */
  }

  // 2. IndexedDB is empty (or unavailable). Migrate a legacy localStorage
  //    journal if one exists; otherwise start from a clean slate.
  let data: AppData
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    data = raw ? normalize(JSON.parse(raw)) : defaultData()
  } catch {
    data = defaultData()
  }

  // 3. Seed the journal into IndexedDB. On success, retire the localStorage
  //    copy so it cannot go stale; if IndexedDB cannot be reached, keep
  //    localStorage as the live fallback store.
  try {
    await idbPut(data)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* clearing the migrated copy is best-effort */
    }
  } catch {
    writeLocalStorage(data)
  }
  return data
}

/**
 * Persist the full state to the device. Writes to IndexedDB, falling back
 * to localStorage if that fails. Returns `false` only if *both* fail — so a
 * silent data loss can never look like a successful save.
 */
export async function saveData(data: AppData): Promise<boolean> {
  try {
    await idbPut(data)
    return true
  } catch (e) {
    console.warn('[fitjournal] IndexedDB write failed — falling back to localStorage', e)
    return writeLocalStorage(data)
  }
}

// --- Sync metadata sidecar -------------------------------------------------

/** IndexedDB key (same store) for the per-record sync bookkeeping. */
const SYNCMETA_KEY = 'syncmeta'
/** localStorage fallback key, mirroring the journal's own fallback. */
const SYNCMETA_LS_KEY = 'fitjournal-syncmeta'

/** A valid, empty sync sidecar — nothing synced yet. */
export function emptySyncMeta(): SyncMeta {
  return { records: {}, lastPulledAt: null }
}

/** Coerce unknown storage contents into a valid SyncMeta, or null. */
function asSyncMeta(value: unknown): SyncMeta | null {
  if (isObject(value) && isObject(value.records)) {
    return {
      records: value.records as SyncMeta['records'],
      lastPulledAt: typeof value.lastPulledAt === 'string' ? value.lastPulledAt : null,
    }
  }
  return null
}

/** Load the sync sidecar (null if the device has never synced). Mirrors the
 *  journal's IndexedDB-then-localStorage fallback so it survives either tier. */
export async function loadSyncMeta(): Promise<SyncMeta | null> {
  try {
    const fromIdb = asSyncMeta(await idbGet(SYNCMETA_KEY))
    if (fromIdb) return fromIdb
  } catch {
    /* IndexedDB unavailable — fall through to localStorage */
  }
  try {
    const raw = localStorage.getItem(SYNCMETA_LS_KEY)
    if (raw) return asSyncMeta(JSON.parse(raw))
  } catch {
    /* ignore — treat as never-synced */
  }
  return null
}

/** Persist the sync sidecar. Returns false only if every storage tier fails. */
export async function saveSyncMeta(meta: SyncMeta): Promise<boolean> {
  try {
    await idbPut(meta, SYNCMETA_KEY)
    return true
  } catch {
    try {
      localStorage.setItem(SYNCMETA_LS_KEY, JSON.stringify(meta))
      return true
    } catch {
      return false
    }
  }
}

/**
 * Ask the browser to keep this site's storage durable, so it is not evicted
 * under storage pressure or by Safari's 7-day script-storage cap. Best-
 * effort and silent: support varies and no browser prompts for it.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if ('storage' in navigator && typeof navigator.storage.persist === 'function') {
      return await navigator.storage.persist()
    }
  } catch {
    /* best-effort — a denied or unsupported request is harmless */
  }
  return false
}

/**
 * Parse the contents of a backup file into valid AppData. Throws a friendly
 * error if the text isn't valid JSON or isn't a FitJournal backup.
 */
export function importData(raw: string): AppData {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("That file isn't valid JSON — pick a FitJournal backup file.")
  }
  const looksValid =
    isObject(parsed) && isObject(parsed.workouts) && Array.isArray(parsed.templates)
  if (!looksValid) {
    throw new Error("That doesn't look like a FitJournal backup file.")
  }
  return normalize(parsed)
}

/** Serialise everything to a JSON string (used by the backup export). */
export function exportData(data: AppData): string {
  return JSON.stringify(data, null, 2)
}
