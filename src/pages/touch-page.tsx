import { useEffect, useRef, useState } from 'react'
import {
  Layers,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  RectangleHorizontal,
  ScanSearch,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CanvasStage } from '@/components/canvas-stage'
import { DenominationDock } from '@/components/denomination-dock'
import { FlipButton } from '@/components/flip-button'
import { ModePanel } from '@/components/mode-panel'
import { ColumnResizer } from '@/components/column-resizer'
import { PageSwitcher } from '@/components/page-switcher'
import { useColumnWidth } from '@/hooks/use-column-width'
import { TOUCH_GRADIENT, TouchHeatLayer } from '@/components/touch-heat-layer'
import touchData from '@/data/touch.json'
import { CURRENCIES, type Side, type TouchCurrency, type TouchEntry } from '@/data/types'
import { cn } from '@/lib/utils'

type Layout = 'single' | 'grid' | 'combined'

const LAYOUTS: { value: Layout; label: string; icon: typeof Layers }[] = [
  { value: 'single', label: 'Single', icon: RectangleHorizontal },
  { value: 'grid', label: 'All notes', icon: LayoutGrid },
  { value: 'combined', label: 'Combined', icon: Layers },
]

const TOUCH_CURRENCIES = CURRENCIES.filter((c) => c.code !== 'USD') as {
  code: TouchCurrency
  name: string
  series: string
}[]

const entries = touchData as TouchEntry[]
const HORIZONTAL_WIDTH = 960
const VERTICAL_HEIGHT = 900

type Note = {
  key: string
  currency: TouchCurrency
  denomination: number
  label: string
  front: TouchEntry
  back: TouchEntry
}

function notesOf(currency: TouchCurrency): Note[] {
  const list = entries.filter((e) => e.currency === currency)
  const denoms = [...new Set(list.map((e) => e.denomination))].sort((a, b) => a - b)
  return denoms.map((d) => {
    const front = list.find((e) => e.denomination === d && e.side === 'front')!
    const back = list.find((e) => e.denomination === d && e.side === 'back')!
    return { key: `${currency}-${d}`, currency, denomination: d, label: front.label, front, back }
  })
}

const maskUrl = (e: TouchEntry) =>
  e.extraction ? `${e.extraction.mask}?v=${e.extraction.savedAt}` : null
const photoUrl = (e: TouchEntry) =>
  e.extraction?.photo ? `${e.extraction.photo}?v=${e.extraction.savedAt}` : null
const widthFor = (aspect: number, vertical: boolean) =>
  vertical ? VERTICAL_HEIGHT * aspect : HORIZONTAL_WIDTH
const pct = (v: number | undefined) => (v === undefined ? '—' : `${Math.round(v * 100)}%`)

function readUrl() {
  const p = new URLSearchParams(location.search)
  const c = p.get('c')?.toUpperCase()
  return {
    currency: (TOUCH_CURRENCIES.some((x) => x.code === c) ? c : 'EUR') as TouchCurrency,
    denomination: Number(p.get('d')) || null,
    layout: (LAYOUTS.find((l) => l.value === p.get('view'))?.value ?? 'single') as Layout,
    showPhoto: p.get('photo') === '1',
    mono: p.get('bw') === '1',
  }
}

/** The straightened UV photo shown above a note; flips together with it */
function PhotoCard({
  aspect,
  side,
  front,
  back,
}: {
  aspect: number
  side: Side
  front: string | null
  back: string | null
}) {
  const face = (src: string | null, className?: string) => (
    <div
      className={cn(
        'absolute inset-0 overflow-hidden rounded-md bg-muted shadow-lg backface-hidden',
        className,
      )}
    >
      {src && (
        <img
          src={src}
          alt="UV photo"
          draggable={false}
          className="size-full object-fill select-none"
        />
      )}
    </div>
  )
  return (
    <div className="flex flex-col gap-2">
      <span className="text-base tracking-wide text-muted-foreground uppercase">UV photo</span>
      <div className="relative perspective-[2400px]" style={{ aspectRatio: aspect }}>
        <div
          className={cn(
            'absolute inset-0 transition-transform duration-700 ease-in-out transform-3d',
            side === 'back' && 'rotate-y-180',
          )}
        >
          {face(front)}
          {face(back, 'rotate-y-180')}
        </div>
      </div>
    </div>
  )
}

