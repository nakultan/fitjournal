/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/info" />

interface ImportMetaEnv {
  /** Supabase project URL — set in `.env.local` (dev) / CI secrets (build). */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon (public) key — safe in the browser; RLS protects the data. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
