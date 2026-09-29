import { useEffect, useRef, useState } from 'react'
import { Flame, Layers, LayoutGrid, PanelLeftOpen, RectangleHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CanvasStage } from '@/components/canvas-stage'
import { DenominationDock } from '@/components/denomination-dock'
import { InspectorPanel } from '@/components/inspector-panel'
import { NoteStage } from '@/components/note-stage'
import { OverlayStage } from '@/components/overlay-stage'
import { ModePanel } from '@/components/mode-panel'
import { ColumnResizer } from '@/components/column-resizer'
import { PageSwitcher } from '@/components/page-switcher'
import { useColumnWidth } from '@/hooks/use-column-width'
import { useFlows } from '@/data/store'
import { CURRENCIES, type CurrencyCode, type Side } from '@/data/types'
import { cn } from '@/lib/utils'

type Layout = 'single' | 'grid' | 'overlay' | 'heatmap'

const LAYOUTS: { value: Layout; label: string; icon: typeof Layers }[] = [
  { value: 'single', label: 'Single', icon: RectangleHorizontal },
  { value: 'grid', label: 'All 4', icon: LayoutGrid },
  { value: 'overlay', label: 'Overlay', icon: Layers },
  { value: 'heatmap', label: 'Overlay heatmap', icon: Flame },
]


function readUrl() {
  const p = new URLSearchParams(location.search)
  const c = p.get('c')?.toUpperCase()
  return {
    currency: (CURRENCIES.some((x) => x.code === c) ? c : 'USD') as CurrencyCode,
    denomination: Number(p.get('d')) || null,
    // `mode=heatmap` is kept so older overlay links still open the heatmap.
    layout: (p.get('view') === 'overlay' && p.get('mode') === 'heatmap'
      ? 'heatmap'
      : (LAYOUTS.find((l) => l.value === p.get('view'))?.value ?? 'single')) as Layout,
    mono: p.get('bw') === '1',
  }
}

