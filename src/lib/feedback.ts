/**
 * Tiny, dependency-free celebratory feedback — a soft chime and a haptic tap.
 * Everything here degrades silently when the browser doesn't support it, so it
 * is always safe to call. No audio files: the chime is synthesised on the fly.
 */

/** A short, gentle two-note chime via the Web Audio API. */
function playChime(): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    const notes = [523.25, 783.99] // C5 → G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.14
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.16, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.55)
    })
    setTimeout(() => void ctx.close(), 1200)
  } catch {
    /* audio unavailable — silent fallback */
  }
}

/** A brief haptic tap, where the device/browser supports it. */
function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* vibration unsupported */
  }
}

/** Fire the full celebration feedback — a chime plus a haptic tap. */
export function celebrate(): void {
  playChime()
  vibrate([0, 22, 40, 22])
}

/** A single soft haptic tap — a quiet "done" confirmation, no sound. */
export function tap(): void {
  vibrate(18)
}
