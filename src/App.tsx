import { Showcase } from '@/pages/Showcase'
import { InstallHint, UpdatePrompt } from '@/components'

/**
 * Phase 1: the app renders the design-system showcase.
 * Phase 2 replaces this with the real navigation + screens.
 */
export default function App() {
  return (
    <>
      <Showcase />
      <InstallHint />
      <UpdatePrompt />
    </>
  )
}
