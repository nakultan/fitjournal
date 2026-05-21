import { useId } from 'react'
import { cn } from '@/lib/cn'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  /** Accessible name to use when there is no visible `label` (it sits elsewhere). */
  ariaLabel?: string
}

export function Toggle({ checked, onChange, label, ariaLabel }: ToggleProps) {
  const labelId = useId()

  return (
    <div className="fj-toggle-row">
      {label && (
        <span id={labelId} className="fj-toggle-row__label">
          {label}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : ariaLabel}
        className={cn('fj-toggle', checked && 'fj-toggle--on')}
        onClick={() => onChange(!checked)}
      >
        <span className="fj-toggle__knob" />
      </button>
    </div>
  )
}
