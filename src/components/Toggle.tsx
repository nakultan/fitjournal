import { useId } from 'react'
import { cn } from '@/lib/cn'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
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
        className={cn('fj-toggle', checked && 'fj-toggle--on')}
        onClick={() => onChange(!checked)}
      >
        <span className="fj-toggle__knob" />
      </button>
    </div>
  )
}
