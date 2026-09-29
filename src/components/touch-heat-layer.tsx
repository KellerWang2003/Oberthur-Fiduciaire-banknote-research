import { useEffect, useRef } from 'react'
import { loadImage, sizeFor } from '@/lib/touch-extract'

// Sequential warm ramp: rarely touched → touched on every note.
const STOPS: [number, [number, number, number]][] = [
  [0, [255, 237, 160]], // pale yellow
  [0.35, [254, 178, 76]], // amber
  [0.65, [240, 59, 32]], // red-orange
  [1, [150, 0, 38]], // deep red
]

function touchColor(t: number): [number, number, number] {
  const v = Math.min(1, Math.max(0, t))
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i]
    if (v <= t1) {
      const [t0, c0] = STOPS[i - 1]
      const f = (v - t0) / (t1 - t0)
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * f)) as [
        number,
        number,
        number,
      ]
    }
  }
  return STOPS[STOPS.length - 1][1]
}

export const TOUCH_GRADIENT = `linear-gradient(to right, ${STOPS.map(
  ([t, c]) => `rgb(${c.join(' ')}) ${t * 100}%`,
).join(', ')})`

type Props = {
  /** One mask for a single note; several are averaged (stretched to this frame) */
  masks: string[]
  aspect: number
  /** Below this share of notes, the heat fades out entirely */
  className?: string
}

const LONG_EDGE = 360

/** Paints touch frequency: the share of the given masks that have ink at each point */
export function TouchHeatLayer({ masks, aspect, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { w, h } = sizeFor(aspect, LONG_EDGE)
  const key = masks.join('|')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const canvas = ref.current
      if (!canvas || masks.length === 0) {
        canvas?.getContext('2d')?.clearRect(0, 0, w, h)
        return
      }
      const images = await Promise.all(masks.map(loadImage))
      if (cancelled) return
      const scratch = document.createElement('canvas')
      scratch.width = w
      scratch.height = h
      const sctx = scratch.getContext('2d', { willReadFrequently: true })!
      const sum = new Float32Array(w * h)
      for (const img of images) {
        sctx.clearRect(0, 0, w, h)
        sctx.drawImage(img, 0, 0, w, h)
        const a = sctx.getImageData(0, 0, w, h).data
        for (let i = 0; i < sum.length; i++) sum[i] += a[i * 4 + 3] / 255
      }
      const ctx = canvas.getContext('2d')!
      const out = ctx.createImageData(w, h)
      for (let i = 0; i < sum.length; i++) {
        const t = sum[i] / images.length
        if (t < 0.03) continue
        const [r, g, b] = touchColor(t)
        out.data[i * 4] = r
        out.data[i * 4 + 1] = g
        out.data[i * 4 + 2] = b
        // Fade to transparent at the edges so untouched areas stay clean; hot spots read clearly.
        out.data[i * 4 + 3] = Math.round(255 * Math.min(0.9, t * 1.2))
      }
      ctx.putImageData(out, 0, 0)
    })()
    return () => {
      cancelled = true
    }
    // `key` captures the mask list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, w, h])

  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      className={className ?? 'pointer-events-none absolute inset-0 size-full'}
    />
  )
}
