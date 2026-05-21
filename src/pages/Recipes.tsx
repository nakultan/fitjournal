import { useState } from 'react'
import { Plus, Star, UtensilsCrossed } from 'lucide-react'
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
import type { Recipe, RecipeTag } from '@/data/types'
import { uid } from '@/lib/uid'
import { todayKey } from '@/lib/dates'

export function RecipesScreen() {
  const { data } = useStore()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<{ id: string | null } | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const toggleFilter = (tag: string) =>
    setFilters((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })

  const q = search.trim().toLowerCase()
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
        />
        <Chip active={filters.has('_fav')} onClick={() => toggleFilter('_fav')}>
          ★ Favorites
        </Chip>
        {RECIPE_TAGS.map((t) => (
          <Chip key={t} active={filters.has(t)} onClick={() => toggleFilter(t)}>
            {RECIPE_TAG_LABELS[t]}
          </Chip>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="fj-card-grid">
          {filtered.map((r) => (
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
        <RecipeModal key={editing.id ?? 'new'} recipeId={editing.id} onClose={() => setEditing(null)} />
      )}
      {detailId && (
        <RecipeDetail
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
  return (
    <Card className="fj-recipe-card" onClick={onOpen}>
      <div className="fj-recipe-card__head">
        <span className="fj-recipe-card__title">{recipe.name}</span>
        <button
          className={'fj-fav-btn' + (recipe.favorite ? ' fj-fav-btn--on' : '')}
          aria-label="Toggle favorite"
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
    </Card>
  )
}

function RecipeModal({ recipeId, onClose }: { recipeId: string | null; onClose: () => void }) {
  const { data, saveRecipe } = useStore()
  const { showToast } = useToast()
  const existing = recipeId ? (data.recipes.find((r) => r.id === recipeId) ?? null) : null

  const [name, setName] = useState(existing?.name ?? '')
  const [tags, setTags] = useState<RecipeTag[]>(existing?.tags ?? [])
  const [prep, setPrep] = useState(existing ? String(existing.prepTime) : '')
  const [cook, setCook] = useState(existing ? String(existing.cookTime) : '')
  const [servings, setServings] = useState(existing ? String(existing.servings) : '')
  const [ingredients, setIngredients] = useState(existing?.ingredients.join('\n') ?? '')
  const [steps, setSteps] = useState(existing?.steps.join('\n') ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')

  const toggleTag = (t: RecipeTag) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      showToast('Give the recipe a name', 'warning')
      return
    }
    saveRecipe({
      id: existing?.id ?? uid(),
      name: trimmed,
      tags,
      prepTime: Number(prep) || 0,
      cookTime: Number(cook) || 0,
      servings: Number(servings) || 0,
      ingredients: ingredients
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      steps: steps
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      notes: notes.trim(),
      favorite: existing?.favorite ?? false,
      createdAt: existing?.createdAt ?? todayKey(),
    })
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
            <Input label="Prep (min)" type="number" value={prep} onChange={(e) => setPrep(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <Input label="Cook (min)" type="number" value={cook} onChange={(e) => setCook(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <Input
              label="Servings"
              type="number"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
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
  const { data, deleteRecipe } = useStore()
  const { showToast } = useToast()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const r = data.recipes.find((x) => x.id === recipeId)
  if (!r) return null
  const totalTime = r.prepTime + r.cookTime

  return (
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
          {r.servings > 0 && <span>{r.servings} servings</span>}
        </div>
        {r.ingredients.length > 0 && (
          <div>
            <div className="fj-field__label" style={{ marginBottom: 'var(--space-2)' }}>
              Ingredients
            </div>
            <ul className="fj-recipe-ingredients">
              {r.ingredients.map((ing, i) => (
                <li key={i}>{ing}</li>
              ))}
            </ul>
          </div>
        )}
        {r.steps.length > 0 && (
          <div>
            <div className="fj-field__label" style={{ marginBottom: 'var(--space-2)' }}>
              Steps
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
            <div className="fj-field__label" style={{ marginBottom: 'var(--space-2)' }}>
              Notes
            </div>
            <p className="fj-muted">{r.notes}</p>
          </div>
        )}
      </div>
      <ConfirmModal
        open={confirmingDelete}
        title="Delete this recipe?"
        message={`"${r.name}" and its ingredients, steps and notes will be permanently removed.`}
        onConfirm={() => {
          deleteRecipe(r.id)
          showToast('Recipe deleted')
          onClose()
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </Modal>
  )
}
