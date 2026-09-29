// Turns a UV photo of a handled note into a touch mask aligned to the reference artwork.
// Pipeline: rotate upright → straighten the note quad → classify fluorescent ink by colour.
import type { Extraction, InkSettings } from '@/data/types'

// Calibrated on the UV photos: the lit note is saturated blue (hue ~215–235°). Pink ink shifts the hue
// past ~255°, green ink sits at 45–170°, and pale ink photographs as bright cyan (~170–195°), so it is
// told apart by hue rather than saturation. Truly white smudges are caught by low saturation.
export const DEFAULT_INK: InkSettings = {
  minValue: 0.3,
  pinkHue: 255,
  pinkSaturation: 0.25,
  greenSaturation: 0.3,
  greenHue: 170,
  cyanHue: 200,
  paleSaturation: 0.4,
  paleValue: 0.6,
}

/** Long edge of the saved mask, in pixels */
export const MASK_LONG_EDGE = 360

type Rotation = Extraction['rotation']
type Corners = Extraction['corners']

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Could not load ${src}`))
    img.src = src
  })
}

/** Upright copy of the photo, scaled so its long edge is `longEdge` */
export function rotated(img: HTMLImageElement, rotation: Rotation, longEdge = 900): ImageData {
  const s = longEdge / Math.max(img.naturalWidth, img.naturalHeight)
  const w = Math.round(img.naturalWidth * s)
  const h = Math.round(img.naturalHeight * s)
  const swap = rotation === 90 || rotation === 270
  const canvas = document.createElement('canvas')
  canvas.width = swap ? h : w
  canvas.height = swap ? w : h
  const ctx = canvas.getContext('2d')!
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/** Bounding box of the lit note against the darker surroundings */
export function autoCorners(data: ImageData): Corners {
  const { width, height, data: px } = data
  const lit = (x: number, y: number) => {
    const o = (y * width + x) * 4
    return Math.max(px[o], px[o + 1], px[o + 2]) > 70
  }
  // A row/column counts as note once most of it is lit, which ignores stray bright specks.
  const rowLit = (y: number) => {
    let n = 0
    for (let x = 0; x < width; x += 2) if (lit(x, y)) n++
    return n > width / 4
  }
  const colLit = (x: number) => {
    let n = 0
    for (let y = 0; y < height; y += 2) if (lit(x, y)) n++
    return n > height / 4
  }
  let top = 0
  let bottom = height - 1
  let left = 0
  let right = width - 1
  while (top < bottom && !rowLit(top)) top++
  while (bottom > top && !rowLit(bottom)) bottom--
  while (left < right && !colLit(left)) left++
  while (right > left && !colLit(right)) right--
  const fx = (x: number) => x / width
  const fy = (y: number) => y / height
  return [
    [fx(left), fy(top)],
    [fx(right), fy(top)],
    [fx(right), fy(bottom)],
    [fx(left), fy(bottom)],
  ]
}

/** Resamples the quad inside `src` to a w×h rectangle (bilinear quad mapping) */
export function warp(src: ImageData, corners: Corners, w: number, h: number): ImageData {
  const out = new ImageData(w, h)
  const [tl, tr, br, bl] = corners.map(([x, y]) => [x * (src.width - 1), y * (src.height - 1)])
  for (let j = 0; j < h; j++) {
    const v = h === 1 ? 0 : j / (h - 1)
    for (let i = 0; i < w; i++) {
      const u = w === 1 ? 0 : i / (w - 1)
      const x =
        (1 - u) * (1 - v) * tl[0] + u * (1 - v) * tr[0] + u * v * br[0] + (1 - u) * v * bl[0]
      const y =
        (1 - u) * (1 - v) * tl[1] + u * (1 - v) * tr[1] + u * v * br[1] + (1 - u) * v * bl[1]
      const so = (Math.round(y) * src.width + Math.round(x)) * 4
      const o = (j * w + i) * 4
      out.data[o] = src.data[so]
      out.data[o + 1] = src.data[so + 1]
      out.data[o + 2] = src.data[so + 2]
      out.data[o + 3] = 255
    }
  }
  return out
}

function hsv(r: number, g: number, b: number) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max ? d / max : 0, v: max / 255 }
}

/** 1 where the pixel looks like fluorescent ink (pink, yellow-green or cyan/white), else 0 */
export function inkMask(data: ImageData, ink: InkSettings): Float32Array {
  const mask = new Float32Array(data.width * data.height)
  for (let i = 0; i < mask.length; i++) {
    const { h, s, v } = hsv(data.data[i * 4], data.data[i * 4 + 1], data.data[i * 4 + 2])
    if (v < ink.minValue) continue
    const pink = (h >= ink.pinkHue || h <= 35) && s >= ink.pinkSaturation
    const green = h >= 45 && h <= ink.greenHue && s >= ink.greenSaturation
    const pale = v >= ink.paleValue && ((h >= 150 && h <= ink.cyanHue) || s <= ink.paleSaturation)
    if (pink || green || pale) mask[i] = 1
  }
  return mask
}

/** Box blur (repeated = smooth) to turn speckled pixels into soft touch regions */
export function blur(mask: Float32Array, w: number, h: number, radius: number, passes = 2) {
  let a = mask
  for (let p = 0; p < passes; p++) {
    const tmp = new Float32Array(a.length)
    const out = new Float32Array(a.length)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0
        let n = 0
        for (let k = -radius; k <= radius; k++) {
          const xx = x + k
          if (xx < 0 || xx >= w) continue
          sum += a[y * w + xx]
          n++
        }
        tmp[y * w + x] = sum / n
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0
        let n = 0
        for (let k = -radius; k <= radius; k++) {
          const yy = y + k
          if (yy < 0 || yy >= h) continue
          sum += tmp[yy * w + x]
          n++
        }
        out[y * w + x] = sum / n
      }
    }
    a = out
  }
  return a
}

function luminance(data: ImageData) {
  const out = new Float32Array(data.width * data.height)
  for (let i = 0; i < out.length; i++) {
    out[i] = 0.299 * data.data[i * 4] + 0.587 * data.data[i * 4 + 1] + 0.114 * data.data[i * 4 + 2]
  }
  return out
}

function correlation(a: Float32Array, b: Float32Array) {
  const n = a.length
  let ma = 0
  let mb = 0
  for (let i = 0; i < n; i++) {
    ma += a[i]
    mb += b[i]
  }
  ma /= n
  mb /= n
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return num / Math.sqrt(da * db || 1)
}

export function sizeFor(aspect: number, longEdge: number) {
  return aspect >= 1
    ? { w: longEdge, h: Math.round(longEdge / aspect) }
    : { w: Math.round(longEdge * aspect), h: longEdge }
}

/**
 * Picks the rotation whose straightened photo best matches the reference artwork.
 * Dark print (numerals, portraits) stays dark under UV, so plain luminance correlation works.
 */
export function autoRotation(
  photo: HTMLImageElement,
  reference: HTMLImageElement,
  aspect: number,
): Rotation {
  const { w, h } = sizeFor(aspect, 64)
  const refCanvas = document.createElement('canvas')
  refCanvas.width = w
  refCanvas.height = h
  const rctx = refCanvas.getContext('2d')!
  rctx.drawImage(reference, 0, 0, w, h)
  const ref = luminance(rctx.getImageData(0, 0, w, h))
  const landscape = aspect >= 1
  let best: Rotation = 0
  let bestScore = -Infinity
  for (const r of [0, 90, 180, 270] as Rotation[]) {
    const up = rotated(photo, r, 400)
    // Only orientations whose shape matches the reference are candidates.
    if (up.width >= up.height !== landscape) continue
    const score = correlation(luminance(warp(up, autoCorners(up), w, h)), ref)
    if (score > bestScore) {
      bestScore = score
      best = r
    }
  }
  return best
}

/** Mask image (white with ink as alpha), sized to the reference aspect */
/** The photo straightened onto the reference frame, as a JPEG for display on the heatmap page */
export function straightenedPhoto(
  photo: HTMLImageElement,
  aspect: number,
  rotation: Rotation,
  corners: Corners,
  longEdge = 1000,
): string {
  const { w, h } = sizeFor(aspect, longEdge)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.putImageData(warp(rotated(photo, rotation, 1400), corners, w, h), 0, 0)
  return canvas.toDataURL('image/jpeg', 0.82)
}

export function maskToPng(mask: Float32Array, w: number, h: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(w, h)
  for (let i = 0; i < mask.length; i++) {
    img.data[i * 4] = 255
    img.data[i * 4 + 1] = 255
    img.data[i * 4 + 2] = 255
    img.data[i * 4 + 3] = Math.round(Math.min(1, mask[i]) * 255)
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL('image/png')
}

/**
 * Per-page ink thresholds relative to the note's own base colour under UV.
 * Most notes glow blue (~220°), but printed colour filters the glow (a green note photographs cyan),
 * so ink is judged as a hue shift away from this page's median hue rather than by fixed hues.
 */
export function calibrateInk(warped: ImageData, base: InkSettings = DEFAULT_INK): InkSettings {
  const hues: number[] = []
  for (let i = 0; i < warped.width * warped.height; i += 3) {
    const { h, s, v } = hsv(warped.data[i * 4], warped.data[i * 4 + 1], warped.data[i * 4 + 2])
    if (v > 0.3 && s > 0.3) hues.push(h)
  }
  if (hues.length === 0) return base
  hues.sort((a, b) => a - b)
  const median = hues[Math.floor(hues.length / 2)]
  const clamp = (v: number, lo: number, hi: number) => Math.round(Math.min(hi, Math.max(lo, v)))
  const cyanHue = clamp(median - 22, 140, 200)
  return {
    ...base,
    cyanHue,
    greenHue: Math.min(170, cyanHue - 5),
    pinkHue: clamp(median + 30, 250, 290),
  }
}

export type ExtractResult = {
  upright: ImageData
  warped: ImageData
  mask: Float32Array
  w: number
  h: number
  coverage: number
}

/** Full pipeline for one page with the given settings */
export function extract(
  photo: HTMLImageElement,
  aspect: number,
  rotation: Rotation,
  corners: Corners,
  ink: InkSettings,
): ExtractResult {
  const upright = rotated(photo, rotation)
  const { w, h } = sizeFor(aspect, MASK_LONG_EDGE)
  const warped = warp(upright, corners, w, h)
  const raw = inkMask(warped, ink)
  const coverage = raw.reduce((a, b) => a + b, 0) / raw.length
  // Soften speckle into contiguous touch regions (~1.5% of the long edge).
  const mask = blur(raw, w, h, Math.max(1, Math.round(MASK_LONG_EDGE * 0.012)))
  return { upright, warped, mask, w, h, coverage }
}
