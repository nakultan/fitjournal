import { ChevronDown, ChevronUp } from 'lucide-react'

/**
 * A vertically stacked Up/Down pair for moving a row within a list — drag-
 * drop is fiddly on mobile, so the tap-based controls are the safer fit. The
 * outer div swallows clicks/keydowns so the buttons don't accidentally
 * trigger an enclosing clickable row.
 */
export function ReorderButtons({
  canUp,
  canDown,
  onUp,
  onDown,
}: {
  canUp: boolean
  canDown: boolean
  onUp: () => void
  onDown: () => void
}) {
  return (
    <div
      className="fj-reorder"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="fj-reorder__btn"
        aria-label="Move up"
        disabled={!canUp}
        onClick={onUp}
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        className="fj-reorder__btn"
        aria-label="Move down"
        disabled={!canDown}
        onClick={onDown}
      >
        <ChevronDown size={14} />
      </button>
    </div>
  )
}
