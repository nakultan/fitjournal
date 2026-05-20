/**
 * Join class names, dropping anything falsy.
 *
 *   cn('fj-btn', isActive && 'fj-btn--active', className)
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
