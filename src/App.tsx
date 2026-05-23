import { StoreProvider } from '@/data/store'
import { AppShell } from '@/components/AppShell'
import {
  BackupReminder,
  FirstRun,
  InstallHint,
  SaveErrorBanner,
  UpdatePrompt,
} from '@/components'

export default function App() {
  return (
    <StoreProvider>
      <SaveErrorBanner />
      <AppShell />
      <FirstRun />
      <BackupReminder />
      <InstallHint />
      <UpdatePrompt />
    </StoreProvider>
  )
}
