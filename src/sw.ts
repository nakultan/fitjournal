/// <reference lib="webworker" />
/**
 * FitJournal service worker.
 *
 * Two jobs:
 *   1. Precache the whole app for offline use (the same behaviour the
 *      auto-generated SW used to provide; injected by vite-plugin-pwa at
 *      build time as `self.__WB_MANIFEST`).
 *   2. Handle Web Push for the closed-app streak-save reminder (P2.5
 *      follow-through). The Supabase Edge Function fires a literal
 *      `{"type":"streak"}` payload once a minute, per due subscription —
 *      this SW reads the on-device journal to decide *what copy* to show,
 *      so daily workout state never leaves the device.
 */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | { revision: string | null; url: string })[]
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

const ICON_URL = self.registration.scope + 'pwa-192.png'
const OPEN_URL = self.registration.scope + '#/today'

/** Local YYYY-MM-DD for `new Date()`. Inlined so the SW stays self-contained
 *  rather than importing from `lib/dates.ts` (avoids any bundling surprise). */
function todayKey(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Opens the journal's IndexedDB and resolves true when today has any
 *  exercises or cardio logged. Resolves false on any error so the nudge is
 *  shown when in doubt (better to over-remind than to silently swallow). */
function isTodayLogged(): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const done = (v: boolean): void => {
      if (!settled) {
        settled = true
        resolve(v)
      }
    }
    try {
      const req = indexedDB.open('fitjournal', 1)
      req.onerror = () => done(false)
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction('journal', 'readonly')
          const get = tx.objectStore('journal').get('appdata')
          get.onerror = () => done(false)
          get.onsuccess = () => {
            const data = get.result as
              | {
                  workouts?: Record<
                    string,
                    { exercises?: unknown[]; cardio?: unknown[] }
                  >
                }
              | undefined
            const w = data?.workouts?.[todayKey()]
            const logged =
              !!w &&
              ((Array.isArray(w.exercises) && w.exercises.length > 0) ||
                (Array.isArray(w.cardio) && w.cardio.length > 0))
            done(logged)
          }
        } catch {
          done(false)
        }
      }
    } catch {
      done(false)
    }
  })
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      if (await isTodayLogged()) {
        // No nudge needed — the user already trained today. Safari/WebKit
        // doesn't enforce the userVisibleOnly "show a notification per push"
        // rule, and Chromium's enforcement is loose enough at one silent
        // push per "logged" day that this stays well under the spam
        // threshold. Worst case on Chrome: the site eventually loses push
        // permission and the user re-grants it.
        return
      }
      await self.registration.showNotification('FitJournal', {
        body: "Don't break your streak — log today's workout.",
        tag: 'fj-streak-nudge',
        icon: ICON_URL,
        badge: ICON_URL,
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const c of all) {
        if ('focus' in c) {
          await (c as WindowClient).focus()
          return
        }
      }
      await self.clients.openWindow(OPEN_URL)
    })(),
  )
})
