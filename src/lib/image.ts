/**
 * Downscale a picked image file to a small JPEG data-URL. Recipe photos live
 * inside the on-device journal and its JSON backup, so they are capped well
 * below a full-resolution photo to keep both small.
 */

/** Longest edge of a stored photo, in pixels. */
const MAX_EDGE = 1280
/** JPEG quality — high enough to look good, low enough to stay compact. */
const QUALITY = 0.82

/**
 * Read an image file and resolve to a downscaled JPEG data-URL. Rejects when
 * the file cannot be read or decoded as an image.
 */
export function downscaleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('That image could not be read.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('That file is not a readable image.'))
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
        const width = Math.max(1, Math.round(img.width * scale))
        const height = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Image processing is unavailable on this device.'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', QUALITY))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
