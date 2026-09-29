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
// Summed kernel weight that reads as fully opaque.
const FULL_DENSITY = 1.6
const MAX_ALPHA = 0.85

/**
 * Collective gaze heatmap for one side of the overlay.
 * Colour = how early people looked there (hot = first, cold = later), weighted by proximity.
 * Opacity = how much attention the area got overall (more observers / points = stronger).
 */
export function HeatmapLayer({ notes, side, aspect }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const rows = Math.max(1, Math.round(COLS / aspect))

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const points = notes.flatMap((n) =>
      n[side].points.map((p, i) => ({ x: p.x * COLS, y: p.y * rows, t: earliness(i) })),
    )
    const sigma = SIGMA * Math.max(COLS, rows)
    const twoSigmaSq = 2 * sigma * sigma
    const cutoffSq = (3 * sigma) ** 2
    const image = ctx.createImageData(COLS, rows)

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < COLS; x++) {
        let density = 0
        let heat = 0
        for (const p of points) {
          const d = (x - p.x) ** 2 + (y - p.y) ** 2
          if (d > cutoffSq) continue
          const w = Math.exp(-d / twoSigmaSq)
          density += w
          heat += w * p.t
        }
        if (density < 0.01) continue
        const [r, g, b] = heatColor(heat / density)
        const o = (y * COLS + x) * 4
        image.data[o] = r
        image.data[o + 1] = g
        image.data[o + 2] = b
        image.data[o + 3] = Math.round(255 * MAX_ALPHA * Math.min(1, density / FULL_DENSITY))
      }
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
