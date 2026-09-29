import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Loader2, RotateCw, Save, ScanSearch, Wand2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import touchData from '@/data/touch.json'
import type { Extraction, InkSettings, TouchEntry } from '@/data/types'
import {
  DEFAULT_INK,
  autoCorners,
  calibrateInk,
  autoRotation,
  extract,
  loadImage,
  maskToPng,
  straightenedPhoto,
  rotated,
  sizeFor,
  warp,
  type ExtractResult,
} from '@/lib/touch-extract'
import { cn } from '@/lib/utils'

type Draft = Pick<Extraction, 'rotation' | 'corners' | 'ink'>

const CURRENCY_NAMES: Record<string, string> = {
  EUR: 'Euro',
  CHF: 'Swiss Franc',
  RUB: 'Russian Ruble',
  GBP: 'British Pound',
}

const INK_FIELDS: {
  key: keyof InkSettings
  label: string
  hint: string
  max?: number
  step?: number
}[] = [
  { key: 'minValue', label: 'Min brightness', hint: 'Ignore anything darker' },
  {
    key: 'pinkHue',
    label: 'Pink ink · starts at hue',
    hint: 'Lower = more violet counts as ink',
    max: 360,
    step: 1,
  },
  { key: 'pinkSaturation', label: 'Pink ink · min saturation', hint: 'Lower = catch fainter pink' },
  {
    key: 'greenSaturation',
    label: 'Yellow-green ink · min saturation',
    hint: 'Lower = catch fainter green',
  },
  {
    key: 'greenHue',
    label: 'Yellow-green ink · up to hue',
    hint: 'Higher = more cyan counts as green',
    max: 360,
    step: 1,
  },
  {
    key: 'cyanHue',
    label: 'Cyan ink · up to hue',
    hint: 'Higher = more blue counts as ink',
    max: 360,
    step: 1,
  },
  {
    key: 'paleSaturation',
    label: 'White ink · max saturation',
    hint: 'Higher = more pale areas count',
  },
  {
    key: 'paleValue',
    label: 'Cyan / white ink · min brightness',
    hint: 'Lower = fainter smudges count',
  },
]

async function save(
  entry: TouchEntry,
  draft: Draft,
  result: ExtractResult,
  photo: HTMLImageElement,
) {
  const extraction: Omit<Extraction, 'mask'> = {
    ...draft,
    coverage: Math.round(result.coverage * 10000) / 10000,
    savedAt: Date.now(),
  }
  const res = await fetch('/api/save-touch-page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: entry.id,
      extraction,
      maskPng: maskToPng(result.mask, result.w, result.h),
      photoJpg: straightenedPhoto(photo, entry.aspect, draft.rotation, draft.corners),
    }),
  })
  if (!res.ok) throw new Error(await res.text())
  return {
    ...extraction,
    mask: `/touch/${entry.id}.png`,
    photo: `/touch/${entry.id}-photo.jpg`,
  } as Extraction
}

/** Auto settings for a page: best-matching rotation and the lit note's bounding box */
async function autoDraft(entry: TouchEntry, ink: InkSettings): Promise<Draft> {
  const [photo, reference] = await Promise.all([loadImage(entry.source), loadImage(entry.image)])
  const rotation = autoRotation(photo, reference, entry.aspect)
  const corners = autoCorners(rotated(photo, rotation))
  return { rotation, corners, ink: calibrated(photo, entry, rotation, corners, ink) }
}

/** Ink thresholds tuned to this page's base colour (see calibrateInk) */
function calibrated(
  photo: HTMLImageElement,
  entry: TouchEntry,
  rotation: Extraction['rotation'],
  corners: Extraction['corners'],
  ink: InkSettings,
) {
  const { w, h } = sizeFor(entry.aspect, 200)
  return calibrateInk(warp(rotated(photo, rotation, 600), corners, w, h), ink)
}

function DataCanvas({ data, className }: { data: ImageData | null; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!data || !ref.current) return
    ref.current.width = data.width
    ref.current.height = data.height
    ref.current.getContext('2d')!.putImageData(data, 0, 0)
  }, [data])
  return <canvas ref={ref} className={cn('block h-auto w-full', className)} />
}

function maskImage(result: ExtractResult, rgb: [number, number, number], alpha = 0.75) {
  const img = new ImageData(result.w, result.h)
  for (let i = 0; i < result.mask.length; i++) {
    img.data[i * 4] = rgb[0]
    img.data[i * 4 + 1] = rgb[1]
    img.data[i * 4 + 2] = rgb[2]
    img.data[i * 4 + 3] = Math.round(Math.min(1, result.mask[i]) * 255 * alpha)
  }
  return img
}

