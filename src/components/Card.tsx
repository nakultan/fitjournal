import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Apply standard internal padding. Default true. */
  padded?: boolean
}

export function Card({ padded = true, className, ...props }: CardProps) {
  return <div className={cn('fj-card', padded && 'fj-card--padded', className)} {...props} />
}
