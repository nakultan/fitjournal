import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  /** Helper text shown below the field. */
  hint?: string
  /** Error text — replaces the hint and marks the field invalid. */
  error?: string
}

export function Input({ label, hint, error, className, id, ...props }: InputProps) {
  const autoId = useId()
  const inputId = id ?? autoId

  return (
    <div className="fj-field">
      {label && (
        <label className="fj-field__label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn('fj-input', error && 'fj-input--error', className)}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error ? (
        <span className="fj-field__error">{error}</span>
      ) : hint ? (
        <span className="fj-field__hint">{hint}</span>
      ) : null}
    </div>
  )
}
