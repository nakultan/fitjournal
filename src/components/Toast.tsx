import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { ToastContext } from './toast-context'
import type { ToastAction, ToastVariant } from './toast-context'

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
  action?: ToastAction
}

const TOAST_DURATION_MS = 3200
/** Toasts with an action linger longer, so there's time to click it. */
const ACTION_TOAST_DURATION_MS = 6500

/**
 * Wraps the app and renders a stack of transient messages.
 * Trigger one from anywhere with the `useToast` hook.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'default', action?: ToastAction) => {
      const id = ++idRef.current
      setToasts((current) => [...current, { id, message, variant, action }])
      setTimeout(() => dismiss(id), action ? ACTION_TOAST_DURATION_MS : TOAST_DURATION_MS)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fj-toaster" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cn('fj-toast', `fj-toast--${t.variant}`)}>
            <span>{t.message}</span>
            {t.action && (
              <button
                className="fj-toast__action"
                onClick={() => {
                  t.action?.onAction()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
