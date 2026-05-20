import { useId } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: SelectOption[]
}

export function Select({ label, options, className, id, ...props }: SelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId

  return (
    <div className="fj-field">
      {label && (
        <label className="fj-field__label" htmlFor={selectId}>
          {label}
        </label>
      )}
      <select id={selectId} className={cn('fj-select', className)} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