/** One note with its touch heat, flippable */
function TouchNote({
  note,
  side,
  showPhoto,
  mono,
  caption,
  selected,
  onSelect,
  onFlip,
  ref,
}: {
  note: Note
  side: Side
  showPhoto: boolean
  /** Black-and-white artwork, so only the ink heat carries colour */
  mono: boolean
  caption?: boolean
  selected?: boolean
  onSelect?: () => void
  onFlip: () => void
  ref?: React.Ref<HTMLDivElement>
}) {
  const vertical = note.front.orientation === 'vertical'
  const face = (s: Side, className?: string) => {
    const e = note[s]
    const mask = maskUrl(e)
    return (
      <div
        className={cn(
          'absolute inset-0 isolate overflow-hidden rounded-md bg-white shadow-xl backface-hidden',
          className,
        )}
      >
        <img
          src={e.image}
          alt=""
          draggable={false}
          className={cn(
            'size-full object-fill opacity-80 transition-[filter] duration-300 select-none',
            mono && 'grayscale',
          )}
        />
        {mask && <TouchHeatLayer masks={[mask]} aspect={note.front.aspect} />}
      </div>
    )
  }
  return (
    <div
      ref={ref}
      className="flex flex-col gap-4"
      style={{ width: widthFor(note.front.aspect, vertical) }}
    >
      {caption && (
        <div className="flex items-baseline gap-3 text-2xl">
          <span className="font-semibold">{note.label}</span>
          <span className="text-muted-foreground">
            {pct(note[side].extraction?.coverage)} touched
          </span>
          <span className="ml-auto text-base tracking-wide text-muted-foreground uppercase">
            {side}
          </span>
        </div>
      )}
      {showPhoto && (
        <PhotoCard
          aspect={note.front.aspect}
          side={side}
          front={photoUrl(note.front)}
          back={photoUrl(note.back)}
        />
      )}
      <div
        className={cn(
          'relative rounded-xl perspective-[2400px]',
          caption && selected && 'ring-4 ring-primary ring-offset-8 ring-offset-transparent',
          caption && !selected && 'cursor-pointer',
        )}
        style={{ aspectRatio: note.front.aspect }}
        onClick={selected ? undefined : onSelect}
      >
        <div
          className={cn(
            'absolute inset-0 transition-transform duration-700 ease-in-out transform-3d',
            side === 'back' && 'rotate-y-180',
          )}
        >
          {face('front')}
          {face('back', 'rotate-y-180')}
        </div>
      </div>
      <FlipButton side={side} onClick={onFlip} />
    </div>
  )
}

