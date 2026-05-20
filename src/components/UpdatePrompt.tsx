import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from './Button'

/**
 * Shows two PWA states:
 *  - "ready to work offline" — confirmed the first time the app is cached.
 *  - "new version available" — lets the user reload to update.
 */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!offlineReady && !needRefresh) return null

  const dismiss = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <div className="fj-sw-toast" role="alert">
      <span className="fj-sw-toast__msg">
        {needRefresh ? 'A new version is available.' : 'Ready to work offline.'}
      </span>
      <div className="fj-sw-toast__actions">
        {needRefresh && (
          <Button size="sm" onClick={() => void updateServiceWorker(true)}>
            Reload
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={dismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  )
}
