export type Stops = [number, [number, number, number]][]

// Sequential ramps: rarely touched → touched on every note.
export const PALETTES = {
  // Touch Heatmap page
  warm: [
    [0, [255, 237, 160]], // pale yellow
    [0.35, [254, 178, 76]], // amber
    [0.65, [240, 59, 32]], // red-orange
    [1, [150, 0, 38]], // deep red
  ],
  // Flow + Touch page: kept clear of the warm-to-cool gaze-order colours drawn on top
  violet: [
    [0, [237, 233, 254]],
    [0.35, [196, 181, 253]],
    [0.65, [139, 92, 246]],
    [1, [76, 29, 149]],
  ],
} satisfies Record<string, Stops>

export type TouchPalette = keyof typeof PALETTES

export function touchColor(stops: Stops, t: number): [number, number, number] {
  const v = Math.min(1, Math.max(0, t))
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i]
    if (v <= t1) {
      const [t0, c0] = stops[i - 1]
      const f = (v - t0) / (t1 - t0)
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * f)) as [
        number,
        number,
        number,
      ]
    }
  }
  return stops[stops.length - 1][1]
}

export const touchGradient = (palette: TouchPalette = 'warm') =>
  `linear-gradient(to right, ${(PALETTES[palette] as Stops)
    .map(([t, c]) => `rgb(${c.join(' ')}) ${t * 100}%`)
    .join(', ')})`

export const TOUCH_GRADIENT = touchGradient('warm')