/** Every denomination of a currency stacked in one frame, heat = share of notes touched */
function CombinedStage({
  notes,
  side,
  showPhoto,
  mono,
  onFlip,
  ref,
}: {
  notes: Note[]
  side: Side
  showPhoto: boolean
  mono: boolean
  onFlip: () => void
  ref?: React.Ref<HTMLDivElement>
}) {
  const aspect = notes.reduce((s, n) => s + n.front.aspect, 0) / notes.length
  const vertical = notes[0].front.orientation === 'vertical'
  const face = (s: Side, className?: string) => {
    const masks = notes.map((n) => maskUrl(n[s])).filter((m): m is string => !!m)
    return (
      <div
        className={cn(
          'absolute inset-0 isolate overflow-hidden rounded-md bg-white shadow-xl backface-hidden',
          className,
        )}
      >
        {notes.map((n) => (
          <img
            key={n.key}
            src={n[s].image}
            alt=""
            draggable={false}
            className={cn(
              'absolute inset-0 size-full object-fill opacity-15 mix-blend-multiply select-none',
              mono && 'grayscale',
            )}
          />
        ))}
        {masks.length > 0 && <TouchHeatLayer masks={masks} aspect={aspect} />}
      </div>
    )
  }
  return (
    <div ref={ref} className="flex flex-col gap-4" style={{ width: widthFor(aspect, vertical) }}>
      <div className="flex items-baseline gap-3 text-2xl">
        <span className="font-semibold">Combined</span>
        <span className="text-muted-foreground">{notes.length} notes</span>
        <span className="ml-auto text-base tracking-wide text-muted-foreground uppercase">
          {side}
        </span>
      </div>
      {showPhoto && (
        <div
          className="grid items-end gap-3"
          style={{ gridTemplateColumns: `repeat(${notes.length}, minmax(0, 1fr))` }}
        >
          {notes.map((n) => {
            const src = photoUrl(n[side])
            return (
              <div key={n.key} className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">{n.label}</span>
                {src ? (
                  <img
                    src={src}
                    alt={`UV photo of ${n.label} ${side}`}
                    draggable={false}
                    className="w-full rounded-sm shadow-md select-none"
                    style={{ aspectRatio: n.front.aspect }}
                  />
                ) : (
                  <div className="rounded-sm bg-muted" style={{ aspectRatio: n.front.aspect }} />
                )}
              </div>
            )
          })}
        </div>
      )}
      <div className="relative perspective-[2400px]" style={{ aspectRatio: aspect }}>
        <div
          className={cn(
            'absolute inset-0 transition-transform duration-700 ease-in-out transform-3d',
            side === 'back' && 'rotate-y-180',
          )}
        >
          {face('front')}
          {face('back', 'rotate-y-180')}
        </div>
      </div>
      <FlipButton side={side} onClick={onFlip} />
    </div>
  )
}

