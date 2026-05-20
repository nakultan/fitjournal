import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { ToastContext } from './toast-context'
import type { ToastVariant } from './toast-context'

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

const TOAST_DURATION_MS = 3200

/**
 * Wraps the app and renders a stack of transient messages.
 * Trigger one from anywhere with the `useToast` hook.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const showToast = useCallback((message: string, variant: ToastVariant = 'default') => {
    const id = ++idRef.current
    setToasts((current) => [...current, { id, message, variant }])
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id))
    }, TOAST_DURATION_MS)
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fj-toaster" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cn('fj-toast', `fj-toast--${t.variant}`)}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
