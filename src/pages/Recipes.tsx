import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Camera,
  Check,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Star,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import {
  Button,
  Card,
  Chip,
  ConfirmModal,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  useToast,
} from '@/components'
import { useStore } from '@/data/store-context'
import { RECIPE_TAGS, RECIPE_TAG_LABELS } from '@/data/constants'
import type { Recipe, RecipeNutrition, RecipeTag } from '@/data/types'
import { cn } from '@/lib/cn'
import { todayKey } from '@/lib/dates'
import { downscaleImage } from '@/lib/image'
import { uid } from '@/lib/uid'

const SORTS = [
  { id: 'recent', label: 'Recently added' },
  { id: 'az', label: 'Name A–Z' },
  { id: 'fav', label: 'Favorites first' },
  { id: 'quick', label: 'Quickest first' },
] as const
type SortId = (typeof SORTS)[number]['id']

const splitLines = (s: string): string[] =>
  s
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

const clampNum = (s: string): number => Math.max(0, Number(s) || 0)

const macroStr = (n?: number): string => (n != null ? String(n) : '')

/** Pack the four macro inputs into a nutrition object, or undefined if all empty. */
function buildNutrition(
  calories: string,
  protein: string,
  carbs: string,
  fat: string,
): RecipeNutrition | undefined {
  const parse = (s: string): number | undefined => {
    const trimmed = s.trim()
    if (trimmed === '') return undefined
    const n = Number(trimmed)
    return Number.isFinite(n) && n >= 0 ? n : undefined
  }
  const nutrition: RecipeNutrition = {}
  const c = parse(calories)
  const p = parse(protein)
  const cb = parse(carbs)
  const f = parse(fat)
  if (c !== undefined) nutrition.calories = c
  if (p !== undefined) nutrition.protein = p
  if (cb !== undefined) nutrition.carbs = cb
  if (f !== undefined) nutrition.fat = f
  return Object.keys(nutrition).length > 0 ? nutrition : undefined
}

/** Round to two decimals and strip trailing zeros — "1.5", "3", "0.67". */
function formatQty(n: number): string {
  return Number(n.toFixed(2)).toString()
}

/**
 * Scale a leading whole/decimal quantity in an ingredient line. Lines without
 * a leading number, or whose number is followed by another number (a mixed
 * fraction like "1 1/2 cups"), are returned unchanged — better than a
 * half-scaled string.
 */
function scaleIngredient(line: string, factor: number): string {
  if (factor === 1) return line
  return line.replace(
    /^(\d+(?:\.\d+)?)(\s+)(?=\D|$)/,
    (_full: string, qty: string, space: string): string =>
      formatQty(Number(qty) * factor) + space,
  )
}