export function TouchPage() {
  const [initial] = useState(readUrl)
  const [currency, setCurrency] = useState<TouchCurrency>(initial.currency)
  const [layout, setLayout] = useState<Layout>(initial.layout)
  const [selected, setSelected] = useState<Partial<Record<TouchCurrency, string>>>(() => ({
    [initial.currency]: `${initial.currency}-${initial.denomination}`,
  }))
  const [sides, setSides] = useState<Record<string, Side>>({})
  const [combinedSide, setCombinedSide] = useState<Side>('front')
  const [panelOpen, setPanelOpen] = useState(true)
  const [zoomSlot, setZoomSlot] = useState<HTMLDivElement | null>(null)
  const column = useColumnWidth()
  const [showPhoto, setShowPhoto] = useState(initial.showPhoto)
  const [mono, setMono] = useState(initial.mono)

  const notes = notesOf(currency)
  const note = notes.find((n) => n.key === selected[currency]) ?? notes[0]
  const sideOf = (key: string): Side => sides[key] ?? 'front'
  const side = layout === 'combined' ? combinedSide : sideOf(note.key)
  const vertical = notes[0].front.orientation === 'vertical'
  const extracted = notes.flatMap((n) => [n.front, n.back]).filter((e) => e.extraction)

  const singleRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const combinedRef = useRef<HTMLDivElement>(null)

  function select(key: string) {
    setSelected((s) => ({ ...s, [currency]: key }))
  }

  function flip(key = note.key) {
    if (layout === 'combined') {
      setCombinedSide((s) => (s === 'front' ? 'back' : 'front'))
      return
    }
    if (key !== note.key) select(key)
    setSides((s) => ({ ...s, [key]: sideOf(key) === 'front' ? 'back' : 'front' }))
  }

  useEffect(() => {
    const p = new URLSearchParams({ c: currency, d: String(note.denomination) })
    if (layout !== 'single') p.set('view', layout)
    if (showPhoto) p.set('photo', '1')
    if (mono) p.set('bw', '1')
    history.replaceState(null, '', `?${p}#/touch`)
  }, [currency, note.denomination, layout, showPhoto, mono])

  // Keyboard: F flip · ←/→ denomination · 1–4 currency · G cycle layout · U UV photo · B black & white
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey)
        return
      const i = notes.findIndex((n) => n.key === note.key)
      if (e.key === 'f' || e.key === 'F') flip()
      else if (e.key === 'g' || e.key === 'G') {
        const l = LAYOUTS.findIndex((x) => x.value === layout)
        setLayout(LAYOUTS[(l + 1) % LAYOUTS.length].value)
      } else if (e.key === 'u' || e.key === 'U') setShowPhoto((v) => !v)
      else if (e.key === 'b' || e.key === 'B') setMono((v) => !v)
      else if (e.key === 'ArrowRight') select(notes[(i + 1) % notes.length].key)
      else if (e.key === 'ArrowLeft') select(notes[(i - 1 + notes.length) % notes.length].key)
      else if (/^[1-4]$/.test(e.key)) setCurrency(TOUCH_CURRENCIES[Number(e.key) - 1].code)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const fitKey = [
    layout,
    currency,
    layout === 'single' ? note.key : '',
    panelOpen,
    showPhoto,
    column.settled,
  ].join('|')
  const coverageOf = (s: Side) => {
    const list = notes
      .map((n) => n[s].extraction?.coverage)
      .filter((v): v is number => v !== undefined)
    return list.length ? list.reduce((a, b) => a + b, 0) / list.length : undefined
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-background text-foreground">
      <CanvasStage
        controlsContainer={zoomSlot}
        fitTarget={{ single: singleRef, grid: gridRef, combined: combinedRef }[layout]}
        fitKey={fitKey}
        insets={{
          top: 64,
          bottom: 150,
          // Column panels + its padding, plus a small gap before the note.
          left: column.settled + 40,
          right: 24,
        }}
      >
        {layout === 'single' && (
          <TouchNote
            key={note.key}
            ref={singleRef}
            note={note}
            side={side}
            showPhoto={showPhoto}
            mono={mono}
            onFlip={() => flip()}
          />
        )}
        {layout === 'grid' && (
          <div
            ref={gridRef}
            className={cn('grid gap-x-28 gap-y-40 p-8', vertical ? 'grid-cols-6' : 'grid-cols-3')}
          >
            {notes.map((n) => (
              <TouchNote
                key={n.key}
                note={n}
                side={sideOf(n.key)}
                showPhoto={showPhoto}
                mono={mono}
                caption
                selected={n.key === note.key}
                onSelect={() => select(n.key)}
                onFlip={() => flip(n.key)}
              />
            ))}
          </div>
        )}
        {layout === 'combined' && (
          <CombinedStage
            ref={combinedRef}
            notes={notes}
            side={combinedSide}
            showPhoto={showPhoto}
            mono={mono}
            onFlip={() => flip()}
          />
        )}
      </CanvasStage>

      {/* Left column: page navigation, view modes, details */}
      <header
        className="pointer-events-none absolute top-0 bottom-36 left-0 z-10 flex max-w-[calc(100vw-2rem)] flex-col items-stretch gap-2 p-4"
        style={{ width: column.width + 32 }}
      >
        <PageSwitcher current="touch" />
        <ModePanel modes={LAYOUTS} value={layout} onChange={setLayout}>
          <label
            className="flex items-center gap-2 px-2 py-1 text-sm whitespace-nowrap"
            title="Show the UV photo above each note (U)"
          >
            <Switch checked={showPhoto} onCheckedChange={setShowPhoto} />
            UV photo
          </label>
          <label
            className="flex items-center gap-2 px-2 py-1 text-sm whitespace-nowrap"
            title="Show the notes in black and white so only the ink heat has colour (B)"
          >
            <Switch checked={mono} onCheckedChange={setMono} />
            B&amp;W
          </label>
        </ModePanel>
        {/* Details for the selected note */}
        {panelOpen ? (
          <aside className="pointer-events-auto flex min-h-0 flex-col overflow-hidden rounded-xl border bg-background/95 shadow-lg backdrop-blur">
            <div className="flex items-start gap-2 p-4 pb-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold">
                  {layout === 'combined'
                    ? `All ${TOUCH_CURRENCIES.find((c) => c.code === currency)?.name} notes`
                    : note.label}
                </h2>
                <p className="text-sm text-muted-foreground capitalize">{side}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Hide panel"
                onClick={() => setPanelOpen(false)}
              >
                <PanelLeftClose />
              </Button>
            </div>
            <Separator />
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
              <div>
                <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Touch
                </h3>
                <div className="h-2.5 rounded-full" style={{ backgroundImage: TOUCH_GRADIENT }} />
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>{layout === 'combined' ? 'Few notes' : 'Light'}</span>
                  <span>{layout === 'combined' ? 'Every note' : 'Heavy'}</span>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                {(['front', 'back'] as const).map((s) => (
                  <div key={s}>
                    <div className="text-xs text-muted-foreground capitalize">{s} touched</div>
                    <div
                      className={cn(
                        'text-2xl font-semibold tabular-nums',
                        s !== side && 'text-muted-foreground',
                      )}
                    >
                      {layout === 'combined'
                        ? pct(coverageOf(s))
                        : pct(note[s].extraction?.coverage)}
                    </div>
                  </div>
                ))}
              </div>
              {layout === 'combined' && (
                <p className="text-xs text-muted-foreground">
                  Average share of each note's surface with ink. In the heatmap, colour shows on how
                  many of the {notes.length} notes a spot was touched.
                </p>
              )}
              <Separator />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Three people handled printed notes with invisible ink on their hands; the ink glows
                under UV light. Ink areas were detected from the UV photos and mapped onto the
                reference artwork. All three people are combined.
              </p>
              {extracted.length < notes.length * 2 && (
                <Badge variant="secondary" className="h-auto whitespace-normal">
                  {extracted.length} of {notes.length * 2} sides extracted so far
                </Badge>
              )}
              {import.meta.env.DEV && (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<a href="#/touch/extract" />}
                >
                  <ScanSearch />
                  Open extraction tool
                </Button>
              )}
            </div>
          </aside>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="pointer-events-auto w-fit shadow-sm"
            onClick={() => setPanelOpen(true)}
          >
            <PanelLeftOpen />
            Details
          </Button>
        )}
        <ColumnResizer {...column.handleProps} />
      </header>

      {/* Zoom controls from CanvasStage render here */}
      <div ref={setZoomSlot} className="absolute top-4 right-4 z-10" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 p-4">
        <Tabs
          value={currency}
          onValueChange={(v) => setCurrency(v as TouchCurrency)}
          className="pointer-events-auto max-w-full"
        >
          <TabsList className="h-10! rounded-xl border bg-background/95 p-1 shadow-lg backdrop-blur">
            {TOUCH_CURRENCIES.map((c) => (
              <TabsTrigger key={c.code} value={c.code} className="rounded-lg px-3" title={c.name}>
                <span className="max-lg:hidden">{c.name}</span>
                <span className="lg:hidden">{c.code}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="pointer-events-auto max-w-full">
          <DenominationDock
            notes={notes.map((n) => ({
              id: n.key,
              label: n.label,
              sublabel: pct(n[sideOf(n.key)].extraction?.coverage) + ' touched',
              thumb: n.front.image,
              vertical: n.front.orientation === 'vertical',
            }))}
            selectedId={note.key}
            onSelect={select}
          />
        </div>
      </div>
    </div>
  )
}
