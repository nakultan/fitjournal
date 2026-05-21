import { StoreProvider } from '@/data/store'
import { AppShell } from '@/components/AppShell'
import { BackupReminder, InstallHint, SaveErrorBanner, UpdatePrompt } from '@/components'

export default function App() {
  return (
    <StoreProvider>
      <SaveErrorBanner />
      <AppShell />
      <BackupReminder />
      <InstallHint />
      <UpdatePrompt />
    </StoreProvider>
  )
}
