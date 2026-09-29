// Gaze-order encoding: early fixations are warm and solid, later ones cold and faded.
// The scale is absolute (step 3 is always the same color), so notes stay comparable.
const STEPS = [
  { h: 27, c: 0.21, l: 0.6 }, // 1 red
  { h: 50, c: 0.19, l: 0.66 }, // 2 orange
  { h: 80, c: 0.16, l: 0.72 }, // 3 amber
  { h: 180, c: 0.12, l: 0.62 }, // 4 teal
  { h: 235, c: 0.14, l: 0.58 }, // 5 blue
  { h: 275, c: 0.14, l: 0.52 }, // 6+ indigo
]

export function orderColor(index: number) {
  const s = STEPS[Math.min(index, STEPS.length - 1)]
  return `oklch(${s.l} ${s.c} ${s.h})`
}

export function orderOpacity(index: number) {
  return Math.max(0.45, 1 - index * 0.12)
}

/** 1 for the first thing seen, falling to 0 by the 6th step */
export function earliness(index: number) {
  return Math.max(0, 1 - index / (STEPS.length - 1))
}

// Heatmap ramp, cold → hot (later → first seen).
const HEAT_STOPS: [number, [number, number, number]][] = [
  [0, [49, 84, 214]], // blue
  [0.3, [38, 182, 214]], // cyan
  [0.55, [120, 200, 80]], // green
  [0.75, [245, 200, 40]], // yellow
  [0.88, [245, 130, 30]], // orange
  [1, [220, 38, 38]], // red
]

export function heatColor(t: number): [number, number, number] {
  const v = Math.min(1, Math.max(0, t))
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const [t1, c1] = HEAT_STOPS[i]
    if (v <= t1) {
      const [t0, c0] = HEAT_STOPS[i - 1]
      const f = (v - t0) / (t1 - t0)
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * f)) as [number, number, number]
    }
  }
  return HEAT_STOPS[HEAT_STOPS.length - 1][1]
}

// Drawn hot → cold (left to right) so the legend reads first → later, like the order key.
export const HEAT_GRADIENT = `linear-gradient(to left, ${HEAT_STOPS.map(
  ([t, c]) => `rgb(${c.join(' ')}) ${t * 100}%`,
).join(', ')})`

export const ORDER_LEGEND = STEPS.map((_, i) => ({
  label: i === STEPS.length - 1 ? `${i + 1}+` : String(i + 1),
  color: orderColor(i),
  opacity: orderOpacity(i),
}))