export function RecipesScreen() {
  const { data } = useStore()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<SortId>('recent')
  const [editing, setEditing] = useState<{ id: string | null } | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const toggleFilter = (tag: string): void =>
    setFilters((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })

  const q = search.trim().toLowerCase()
  const visible = useMemo(() => {
    const filtered = data.recipes.filter((r) => {
      if (
        q &&
        !r.name.toLowerCase().includes(q) &&
        !r.ingredients.some((i) => i.toLowerCase().includes(q))
      ) {
        return false
      }
      for (const f of filters) {
        if (f === '_fav' && !r.favorite) return false
        if (f !== '_fav' && !r.tags.includes(f as RecipeTag)) return false
      }
      return true
    })
    const sorted = [...filtered]
    if (sort === 'az') {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sort === 'fav') {
      sorted.sort((a, b) => Number(b.favorite) - Number(a.favorite))
    } else if (sort === 'quick') {
      const t = (r: Recipe): number => r.prepTime + r.cookTime || Infinity
      sorted.sort((a, b) => t(a) - t(b))
    }
    return sorted
  }, [data.recipes, q, filters, sort])

  return (
    <div className="fj-screen">
      <PageHeader
        title="Recipes"
        subtitle="Your personal recipe collection"
        actions={
          <Button onClick={() => setEditing({ id: null })}>
            <Plus size={16} /> Add recipe
          </Button>
        }
      />

      <div className="fj-row" style={{ marginBottom: 'var(--space-4)' }}>
        <input
          className="fj-input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Search recipes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search recipes"
        />
        <select
          className="fj-select"
          aria-label="Sort recipes"
          style={{ width: 168 }}
          value={sort}
          onChange={(e) => setSort(e.target.value as SortId)}
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <Chip active={filters.has('_fav')} onClick={() => toggleFilter('_fav')}>
          ★ Favorites
        </Chip>
        {RECIPE_TAGS.map((t) => (
          <Chip key={t} active={filters.has(t)} onClick={() => toggleFilter(t)}>
            {RECIPE_TAG_LABELS[t]}
          </Chip>
        ))}
      </div>

      {visible.length > 0 ? (
        <div className="fj-card-grid">
          {visible.map((r) => (
            <RecipeCard key={r.id} recipe={r} onOpen={() => setDetailId(r.id)} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<UtensilsCrossed size={40} />}
          title={data.recipes.length > 0 ? 'No recipes match' : 'No recipes yet'}
          description={
            data.recipes.length > 0
              ? 'Try adjusting your search or filters.'
              : 'Add your first recipe to get started.'
          }
          action={
            data.recipes.length === 0 ? (
              <Button size="sm" onClick={() => setEditing({ id: null })}>
                Add recipe
              </Button>
            ) : undefined
          }
        />
      )}

      {editing && (
        <RecipeModal
          key={editing.id ?? 'new'}
          recipeId={editing.id}
          onClose={() => setEditing(null)}
        />
      )}
      {detailId && (
        <RecipeDetail
          key={detailId}
          recipeId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={(id) => {
            setDetailId(null)
            setEditing({ id })
          }}
        />
      )}
    </div>
  )
}

function RecipeCard({ recipe, onOpen }: { recipe: Recipe; onOpen: () => void }) {
  const { toggleRecipeFavorite } = useStore()
  const totalTime = recipe.prepTime + recipe.cookTime
  const calories = recipe.nutrition?.calories
  const protein = recipe.nutrition?.protein
  return (
    <Card padded={false} className="fj-recipe-card" onClick={onOpen}>
      <div className="fj-recipe-card__photo">
        {recipe.photo ? (
          <img src={recipe.photo} alt="" loading="lazy" />
        ) : (
          <UtensilsCrossed size={30} aria-hidden="true" />
        )}
      </div>
      <div className="fj-recipe-card__body">
        <div className="fj-recipe-card__head">
          <span className="fj-recipe-card__title">{recipe.name}</span>
          <button
            className={cn('fj-fav-btn', recipe.favorite && 'fj-fav-btn--on')}
            aria-label="Toggle favorite"
            aria-pressed={recipe.favorite}
            onClick={(e) => {
              e.stopPropagation()
              toggleRecipeFavorite(recipe.id)
            }}
          >
            <Star size={18} fill={recipe.favorite ? 'currentColor' : 'none'} />
          </button>
        </div>
        {recipe.tags.length > 0 && (
          <div className="fj-tag-row">
            {recipe.tags.map((t) => (
              <span key={t} className="fj-tag">
                {RECIPE_TAG_LABELS[t]}
              </span>
            ))}
          </div>
        )}
        <div className="fj-recipe-meta">
          {totalTime > 0 && <span>{totalTime} min</span>}
          {recipe.servings > 0 && <span>{recipe.servings} servings</span>}
          <span>{recipe.ingredients.length} ingredients</span>
        </div>
        {(calories != null || protein != null) && (
          <div className="fj-recipe-card__macros">
            {calories != null && <span>{Math.round(calories)} cal</span>}
            {protein != null && <span>{Math.round(protein)}g protein</span>}
          </div>
        )}
      </div>
    </Card>
  )
}

function RecipeModal({
  recipeId,
  onClose,
}: {
  recipeId: string | null
  onClose: () => void
}) {
  const { data, saveRecipe } = useStore()
  const { showToast } = useToast()
  const existing = recipeId ? (data.recipes.find((r) => r.id === recipeId) ?? null) : null
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(existing?.name ?? '')
  const [tags, setTags] = useState<RecipeTag[]>(existing?.tags ?? [])
  const [prep, setPrep] = useState(existing ? String(existing.prepTime) : '')
  const [cook, setCook] = useState(existing ? String(existing.cookTime) : '')
  const [servings, setServings] = useState(existing ? String(existing.servings) : '')
  const [ingredients, setIngredients] = useState(existing?.ingredients.join('\n') ?? '')
  const [steps, setSteps] = useState(existing?.steps.join('\n') ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [photo, setPhoto] = useState<string | undefined>(existing?.photo)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [calories, setCalories] = useState(macroStr(existing?.nutrition?.calories))
  const [protein, setProtein] = useState(macroStr(existing?.nutrition?.protein))
  const [carbs, setCarbs] = useState(macroStr(existing?.nutrition?.carbs))
  const [fat, setFat] = useState(macroStr(existing?.nutrition?.fat))

  const toggleTag = (t: RecipeTag): void =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))

  const pickPhoto = (file: File): void => {
    setPhotoBusy(true)
    downscaleImage(file)
      .then((url) => setPhoto(url))
      .catch((e: unknown) =>
        showToast(e instanceof Error ? e.message : 'Could not add that photo', 'warning'),
      )
      .finally(() => setPhotoBusy(false))
  }

  const save = (): void => {
    const trimmed = name.trim()
    if (!trimmed) {
      showToast('Give the recipe a name', 'warning')
      return
    }
    const recipe: Recipe = {
      id: existing?.id ?? uid(),
      name: trimmed,
      tags,
      prepTime: clampNum(prep),
      cookTime: clampNum(cook),
      servings: clampNum(servings),
      ingredients: splitLines(ingredients),
      steps: splitLines(steps),
      notes: notes.trim(),
      favorite: existing?.favorite ?? false,
      createdAt: existing?.createdAt ?? todayKey(),
    }
    if (photo) recipe.photo = photo
    const nutrition = buildNutrition(calories, protein, carbs, fat)
    if (nutrition) recipe.nutrition = nutrition
    saveRecipe(recipe)
    showToast(existing ? 'Recipe updated' : 'Recipe added', 'success')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? 'Edit recipe' : 'Add recipe'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save recipe</Button>
        </>
      }
    >
      <div className="fj-col" style={{ gap: 'var(--space-4)' }}>
        <Input
          label="Recipe name"
          placeholder="e.g. Chicken Stir Fry"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <div className="fj-field">
          <label className="fj-field__label">Photo</label>
          {photo ? (
            <div className="fj-photo-edit">
              <img src={photo} alt="" className="fj-photo-edit__img" />
              <div className="fj-photo-edit__actions">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoBusy}
                >
                  {photoBusy ? 'Working…' : 'Replace'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPhoto(undefined)}>
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="fj-photo-add"
              onClick={() => photoInputRef.current?.click()}
              disabled={photoBusy}
            >
              <Camera size={18} />
              {photoBusy ? 'Adding photo…' : 'Add a photo'}
            </button>
          )}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) pickPhoto(file)
              e.target.value = ''
            }}
          />
        </div>
        <div className="fj-field">
          <label className="fj-field__label">Tags</label>
          <div className="fj-row">
            {RECIPE_TAGS.map((t) => (
              <Chip key={t} active={tags.includes(t)} onClick={() => toggleTag(t)}>
                {RECIPE_TAG_LABELS[t]}
              </Chip>
            ))}
          </div>
        </div>
        <div className="fj-row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <Input
              label="Prep (min)"
              type="number"
              min={0}
              value={prep}
              onChange={(e) => setPrep(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Input
              label="Cook (min)"
              type="number"
              min={0}
              value={cook}
              onChange={(e) => setCook(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Input
              label="Servings"
              type="number"
              min={0}
              value={servings}
              onChange={(e) => setServings(e.target.value)}
            />
          </div>
        </div>
        <div className="fj-field">
          <label className="fj-field__label">Nutrition per serving (optional)</label>
          <div className="fj-macros-input">
            <Input
              label="Calories"
              type="number"
              min={0}
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
            />
            <Input
              label="Protein (g)"
              type="number"
              min={0}
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
            />
            <Input
              label="Carbs (g)"
              type="number"
              min={0}
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
            />
            <Input
              label="Fat (g)"
              type="number"
              min={0}
              value={fat}
              onChange={(e) => setFat(e.target.value)}
            />
          </div>
        </div>
        <div className="fj-field">
          <label className="fj-field__label">Ingredients (one per line)</label>
          <textarea
            className="fj-input"
            rows={5}
            style={{ resize: 'vertical' }}
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
          />
        </div>
        <div className="fj-field">
          <label className="fj-field__label">Steps (one per line)</label>
          <textarea
            className="fj-input"
            rows={5}
            style={{ resize: 'vertical' }}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
          />
        </div>
        <div className="fj-field">
          <label className="fj-field__label">Notes (optional)</label>
          <textarea
            className="fj-input"
            rows={2}
            style={{ resize: 'vertical' }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  )
}

function RecipeDetail({
  recipeId,
  onClose,
  onEdit,
}: {
  recipeId: string
  onClose: () => void
  onEdit: (id: string) => void
}) {
  const { data, deleteRecipe, restoreRecipe } = useStore()
  const { showToast } = useToast()
  const recipe = data.recipes.find((x) => x.id === recipeId)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [cooking, setCooking] = useState(false)
  const [servings, setServings] = useState<number>(() =>
    recipe && recipe.servings > 0 ? recipe.servings : 1,
  )
  if (!recipe) return null
  const r = recipe
  const totalTime = r.prepTime + r.cookTime
  const factor = r.servings > 0 ? servings / r.servings : 1
  const nutrition = r.nutrition
  const hasMacros =
    !!nutrition &&
    (nutrition.calories != null ||
      nutrition.protein != null ||
      nutrition.carbs != null ||
      nutrition.fat != null)

  const toggleChecked = (i: number): void =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={r.name}
        footer={
          <>
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => onEdit(r.id)}>Edit</Button>
          </>
        }
      >
        <div className="fj-col" style={{ gap: 'var(--space-4)' }}>
          {r.photo && (
            <div className="fj-recipe-hero">
              <img src={r.photo} alt="" />
            </div>
          )}
          {r.tags.length > 0 && (
            <div className="fj-tag-row">
              {r.tags.map((t) => (
                <span key={t} className="fj-tag">
                  {RECIPE_TAG_LABELS[t]}
                </span>
              ))}
            </div>
          )}
          <div className="fj-recipe-meta">
            {r.prepTime > 0 && <span>Prep {r.prepTime} min</span>}
            {r.cookTime > 0 && <span>Cook {r.cookTime} min</span>}
            {totalTime > 0 && <span>Total {totalTime} min</span>}
          </div>
          {hasMacros && nutrition && (
            <div>
              <h3 className="fj-detail-sub">
                Nutrition <span className="fj-muted">· per serving</span>
              </h3>
              <div className="fj-macros">
                {nutrition.calories != null && (
                  <Macro value={nutrition.calories} label="Calories" />
                )}
                {nutrition.protein != null && (
                  <Macro value={nutrition.protein} label="Protein (g)" />
                )}
                {nutrition.carbs != null && <Macro value={nutrition.carbs} label="Carbs (g)" />}
                {nutrition.fat != null && <Macro value={nutrition.fat} label="Fat (g)" />}
              </div>
            </div>
          )}
          {r.servings > 0 && (
            <div className="fj-scaler">
              <span className="fj-field__label">Servings</span>
              <div className="fj-scaler__control">
                <button
                  type="button"
                  className="fj-scaler__btn"
                  aria-label="Fewer servings"
                  onClick={() => setServings((s) => Math.max(1, s - 1))}
                  disabled={servings <= 1}
                >
                  <Minus size={16} />
                </button>
                <span className="fj-scaler__value">{servings}</span>
                <button
                  type="button"
                  className="fj-scaler__btn"
                  aria-label="More servings"
                  onClick={() => setServings((s) => Math.min(99, s + 1))}
                >
                  <Plus size={16} />
                </button>
              </div>
              {servings !== r.servings && (
                <button
                  type="button"
                  className="fj-scaler__reset"
                  onClick={() => setServings(r.servings)}
                >
                  Reset to {r.servings}
                </button>
              )}
            </div>
          )}
          {r.ingredients.length > 0 && (
            <div>
              <h3 className="fj-detail-sub">Ingredients</h3>
              <ul className="fj-ingredient-list">
                {r.ingredients.map((ing, i) => {
                  const isChecked = checked.has(i)
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        className={cn('fj-ingredient', isChecked && 'fj-ingredient--checked')}
                        aria-pressed={isChecked}
                        onClick={() => toggleChecked(i)}
                      >
                        <span className="fj-ingredient__box" aria-hidden="true">
                          {isChecked && <Check size={13} />}
                        </span>
                        <span>{scaleIngredient(ing, factor)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {r.steps.length > 0 && (
            <div>
              <div
                className="fj-row"
                style={{
                  justifyContent: 'space-between',
                  marginBottom: 'var(--space-2)',
                }}
              >
                <h3 className="fj-detail-sub" style={{ margin: 0 }}>Steps</h3>
                <Button size="sm" variant="secondary" onClick={() => setCooking(true)}>
                  <ChefHat size={15} /> Cook mode
                </Button>
              </div>
              <ol className="fj-recipe-steps">
                {r.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          )}
          {r.notes && (
            <div>
              <h3 className="fj-detail-sub">Notes</h3>
              <p className="fj-muted">{r.notes}</p>
            </div>
          )}
        </div>
        <ConfirmModal
          open={confirmingDelete}
          title="Delete this recipe?"
          message={`"${r.name}" and its ingredients, steps and notes will be permanently removed.`}
          onConfirm={() => {
            const index = data.recipes.findIndex((x) => x.id === r.id)
            deleteRecipe(r.id)
            onClose()
            showToast('Recipe deleted', 'default', {
              label: 'Undo',
              onAction: () => restoreRecipe(r, index),
            })
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      </Modal>
      {cooking && (
        <CookMode recipeName={r.name} steps={r.steps} onClose={() => setCooking(false)} />
      )}
    </>
  )
}

function Macro({ value, label }: { value: number; label: string }) {
  return (
    <div className="fj-macro">
      <span className="fj-macro__value">{value}</span>
      <span className="fj-macro__label">{label}</span>
    </div>
  )
}

/**
 * Full-screen, one-step-at-a-time cook view. Keeps the screen awake via
 * Screen Wake Lock where supported; degrades silently otherwise.
 */
function CookMode({
  recipeName,
  steps,
  onClose,
}: {
  recipeName: string
  steps: string[]
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const [wakeLockDenied, setWakeLockDenied] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Focus the dialog on mount so the keyboard shortcuts work without a click.
  useEffect(() => {
    rootRef.current?.focus()
  }, [])

  // Best-effort screen wake lock. The OS drops it when the page is hidden,
  // so re-acquire on return. Unsupported browsers silently do nothing.
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null
    let released = false

    const acquire = (): void => {
      if (released || document.visibilityState !== 'visible') return
      const api = navigator.wakeLock
      if (!api) {
        setWakeLockDenied(true)
        return
      }
      api
        .request('screen')
        .then((s) => {
          if (released) void s.release().catch(() => {})
          else {
            sentinel = s
            setWakeLockActive(true)
          }
        })
        .catch(() => {
          setWakeLockDenied(true)
        })
    }

    acquire()
    const onVisible = (): void => {
      if (
        document.visibilityState === 'visible' &&
        (sentinel === null || sentinel.released)
      ) {
        acquire()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release().catch(() => {})
    }
  }, [])

  const atFirst = index === 0
  const atLast = index === steps.length - 1
  const prev = (): void => setIndex((i) => Math.max(0, i - 1))
  const next = (): void => setIndex((i) => Math.min(steps.length - 1, i + 1))

  return (
    <div
      className="fj-cook"
      role="dialog"
      aria-modal="true"
      aria-label={`Cook mode — ${recipeName}`}
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        } else if (e.key === 'ArrowLeft') {
          prev()
        } else if (e.key === 'ArrowRight') {
          next()
        }
      }}
    >
      <div className="fj-cook__bar">
        <span className="fj-cook__count">
          Step {index + 1} of {steps.length}
        </span>
        {wakeLockActive && !wakeLockDenied && (
          <span className="fj-cook__wakelock" aria-live="polite">Screen stays on</span>
        )}
        {wakeLockDenied && (
          <span className="fj-cook__wakelock fj-cook__wakelock--dim" aria-live="polite">Screen may dim</span>
        )}
        <button
          type="button"
          className="fj-icon-btn"
          aria-label="Exit cook mode"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="fj-cook__body">
        <div className="fj-cook__stepnum">{index + 1}</div>
        <p className="fj-cook__text">{steps[index]}</p>
      </div>
      <div className="fj-cook__nav">
        <Button variant="secondary" onClick={prev} disabled={atFirst}>
          <ChevronLeft size={18} /> Back
        </Button>
        {atLast ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <Button onClick={next}>
            Next <ChevronRight size={18} />
          </Button>
        )}
      </div>
    </div>
  )
}