/** Upright photo with the note quad; corners are draggable */
function CornerEditor({
  upright,
  corners,
  onChange,
}: {
  upright: ImageData | null
  corners: Extraction['corners']
  onChange: (c: Extraction['corners']) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<number | null>(null)
  return (
    <div ref={ref} className="relative touch-none select-none">
      <DataCanvas data={upright} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <polygon
          points={corners.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')}
          fill="rgb(255 255 255 / 0.08)"
          stroke="#facc15"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {corners.map(([x, y], i) => (
        <div
          key={i}
          className="absolute size-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-white bg-yellow-400 shadow active:cursor-grabbing"
          style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            drag.current = i
          }}
          onPointerMove={(e) => {
            if (drag.current !== i) return
            const r = ref.current!.getBoundingClientRect()
            const nx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
            const ny = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
            onChange(corners.map((c, k) => (k === i ? [nx, ny] : c)) as Extraction['corners'])
          }}
          onPointerUp={() => (drag.current = null)}
        />
      ))}
    </div>
  )
}

export function TouchExtractPage() {
  const [entries, setEntries] = useState<TouchEntry[]>(touchData as TouchEntry[])
  const [selectedId, setSelectedId] = useState(entries[0].id)
  const entry = entries.find((e) => e.id === selectedId)!
  const [draft, setDraft] = useState<Draft | null>(null)
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null)
  const [result, setResult] = useState<ExtractResult | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [ink, setInk] = useState<InkSettings>({ ...DEFAULT_INK, ...entry.extraction?.ink })
  const [showMask, setShowMask] = useState(true)

  // Load the page: saved settings if any, otherwise auto-detect.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const img = await loadImage(entry.source)
      const d = entry.extraction
        ? {
            rotation: entry.extraction.rotation,
            corners: entry.extraction.corners,
            ink: { ...DEFAULT_INK, ...entry.extraction.ink },
          }
        : await autoDraft(entry, ink)
      if (cancelled) return
      setPhoto(img)
      setDraft(d)
      setInk(d.ink)
    })()
    return () => {
      cancelled = true
    }
    // Only when switching pages; ink changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // Re-run extraction whenever settings change.
  useEffect(() => {
    if (!photo || !draft) return
    const t = window.setTimeout(() => {
      setResult(extract(photo, entry.aspect, draft.rotation, draft.corners, draft.ink))
    }, 60)
    return () => window.clearTimeout(t)
  }, [photo, draft, entry.aspect])

  function openPage(id: string) {
    if (id === selectedId) return
    setResult(null)
    setDraft(null)
    setSelectedId(id)
  }

  function update(patch: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d))
  }

  async function saveCurrent() {
    if (!draft || !result || !photo) return
    setBusy('Saving…')
    try {
      const extraction = await save(entry, draft, result, photo)
      setEntries((es) => es.map((e) => (e.id === entry.id ? { ...e, extraction } : e)))
    } finally {
      setBusy(null)
    }
  }

  /** Auto-process pages; `redoAll` re-runs saved pages too, keeping their rotation and corners */
  async function processAll(redoAll: boolean) {
    const list = redoAll ? entries : entries.filter((e) => !e.extraction)
    for (const [i, e] of list.entries()) {
      setBusy(`Processing ${i + 1} / ${list.length} · ${e.label} ${e.side}`)
      const img = await loadImage(e.source)
      const d = e.extraction
        ? {
            rotation: e.extraction.rotation,
            corners: e.extraction.corners,
            ink: calibrated(img, e, e.extraction.rotation, e.extraction.corners, ink),
          }
        : await autoDraft(e, ink)
      const r = extract(img, e.aspect, d.rotation, d.corners, d.ink)
      const extraction = await save(e, d, r, img)
      setEntries((es) => es.map((x) => (x.id === e.id ? { ...x, extraction } : x)))
    }
    setBusy(null)
  }

  const groups = Object.entries(
    entries.reduce<Record<string, TouchEntry[]>>((acc, e) => {
      ;(acc[e.currency] ??= []).push(e)
      return acc
    }, {}),
  )
  const done = entries.filter((e) => e.extraction).length

  return (
    <div className="fixed inset-0 flex bg-background text-foreground">
      <aside className="flex w-60 shrink-0 flex-col border-r">
        <div className="p-3">
          <a
            href="#/"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Back to the study
          </a>
          <h1 className="mt-2 text-sm font-semibold">Extract touch areas</h1>
          <p className="text-xs text-muted-foreground">
            {done} / {entries.length} pages saved
          </p>
        </div>
        <Separator />
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {groups.map(([code, list]) => (
            <div key={code} className="mb-3">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
                {CURRENCY_NAMES[code]}
              </div>
              {list.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => openPage(e.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted',
                    e.id === selectedId && 'bg-muted font-medium',
                  )}
                >
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      e.extraction ? 'bg-emerald-500' : 'bg-border',
                    )}
                  />
                  {e.label}
                  <span className="text-muted-foreground capitalize">{e.side}</span>
                  {e.extraction && (
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      {Math.round(e.extraction.coverage * 100)}%
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex flex-col gap-2 p-3">
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => processAll(false)}>
            <Wand2 />
            Auto-process unsaved
          </Button>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => processAll(true)}>
            <ScanSearch />
            Re-run all with these ink settings
          </Button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b px-4 py-3">
          <h2 className="font-semibold">
            {entry.label}{' '}
            <span className="font-normal text-muted-foreground capitalize">{entry.side}</span>
          </h2>
          <Badge variant="secondary">page {entry.source.match(/p(\d+)/)?.[1]}</Badge>
          {entry.extraction ? (
            <Badge variant="outline">Saved</Badge>
          ) : (
            <Badge variant="outline">Not saved</Badge>
          )}
          {busy && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              {busy}
            </span>
          )}
          <Button className="ml-auto" size="sm" disabled={!result || !!busy} onClick={saveCurrent}>
            <Save />
            Save page
          </Button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_280px] gap-4 overflow-y-auto p-4">
          <section className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                1 · Photo
              </h3>
              <Button
                size="xs"
                variant="outline"
                className="ml-auto"
                disabled={!draft || !photo}
                onClick={() => {
                  const rotation = ((draft!.rotation + 90) % 360) as Extraction['rotation']
                  update({ rotation, corners: autoCorners(rotated(photo!, rotation)) })
                }}
              >
                <RotateCw />
                Rotate
              </Button>
              <Button
                size="xs"
                variant="outline"
                disabled={!draft || !photo}
                onClick={() => update({ corners: autoCorners(rotated(photo!, draft!.rotation)) })}
              >
                Auto corners
              </Button>
            </div>
            {draft && (
              <CornerEditor
                upright={result?.upright ?? null}
                corners={draft.corners}
                onChange={(corners) => update({ corners })}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Drag the yellow corners onto the note's corners.
            </p>
          </section>

          <section className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                2 · Straightened + detected ink
              </h3>
              <label className="ml-auto flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={showMask}
                  onChange={(e) => setShowMask(e.target.checked)}
                />
                Show ink
              </label>
            </div>
            <div className="relative">
              {/* Dim the photo so detected ink (white) stands out against every ink colour */}
              <DataCanvas
                data={result?.warped ?? null}
                className={cn(showMask && 'brightness-[0.35]')}
              />
              {result && showMask && (
                <DataCanvas
                  data={maskImage(result, [255, 255, 255], 0.9)}
                  className="absolute inset-0 size-full"
                />
              )}
            </div>
            <h3 className="mt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              3 · On the reference note
            </h3>
            <div className="relative">
              <img src={entry.image} alt="" className="block h-auto w-full opacity-70 grayscale" />
              {result && (
                <DataCanvas
                  data={maskImage(result, [220, 38, 38], 0.65)}
                  className="absolute inset-0 size-full"
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              If the artwork and photo don't line up, rotate or fix the corners.
            </p>
          </section>

          <section className="flex flex-col gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Touched surface</div>
              <div className="text-2xl font-semibold tabular-nums">
                {result ? `${Math.round(result.coverage * 100)}%` : '—'}
              </div>
            </div>
            <Separator />
            {INK_FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col gap-1">
                <span className="flex justify-between text-sm">
                  {f.label}
                  <span className="text-muted-foreground tabular-nums">
                    {f.step === 1 ? `${ink[f.key]}°` : ink[f.key].toFixed(2)}
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={f.max ?? 1}
                  step={f.step ?? 0.01}
                  value={ink[f.key]}
                  className="accent-primary"
                  onChange={(e) => {
                    const next = { ...ink, [f.key]: Number(e.target.value) }
                    setInk(next)
                    update({ ink: next })
                  }}
                />
                <span className="text-xs text-muted-foreground">{f.hint}</span>
              </label>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setInk(DEFAULT_INK)
                update({ ink: DEFAULT_INK })
              }}
            >
              Reset ink settings
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!result || !photo || !draft}
              onClick={() => {
                const next = calibrated(photo!, entry, draft!.rotation, draft!.corners, ink)
                setInk(next)
                update({ ink: next })
              }}
            >
              Auto-calibrate hues to this note
            </Button>
          </section>
        </div>
      </main>
    </div>
  )
}
