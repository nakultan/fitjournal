import { StoreProvider } from '@/data/store'
import { AppShell } from '@/components/AppShell'
import {
  BackupReminder,
  FirstRun,
  InstallHint,
  ResumeSessionPill,
  SaveErrorBanner,
  SyncConflictBanner,
  UpdatePrompt,
} from '@/components'

export default function App() {
  return (
    <StoreProvider>
      <SaveErrorBanner />
      <SyncConflictBanner />
      <AppShell />
      <ResumeSessionPill />
      <FirstRun />
      <BackupReminder />
      <InstallHint />
      <UpdatePrompt />
    </StoreProvider>
  )
}
