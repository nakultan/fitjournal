import { createContext, useContext } from 'react'

export type ToastVariant = 'default' | 'success' | 'warning'

/** An optional action button shown inside a toast (e.g. an "Undo"). */
export interface ToastAction {
  label: string
  onAction: () => void
}

export interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant, action?: ToastAction) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

/** Show a transient message from anywhere in the app. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>')
  }
  return ctx
}
