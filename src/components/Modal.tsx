import { useEffect, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

/** Elements inside the dialog that can receive keyboard focus. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** Optional footer area, typically action buttons. */
  footer?: ReactNode
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // On open, move focus into the dialog; on close, return it where it was.
  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    const restoreTo = document.activeElement as HTMLElement | null
    if (dialog && !dialog.contains(restoreTo)) {
      const first = dialog.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? dialog).focus()
    }
    return () => restoreTo?.focus?.()
  }, [open])

  if (!open) return null

  // Escape closes; Tab is trapped within the dialog. Handling this on the
  // dialog (not window) means a stacked modal handles it first and stops it,
  // so only the topmost dialog ever reacts.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !dialogRef.current) return
    e.stopPropagation()
    const items = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (items.length === 0) {
      e.preventDefault()
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="fj-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="fj-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {title && <h2 className="fj-modal__title">{title}</h2>}
        <div className="fj-modal__body">{children}</div>
        {footer && <div className="fj-modal__footer">{footer}</div>}
      </div>
    </div>
  )
}
