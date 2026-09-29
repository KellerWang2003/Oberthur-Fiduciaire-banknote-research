import { useEffect, useRef, useState } from 'react'
import { Flame, Layers, LayoutGrid, PanelRightOpen, RectangleHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CanvasStage } from '@/components/canvas-stage'
import { DenominationDock } from '@/components/denomination-dock'
import { InspectorPanel } from '@/components/inspector-panel'
import { NoteStage } from '@/components/note-stage'
import { OverlayStage } from '@/components/overlay-stage'
import { PageSwitcher } from '@/components/page-switcher'
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

const PANEL_WIDTH = 360

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
  const [panelOpen, setPanelOpen] = useState(true)
  const [zoomSlot, setZoomSlot] = useState<HTMLDivElement | null>(null)
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
    history.replaceState(null, '', `?${p}`)
  }, [currency, note.denomination, layout])

  // Keyboard: F flip · ←/→ denomination · 1–5 currency · G cycle layout · H heatmap
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
  const fitKey = [view, currency, view === 'single' ? note.id : '', panelOpen].join('|')

  return (
    <div className="fixed inset-0 overflow-hidden bg-background text-foreground">
      <CanvasStage
        controlsContainer={zoomSlot}
        fitTarget={{ single: singleRef, grid: gridRef, overlay: overlayRef }[view]}
        fitKey={fitKey}
        insets={{ top: 72, bottom: 150, left: 24, right: panelOpen ? PANEL_WIDTH + 32 : 24 }}
      >
        {view === 'single' ? (
          <NoteStage
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
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
        <div className="flex flex-col items-start gap-2">
          <PageSwitcher current="flow" subtitle={CURRENCIES.find((c) => c.code === currency)?.series} />
          {/* Zoom controls from CanvasStage render here */}
          <div ref={setZoomSlot} className="pointer-events-auto" />
        </div>


        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border bg-background/95 p-1 pl-1 shadow-sm backdrop-blur">
          <Select value={layout} onValueChange={(v) => setLayout(v as Layout)}>
            <SelectTrigger size="sm" className="border-0 bg-muted shadow-none" title="Layout (G)">
              <SelectValue>
                {(value: Layout) => {
                  const l = LAYOUTS.find((x) => x.value === value)!
                  return (
                    <>
                      <l.icon />
                      {l.label}
                    </>
                  )
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end" alignItemWithTrigger={false}>
              {LAYOUTS.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  <l.icon />
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 pr-2 text-sm whitespace-nowrap">
            <Switch checked={editing} onCheckedChange={setEditing} />
            Edit
          </label>
        </div>
      </header>

      {/* Right inspector */}
      {panelOpen ? (
        <div
          className="pointer-events-none absolute top-20 right-4 bottom-40 z-10 flex max-w-[calc(100vw-2rem)] flex-col"
          style={{ width: PANEL_WIDTH }}
        >
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
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="absolute top-20 right-4 z-10 shadow-sm"
          onClick={() => setPanelOpen(true)}
        >
          <PanelRightOpen />
          Details
        </Button>
      )}

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
