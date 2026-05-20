import { StoreProvider } from '@/data/store'
import { AppShell } from '@/components/AppShell'
import { InstallHint, UpdatePrompt } from '@/components'

export default function App() {
  return (
    <StoreProvider>
      <AppShell />
      <InstallHint />
      <UpdatePrompt />
    </StoreProvider>
  )
}
