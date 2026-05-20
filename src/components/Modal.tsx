import { useEffect } from 'react'
import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** Optional footer area, typically action buttons. */
  footer?: ReactNode
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  // Close on Escape while the modal is open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fj-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="fj-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className="fj-modal__title">{title}</h2>}
        <div className="fj-modal__body">{children}</div>
        {footer && <div className="fj-modal__footer">{footer}</div>}
      </div>
    </div>
  )
}
