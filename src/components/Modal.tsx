import { useEffect, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode, SyntheticEvent } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** Optional footer area, typically action buttons. */
  footer?: ReactNode
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Use the native dialog top-layer + focus trap by calling showModal/close.
  // Capture the prior focus on open so we restore it on close — the browser
  // restores focus to whatever fired the showing, but it can be wrong when the
  // trigger has since unmounted (e.g. row-action menus).
  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return
    const restoreTo = document.activeElement as HTMLElement | null
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
      restoreTo?.focus?.()
    }
  }, [open])

  if (!open) return null

  // Backdrop click — the click lands on the <dialog> element itself when the
  // user clicks outside the rendered box. Use the bounding rect to distinguish.
  const onClick = (e: ReactMouseEvent<HTMLDialogElement>) => {
    if (e.target !== dialogRef.current) return
    const rect = dialogRef.current.getBoundingClientRect()
    const inside =
      rect.top <= e.clientY &&
      e.clientY <= rect.bottom &&
      rect.left <= e.clientX &&
      e.clientX <= rect.right
    if (!inside) onClose()
  }

  // The cancel event fires on Escape. Prevent the default (which would close
  // the dialog without informing React) and route through our onClose.
  const onCancel = (e: SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault()
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="fj-modal"
      aria-label={title}
      onClick={onClick}
      onCancel={onCancel}
    >
      {title && <h2 className="fj-modal__title">{title}</h2>}
      <div className="fj-modal__body">{children}</div>
      {footer && <div className="fj-modal__footer">{footer}</div>}
    </dialog>
  )
}
