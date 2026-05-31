/**
 * `pushManager.subscribe()` expects the VAPID applicationServerKey as a raw
 * Uint8Array, but VAPID keys are distributed as URL-safe base64. This
 * converts one to the other — small, self-contained, and the standard
 * recipe straight from the Web Push spec examples.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  // Constructing from an explicit `ArrayBuffer` (rather than `new
  // Uint8Array(N)`) makes the return type `Uint8Array<ArrayBuffer>` rather
  // than `Uint8Array<ArrayBufferLike>`, which is what
  // `pushManager.subscribe({ applicationServerKey })` requires.
  const buffer = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
