import touchData from '@/data/touch.json'
import type { CurrencyCode, Observation, Side, TouchEntry } from '@/data/types'

const touchEntries = touchData as TouchEntry[]

/** One denomination with whatever the two studies recorded for it */
export type StudyNote = {
  key: string
  currency: CurrencyCode
  denomination: number
  label: string
  /** What the canvas renders: the real eye-flow observation, or a stand-in with no points */
  obs: Observation
  /** Eye-flow recording (one observer per denomination), if any */
  flow: Observation | null
  /** Touch (UV ink) extraction per side, if any */
  touch: Partial<Record<Side, TouchEntry>>
}

/**
 * All denominations of a currency, merging both studies. Most notes have one or the other:
 * USD only has eye flow, and several touch-only notes were never part of the eye-flow session.
 */
export function studyNotes(flows: Observation[], currency: CurrencyCode): StudyNote[] {
  const flowNotes = flows.filter((n) => n.currency === currency)
  const touchNotes = touchEntries.filter((e) => e.currency === currency)
  const denominations = [
    ...new Set([...flowNotes.map((n) => n.denomination), ...touchNotes.map((e) => e.denomination)]),
  ].sort((a, b) => a - b)

  return denominations.map((d) => {
    const flow = flowNotes.find((n) => n.denomination === d) ?? null
    const front = touchNotes.find((e) => e.denomination === d && e.side === 'front')
    const back = touchNotes.find((e) => e.denomination === d && e.side === 'back')
    const key = `${currency}-${d}`
    const obs: Observation = flow ?? {
      id: key.toLowerCase(),
      currency,
      observer: '',
      denomination: d,
      label: front?.label ?? String(d),
      orientation: front?.orientation ?? 'horizontal',
      aspect: front?.aspect ?? 2,
      quote: '',
      front: { image: front?.image ?? '', points: [] },
      back: { image: back?.image ?? '', points: [] },
    }
    return {
      key,
      currency,
      denomination: d,
      label: obs.label,
      obs,
      flow,
      touch: { front, back },
    }
  })
}

/** Same note with the eye-flow points hidden */
export const withoutFlow = (n: Observation): Observation => ({
  ...n,
  front: { ...n.front, points: [] },
  back: { ...n.back, points: [] },
})

export const maskUrl = (e: TouchEntry | undefined) =>
  e?.extraction ? `${e.extraction.mask}?v=${e.extraction.savedAt}` : null

export const photoUrl = (e: TouchEntry | undefined) =>
  e?.extraction?.photo ? `${e.extraction.photo}?v=${e.extraction.savedAt}` : null
