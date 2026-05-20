import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Highlight the chip as selected. */
  active?: boolean
}

export function Chip({ active, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn('fj-chip', active && 'fj-chip--active', className)}
      {...props}
    />
  )
}
