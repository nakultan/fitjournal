import { useEffect, useState } from 'react'
import { Button } from './Button'

/** The browser event fired when a PWA can be installed (Chrome/Edge). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Offers an "Install" button when the browser says the app is installable.
 * On browsers that don't fire the event (e.g. Safari), this renders nothing —
 * there, the user installs via Share → Add to Home Screen.
 */
export function InstallHint() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!deferred) return null

  const install = async () => {
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  return (
    <div className="fj-install-hint">
      <span>Install FitJournal as an app</span>
      <Button size="sm" onClick={() => void install()}>
        Install
      </Button>
    </div>
  )
}