export function FlowPage() {
  const { flows, dirty, setPoints, discard, save, exportJson } = useFlows()
  const [initial] = useState(readUrl)
  const [currency, setCurrency] = useState<CurrencyCode>(initial.currency)
  const [layout, setLayout] = useState<Layout>(initial.layout)
  // Remembers the selected note per currency.
  const [selected, setSelected] = useState<Partial<Record<CurrencyCode, string>>>(() => {
    const match = flows.find((n) => n.currency === initial.currency && n.denomination === initial.denomination)
    return match ? { [initial.currency]: match.id } : {}
  })
  const [sides, setSides] = useState<Record<string, Side>>({})
  // The overlay flips as one stack, independent of the per-note sides.
  const [overlaySide, setOverlaySide] = useState<Side>('front')
  const [showAllFlows, setShowAllFlows] = useState(false)
  const [editing, setEditing] = useState(false)
  const [mono, setMono] = useState(initial.mono)
  const [panelOpen, setPanelOpen] = useState(true)
  const [zoomSlot, setZoomSlot] = useState<HTMLDivElement | null>(null)
  const column = useColumnWidth()
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const notes = flows
    .filter((n) => n.currency === currency)
    .sort((a, b) => a.denomination - b.denomination)
  const note = notes.find((n) => n.id === selected[currency]) ?? notes[0]
  const sideOf = (id: string): Side => sides[id] ?? 'front'
  // Heatmap is the overlay drawn differently, so it shares the overlay stage and side.
  const view = layout === 'heatmap' ? 'overlay' : layout
  const side = view === 'overlay' ? overlaySide : sideOf(note.id)

  const singleRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  function select(id: string) {
    setSelected((s) => ({ ...s, [currency]: id }))
    setHighlighted(null)
  }

  /** Flips one note (and selects it), or the whole stack in the overlay layouts. */
  function flip(id = note.id) {
    setHighlighted(null)
    if (view === 'overlay') {
      setOverlaySide((s) => (s === 'front' ? 'back' : 'front'))
      return
    }
    if (id !== note.id) select(id)
    setSides((s) => ({ ...s, [id]: sideOf(id) === 'front' ? 'back' : 'front' }))
  }

  async function handleSave() {
    const ok = await save()
    setStatus(ok ? 'Saved to src/data/flows.json' : 'Save failed — use Export instead')
    window.setTimeout(() => setStatus(null), 3000)
  }

  // Shareable URL for the current view.
  useEffect(() => {
    const p = new URLSearchParams({ c: currency, d: String(note.denomination) })
    if (layout !== 'single') p.set('view', layout)
    if (mono) p.set('bw', '1')
    history.replaceState(null, '', `?${p}`)
  }, [currency, note.denomination, layout, mono])

  // Keyboard: F flip · ←/→ denomination · 1–5 currency · G cycle layout · H heatmap · B black & white
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return
      const i = notes.findIndex((n) => n.id === note.id)
      if (e.key === 'f' || e.key === 'F') flip()
      else if (e.key === 'g' || e.key === 'G') {
        const l = LAYOUTS.findIndex((x) => x.value === layout)
        setLayout(LAYOUTS[(l + 1) % LAYOUTS.length].value)
      } else if (e.key === 'h' || e.key === 'H') setLayout((l) => (l === 'heatmap' ? 'overlay' : 'heatmap'))
      else if (e.key === 'b' || e.key === 'B') setMono((v) => !v)
      else if (e.key === 'ArrowRight') select(notes[(i + 1) % notes.length].id)
      else if (e.key === 'ArrowLeft') select(notes[(i - 1 + notes.length) % notes.length].id)
      else if (/^[1-5]$/.test(e.key)) setCurrency(CURRENCIES[Number(e.key) - 1].code)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const vertical = notes[0]?.orientation === 'vertical'
  const fitKey = [view, currency, view === 'single' ? note.id : '', panelOpen, column.settled].join(
    '|',
  )

  return (
    <div className="fixed inset-0 overflow-hidden bg-background text-foreground">
      <CanvasStage
        controlsContainer={zoomSlot}
        fitTarget={{ single: singleRef, grid: gridRef, overlay: overlayRef }[view]}
        fitKey={fitKey}
        insets={{
          top: 64,
          bottom: 150,
          // Column panels + its padding, plus a small gap before the note.
          left: column.settled + 40,
          right: 24,
        }}
      >
        {view === 'single' ? (
          <NoteStage
            mono={mono}
            key={note.id}
            ref={singleRef}
            note={note}
            side={side}
            editing={editing}
            highlighted={highlighted}
            onHighlight={setHighlighted}
            onPointsChange={(s, points) => setPoints(note.id, s, points)}
            onFlip={() => flip()}
          />
        ) : view === 'overlay' ? (
          <OverlayStage
            mono={mono}
            ref={overlayRef}
            notes={notes}
            selectedId={note.id}
            mode={layout === 'heatmap' ? 'heatmap' : 'flow'}
            showAll={showAllFlows}
            side={overlaySide}
            editing={editing}
            highlighted={highlighted}
            onHighlight={setHighlighted}
            onPointsChange={setPoints}
            onFlip={() => flip()}
          />
        ) : (
          <div
            ref={gridRef}
            className={cn('grid gap-x-28 gap-y-40 p-8', vertical ? 'grid-cols-4' : 'grid-cols-2')}
          >
            {notes.map((n) => (
              <NoteStage
                mono={mono}
                key={n.id}
                note={n}
                side={sideOf(n.id)}
                editing={editing}
                selected={n.id === note.id}
                caption
                highlighted={highlighted}
                onHighlight={setHighlighted}
                onPointsChange={(s, points) => setPoints(n.id, s, points)}
                onSelect={() => select(n.id)}
                onFlip={() => flip(n.id)}
              />
            ))}
          </div>
        )}
      </CanvasStage>

      {/* Top bar */}
      {/* Left column: page navigation, view modes, details */}
      <header
        className="pointer-events-none absolute top-0 bottom-36 left-0 z-10 flex max-w-[calc(100vw-2rem)] flex-col items-stretch gap-2 p-4"
        style={{ width: column.width + 32 }}
      >
        <PageSwitcher current="flow" />
        <ModePanel modes={LAYOUTS} value={layout} onChange={setLayout}>
          <label
            className="flex items-center gap-2 px-2 py-1 text-sm whitespace-nowrap"
            title="Show the notes in black and white so only the flow has colour (B)"
          >
            <Switch checked={mono} onCheckedChange={setMono} />
            B&amp;W
          </label>
        </ModePanel>
        {/* Details for the selected note */}
        {panelOpen ? (
          <div className="pointer-events-auto flex min-h-0 flex-col">
            <InspectorPanel
              note={note}
              side={side}
              editing={editing}
              dirty={dirty}
              status={status}
              highlighted={highlighted}
              onHighlight={setHighlighted}
              onPointsChange={(s, points) => setPoints(note.id, s, points)}
              onClose={() => setPanelOpen(false)}
              onSave={handleSave}
              onExport={exportJson}
              onDiscard={discard}
              overlay={layout === 'overlay'}
              heatmap={layout === 'heatmap'}
              showAllFlows={showAllFlows}
              onShowAllFlowsChange={setShowAllFlows}
            />
          </div>
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
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
        <div ref={setZoomSlot} />
        {/* Edit mode is a tool, not a view option, so it sits apart from the left column */}
        <label className="flex items-center gap-2 rounded-lg border bg-background/95 px-2.5 py-1.5 text-sm shadow-sm backdrop-blur">
          <Switch checked={editing} onCheckedChange={setEditing} />
          Edit
        </label>
      </div>


      {/* Bottom: currency tabs above the denomination dock (flip buttons live on the canvas) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 p-4">
        <Tabs
          value={currency}
          onValueChange={(v) => setCurrency(v as CurrencyCode)}
          className="pointer-events-auto max-w-full"
        >
          <TabsList className="h-10! rounded-xl border bg-background/95 p-1 shadow-lg backdrop-blur">
            {CURRENCIES.map((c) => (
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
              id: n.id,
              label: n.label,
              sublabel: n.observer,
              thumb: n.front.image,
              vertical: n.orientation === 'vertical',
            }))}
            selectedId={note.id}
            onSelect={select}
          />
        </div>
      </div>
    </div>
  )
}
