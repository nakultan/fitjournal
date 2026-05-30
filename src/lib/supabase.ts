/**
 * Supabase client — the single seam between FitJournal and the sync backend.
 *
 * The app is offline-first: IndexedDB stays the source of truth and sync is a
 * layer on top (see `data/sync.ts`). This module only hands out a configured
 * client and an auth helper; it never reads or writes app data directly.
 *
 * Both env vars are the *public* anon key + URL — safe to ship in a browser
 * build. Row-Level Security (`auth.uid() = user_id`) is what actually keeps a
 * user's rows private. The service_role key must never appear in frontend code.
 *
 * Moving to a self-hosted Supabase later (e.g. on Oracle) is just changing
 * these two env vars — nothing else in the app needs to know.
 */
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * True when both Supabase env vars are present. When false the app runs
 * exactly as it does today — fully local, no account, no network — so a build
 * without credentials (or a fork) degrades cleanly to the offline-only app.
 */
export const isSyncConfigured = Boolean(url && anonKey)

/**
 * The shared Supabase client, or null when sync isn't configured. Created once
 * and reused. Auth sessions persist + auto-refresh via the SDK default
 * (localStorage), so a signed-in user stays signed in across reloads.
 */
export const supabase: SupabaseClient | null = isSyncConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // No OAuth redirect codes to parse out of the URL — magic-link and
        // password flows land the session directly.
        detectSessionInUrl: true,
      },
    })
  : null
