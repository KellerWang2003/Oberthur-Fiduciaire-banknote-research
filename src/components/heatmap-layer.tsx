import { useEffect, useRef } from 'react'
import { earliness, heatColor } from '@/lib/order'
import type { Observation, Side } from '@/data/types'

type Props = {
  notes: Observation[]
  side: Side
  /** Width / height of the shared overlay frame */
  aspect: number
}

// Resolution of the computed field; the browser smooths it when scaling up.
const COLS = 240
// Blob size as a fraction of the note's long edge, so portrait notes (CHF) match landscape ones.
const SIGMA = 0.055
// Gaze paths between fixations: a narrower trail that peaks at ~55% of a fixation.
const PATH_SIGMA = 0.6 // × SIGMA
const PATH_PEAK = 0.55
const PATH_SPACING = 0.3 // sample spacing along the path, × path sigma
// Summed kernel weight that reads as fully opaque.
const FULL_DENSITY = 1.6
const MAX_ALPHA = 0.85

type Stamp = { x: number; y: number; t: number; weight: number; sigma: number }

/**
 * Collective gaze heatmap for one side of the overlay.
 * Colour = how early people looked there (hot = first, cold = later), weighted by proximity.
 * Opacity = how much attention the area got overall (more observers / points = stronger).
 * Fixation points are the main blobs; the path between consecutive points adds a lighter trail
 * whose colour runs from the earlier point's heat to the later one's.
 */
export function HeatmapLayer({ notes, side, aspect }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const rows = Math.max(1, Math.round(COLS / aspect))

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const sigma = SIGMA * Math.max(COLS, rows)
    const pathSigma = sigma * PATH_SIGMA
    const spacing = pathSigma * PATH_SPACING
    // A line of samples sums to ~√(2π)·σ/spacing at its centre; scale so it peaks at PATH_PEAK.
    const pathWeight = PATH_PEAK / (Math.sqrt(2 * Math.PI) / PATH_SPACING)

    const stamps: Stamp[] = []
    for (const n of notes) {
      const pts = n[side].points.map((p, i) => ({ x: p.x * COLS, y: p.y * rows, t: earliness(i) }))
      pts.forEach((p) => stamps.push({ ...p, weight: 1, sigma }))
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]
        const b = pts[i]
        const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / spacing))
        // Skip the endpoints; the fixation blobs already cover them.
        for (let k = 1; k < steps; k++) {
          const f = k / steps
          stamps.push({
            x: a.x + (b.x - a.x) * f,
            y: a.y + (b.y - a.y) * f,
            t: a.t + (b.t - a.t) * f,
            weight: pathWeight,
            sigma: pathSigma,
          })
        }
      }
    }

    // Stamp each kernel into its neighbourhood only (3σ), instead of testing every pixel.
    const density = new Float32Array(COLS * rows)
    const heat = new Float32Array(COLS * rows)
    for (const s of stamps) {
      const r = Math.ceil(3 * s.sigma)
      const twoSigmaSq = 2 * s.sigma * s.sigma
      const x0 = Math.max(0, Math.floor(s.x - r))
      const x1 = Math.min(COLS - 1, Math.ceil(s.x + r))
      const y0 = Math.max(0, Math.floor(s.y - r))
      const y1 = Math.min(rows - 1, Math.ceil(s.y + r))
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const d = (x - s.x) ** 2 + (y - s.y) ** 2
          if (d > r * r) continue
          const w = s.weight * Math.exp(-d / twoSigmaSq)
          const i = y * COLS + x
          density[i] += w
          heat[i] += w * s.t
        }
      }
    }

    const image = ctx.createImageData(COLS, rows)
    for (let i = 0; i < density.length; i++) {
      if (density[i] < 0.01) continue
      const [r, g, b] = heatColor(heat[i] / density[i])
      const o = i * 4
      image.data[o] = r
      image.data[o + 1] = g
      image.data[o + 2] = b
      image.data[o + 3] = Math.round(255 * MAX_ALPHA * Math.min(1, density[i] / FULL_DENSITY))
    }
    ctx.putImageData(image, 0, 0)
  }, [notes, side, rows])

  return (
    <canvas
      ref={ref}
      width={COLS}
      height={rows}
      className="pointer-events-none absolute inset-0 size-full"
    />
  )
}
