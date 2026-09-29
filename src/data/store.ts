import { useEffect, useState } from 'react'
import initialFlows from './flows.json'
import type { FlowPoint, Observation, Side } from './types'

const DRAFT_KEY = 'banknote-flows-draft'
const saved = initialFlows as Observation[]

// Drafts only hold edited points, so changes to other fields in flows.json always win.
type Draft = Record<string, Partial<Record<Side, FlowPoint[]>>>

function toDraft(flows: Observation[]): Draft {
  const draft: Draft = {}
  for (const n of flows) {
    const base = saved.find((s) => s.id === n.id)
    for (const side of ['front', 'back'] as const) {
      if (JSON.stringify(n[side].points) !== JSON.stringify(base?.[side].points)) {
        draft[n.id] = { ...draft[n.id], [side]: n[side].points }
      }
    }
  }
  return draft
}

function applyDraft(draft: Draft): Observation[] {
  return saved.map((n) => {
    const d = draft[n.id]
    if (!d) return n
    return {
      ...n,
      front: d.front ? { ...n.front, points: d.front } : n.front,
      back: d.back ? { ...n.back, points: d.back } : n.back,
    }
  })
}

function loadDraft(): Observation[] {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    const draft = raw ? (JSON.parse(raw) as unknown) : null
    // Ignore drafts from older formats (a full array of notes).
    if (!draft || Array.isArray(draft) || typeof draft !== 'object') return saved
    return applyDraft(draft as Draft)
  } catch {
    return saved
  }
}

export function useFlows() {
  const [flows, setFlows] = useState<Observation[]>(loadDraft)
  const draft = toDraft(flows)
  const dirty = Object.keys(draft).length > 0

  // Keep unsaved edits across reloads.
  useEffect(() => {
    try {
      if (dirty) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      else localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* storage unavailable */
    }
  }, [draft, dirty])

  function setPoints(noteId: string, side: Side, points: FlowPoint[]) {
    setFlows((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, [side]: { ...n[side], points } } : n)),
    )
  }

  function discard() {
    setFlows(saved)
  }

  async function save(): Promise<boolean> {
    try {
      const res = await fetch('/api/save-flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flows),
      })
      if (!res.ok) return false
      localStorage.removeItem(DRAFT_KEY)
      return true
    } catch {
      return false
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(flows, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'flows.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return { flows, dirty, setPoints, discard, save, exportJson }
}
