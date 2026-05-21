import type { ReactNode } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: ReactNode
  /** Label for the confirm button. Defaults to "Delete". */
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * A small yes/no dialog for destructive actions. The confirm button is styled
 * as a danger action; cancelling (button, overlay or Escape) is the safe path.
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message}
    </Modal>
  )
}
