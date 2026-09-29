import { useEffect, useRef, useState } from 'react'
import { Layers, LayoutGrid, PanelLeftOpen, RectangleHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CanvasStage } from '@/components/canvas-stage'
import { ColumnResizer } from '@/components/column-resizer'
import {
  ControlCard,
  ControlSection,
  OptionList,
  Segmented,
  ToggleRow,
} from '@/components/controls'
import { DenominationDock } from '@/components/denomination-dock'
import { DetailsPanel } from '@/components/details-panel'
import { FlipButton } from '@/components/flip-button'
import { HeatmapLayer } from '@/components/heatmap-layer'
import { NoteStage } from '@/components/note-stage'
import { OverlayStage } from '@/components/overlay-stage'
import { PhotoCard } from '@/components/photo-card'
import { TouchHeatLayer } from '@/components/touch-heat-layer'
import { useFlows } from '@/data/store'
import { CURRENCIES, type CurrencyCode, type Side } from '@/data/types'
import { useColumnWidth } from '@/hooks/use-column-width'
import { maskUrl, photoUrl, studyNotes, withoutFlow, type StudyNote } from '@/lib/study-notes'
import type { TouchPalette } from '@/lib/touch-palette'
import { cn } from '@/lib/utils'

type Layout = 'single' | 'grid' | 'combined'
type FlowMode = 'markers' | 'heatmap'

const LAYOUTS: { value: Layout; label: string; icon: typeof Layers }[] = [
  { value: 'single', label: 'Single', icon: RectangleHorizontal },
  { value: 'grid', label: 'All notes', icon: LayoutGrid },
  { value: 'combined', label: 'Combined', icon: Layers },
]

const FLOW_MODES: { value: FlowMode; label: string }[] = [
  { value: 'markers', label: 'Markers' },
  { value: 'heatmap', label: 'Heatmap' },
]

function readUrl(legacyTouch: boolean) {
  const p = new URLSearchParams(location.search)
  const c = p.get('c')?.toUpperCase()
  const view = p.get('view')
  return {
    currency: (CURRENCIES.some((x) => x.code === c) ? c : 'EUR') as CurrencyCode,
    denomination: Number(p.get('d')) || null,
    // Older links used overlay / heatmap (flow page) and combined (touch page).
    layout: (view === 'grid'
      ? 'grid'
      : view && ['combined', 'overlay', 'heatmap'].includes(view)
        ? 'combined'
        : 'single') as Layout,
    showFlow: p.has('flow') ? p.get('flow') !== '0' : !legacyTouch,
    flowMode: (p.get('eye') === 'heatmap' || view === 'heatmap' || p.get('mode') === 'heatmap'
      ? 'heatmap'
      : 'markers') as FlowMode,
    showTouch: p.get('touch') !== '0',
    showPhoto: p.get('photo') === '1',
    mono: p.get('bw') === '1',
  }
}

/** Every denomination of a currency as a row of UV photos (Combined layout) */
function PhotoRow({ notes, side }: { notes: StudyNote[]; side: Side }) {
  return (
    <div
      className="grid items-end gap-3"
      style={{ gridTemplateColumns: `repeat(${notes.length}, minmax(0, 1fr))` }}
    >
      {notes.map((n) => {
        const src = photoUrl(n.touch[side])
        return (
          <div key={n.key} className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{n.label}</span>
            {src ? (
              <img
                src={src}
                alt={`UV photo of ${n.label} ${side}`}
                draggable={false}
                className="w-full rounded-sm shadow-md select-none"
                style={{ aspectRatio: n.obs.aspect }}
              />
            ) : (
              <div className="rounded-sm bg-muted" style={{ aspectRatio: n.obs.aspect }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * The whole study on one canvas: eye flow (where people looked, in order) and touch
 * (where they held the note), each switchable, across single, all-notes and combined layouts.
 */
export function StudyPage({ legacyTouch = false }: { legacyTouch?: boolean }) {
  const { flows, dirty, setPoints, discard, save, exportJson } = useFlows()
  const [initial] = useState(() => readUrl(legacyTouch))
  const [currency, setCurrency] = useState<CurrencyCode>(initial.currency)
  const [layout, setLayout] = useState<Layout>(initial.layout)
  const [selected, setSelected] = useState<Partial<Record<CurrencyCode, string>>>(
    initial.denomination
      ? { [initial.currency]: `${initial.currency}-${initial.denomination}` }
      : {},
  )
  const [sides, setSides] = useState<Record<string, Side>>({})
  // The combined stack flips as one, independent of the per-note sides.
  const [combinedSide, setCombinedSide] = useState<Side>('front')

  const [showFlow, setShowFlow] = useState(initial.showFlow)
  const [flowMode, setFlowMode] = useState<FlowMode>(initial.flowMode)
  const [showAllFlows, setShowAllFlows] = useState(false)
  const [showTouch, setShowTouch] = useState(initial.showTouch)
  const [showPhoto, setShowPhoto] = useState(initial.showPhoto)
  const [mono, setMono] = useState(initial.mono)

  const [editing, setEditing] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const [zoomSlot, setZoomSlot] = useState<HTMLDivElement | null>(null)
  const column = useColumnWidth()
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const notes = studyNotes(flows, currency)
  const note = notes.find((n) => n.key === selected[currency]) ?? notes[0]
  const sideOf = (key: string): Side => sides[key] ?? 'front'
  // All notes and Combined flip as a group; Single flips just its note.
  const grouped = layout !== 'single'
  const side = grouped ? combinedSide : sideOf(note.key)
  const vertical = note.obs.orientation === 'vertical'
  // Touch turns violet next to eye flow so it doesn't clash with the warm-to-cool gaze colours.
  const touchPalette: TouchPalette = showFlow ? 'violet' : 'warm'
  const markers = showFlow && flowMode === 'markers'

  const singleRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const combinedRef = useRef<HTMLDivElement>(null)

  function select(key: string) {
    setSelected((s) => ({ ...s, [currency]: key }))
    setHighlighted(null)
  }

  /** Flips the note in Single, or every note at once in All notes and Combined */
  function flip() {
    setHighlighted(null)
    if (grouped) {
      setCombinedSide((s) => (s === 'front' ? 'back' : 'front'))
      return
    }
    setSides((s) => ({ ...s, [note.key]: sideOf(note.key) === 'front' ? 'back' : 'front' }))
  }

  async function handleSave() {
    const ok = await save()
    setStatus(ok ? 'Saved to src/data/flows.json' : 'Save failed — use Export instead')
    window.setTimeout(() => setStatus(null), 3000)
  }

  /** Layers drawn between the artwork and the flow markers of one note */
  const underlay = (n: StudyNote) => (s: Side) => {
    const mask = showTouch ? maskUrl(n.touch[s]) : null
    return (
      <>
        {mask && <TouchHeatLayer masks={[mask]} aspect={n.obs.aspect} palette={touchPalette} />}
        {showFlow && flowMode === 'heatmap' && n.flow && (
          <HeatmapLayer notes={[n.flow]} side={s} aspect={n.obs.aspect} />
        )}
      </>
    )
  }

  const photoAbove = (n: StudyNote, s: Side) =>
    showTouch && showPhoto && (n.touch.front || n.touch.back) ? (
      <PhotoCard
        aspect={n.obs.aspect}
        side={s}
        front={photoUrl(n.touch.front)}
        back={photoUrl(n.touch.back)}
      />
    ) : null

  /** Touch heat of every denomination, averaged into the combined frame */
  const combinedUnderlay = (s: Side) => {
    if (!showTouch) return null
    const masks = notes.map((n) => maskUrl(n.touch[s])).filter((m): m is string => !!m)
    const aspect = notes.reduce((sum, n) => sum + n.obs.aspect, 0) / notes.length
    return masks.length ? (
      <TouchHeatLayer masks={masks} aspect={aspect} palette={touchPalette} />
    ) : null
  }

  const touchCoverage = (s: Side) => {
    if (layout !== 'combined') return note.touch[s]?.extraction?.coverage
    const list = notes
      .map((n) => n.touch[s]?.extraction?.coverage)
      .filter((v): v is number => v !== undefined)
    return list.length ? list.reduce((a, b) => a + b, 0) / list.length : undefined
  }

  const editPoints = (n: StudyNote) => (s: Side, points: Parameters<typeof setPoints>[2]) => {
    if (n.flow) setPoints(n.flow.id, s, points)
  }

  // Shareable URL for the current view.
  useEffect(() => {
    const p = new URLSearchParams({ c: currency, d: String(note.denomination) })
    if (layout !== 'single') p.set('view', layout)
    if (!showFlow) p.set('flow', '0')
    if (flowMode === 'heatmap') p.set('eye', 'heatmap')
    if (!showTouch) p.set('touch', '0')
    if (showPhoto) p.set('photo', '1')
    if (mono) p.set('bw', '1')
    history.replaceState(null, '', `?${p}`)
  }, [currency, note.denomination, layout, showFlow, flowMode, showTouch, showPhoto, mono])

  // Keyboard: F flip · ←/→ denomination · 1–5 currency · G layout
  // E eye flow · H markers/heatmap · T touch · U UV photo · B black & white
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey)
        return
      const i = notes.findIndex((n) => n.key === note.key)
      const k = e.key.toLowerCase()
      if (k === 'f') flip()
      else if (k === 'g') {
        const l = LAYOUTS.findIndex((x) => x.value === layout)
        setLayout(LAYOUTS[(l + 1) % LAYOUTS.length].value)
      } else if (k === 'e') setShowFlow((v) => !v)
      else if (k === 'h') setFlowMode((m) => (m === 'heatmap' ? 'markers' : 'heatmap'))
      else if (k === 't') setShowTouch((v) => !v)
      else if (k === 'u') setShowPhoto((v) => !v)
      else if (k === 'b') setMono((v) => !v)
      else if (e.key === 'ArrowRight') select(notes[(i + 1) % notes.length].key)
      else if (e.key === 'ArrowLeft') select(notes[(i - 1 + notes.length) % notes.length].key)
      else if (/^[1-5]$/.test(e.key)) setCurrency(CURRENCIES[Number(e.key) - 1].code)
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
    showTouch && showPhoto,
    column.settled,
  ].join('|')

  const gridCols = vertical ? Math.min(notes.length, 6) : notes.length > 4 ? 3 : 2

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
          <NoteStage
            key={note.key}
            ref={singleRef}
            note={markers ? note.obs : withoutFlow(note.obs)}
            side={side}
            editing={editing && markers && !!note.flow}
            mono={mono}
            underlay={underlay(note)}
            above={photoAbove(note, side)}
            highlighted={highlighted}
            onHighlight={setHighlighted}
            onPointsChange={editPoints(note)}
            onFlip={() => flip()}
          />
        )}
        {layout === 'grid' && (
          <div ref={gridRef} className="flex flex-col items-center gap-10 p-8">
            <div
              className="grid gap-x-28 gap-y-24"
              style={{ gridTemplateColumns: `repeat(${gridCols}, max-content)` }}
            >
              {notes.map((n) => (
                <NoteStage
                  key={n.key}
                  note={markers ? n.obs : withoutFlow(n.obs)}
                  side={combinedSide}
                  editing={editing && markers && !!n.flow}
                  selected={n.key === note.key}
                  caption
                  subtitle={n.flow?.observer ?? 'Touch only'}
                  mono={mono}
                  underlay={underlay(n)}
                  above={photoAbove(n, combinedSide)}
                  highlighted={highlighted}
                  onHighlight={setHighlighted}
                  onPointsChange={editPoints(n)}
                  onSelect={() => select(n.key)}
                />
              ))}
            </div>
            {/* One button turns every note over together */}
            <FlipButton side={combinedSide} onClick={flip} all />
          </div>
        )}
        {layout === 'combined' && (
          <OverlayStage
            ref={combinedRef}
            title="Combined"
            notes={notes.map((n) => (showFlow ? n.obs : withoutFlow(n.obs)))}
            mode={showFlow && flowMode === 'heatmap' ? 'heatmap' : 'flow'}
            selectedId={note.obs.id}
            showAll={showAllFlows}
            side={combinedSide}
            editing={editing && markers && !!note.flow}
            mono={mono}
            underlay={combinedUnderlay}
            above={showTouch && showPhoto ? <PhotoRow notes={notes} side={combinedSide} /> : null}
            highlighted={highlighted}
            onHighlight={setHighlighted}
            onPointsChange={setPoints}
            onFlip={() => flip()}
          />
        )}
      </CanvasStage>

      {/* Left column: title, controls (layout · eye flow · touch · general), details */}
      <header
        className="pointer-events-none absolute top-0 bottom-36 left-0 z-10 flex max-w-[calc(100vw-2rem)] flex-col items-stretch gap-2 overflow-y-auto p-4"
        style={{ width: column.width + 32 }}
      >
        {/* Card 1: what this is, and how the notes are laid out */}
        <ControlCard>
          <div className="px-3.5 pt-3 pb-2.5">
            <h1 className="text-[15px] leading-tight font-semibold">Banknote Ergo Research</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Eye flow &amp; touch · Oberthur Fiduciaire
            </p>
          </div>
          <ControlSection title="Layout" shortcut="G">
            <OptionList label="Layout" options={LAYOUTS} value={layout} onChange={setLayout} />
          </ControlSection>
        </ControlCard>

        {/* Card 2: what is drawn on the notes */}
        <ControlCard>
          <ControlSection title="Eye flow" shortcut="E · H">
            <ToggleRow
              label="Show eye flow"
              checked={showFlow}
              onChange={setShowFlow}
              hint="Where people looked, in order (E)"
            />
            <Segmented
              label="Eye flow display"
              options={FLOW_MODES}
              value={flowMode}
              onChange={setFlowMode}
              disabled={!showFlow}
            />
            {layout === 'combined' && flowMode === 'markers' && (
              <ToggleRow
                label="All flows equally"
                checked={showAllFlows}
                onChange={setShowAllFlows}
                disabled={!showFlow}
                hint="Show every observer at full strength instead of focusing the selected one"
              />
            )}
          </ControlSection>

          <ControlSection title="Touch" shortcut="T · U">
            <ToggleRow
              label="Show touch"
              checked={showTouch}
              onChange={setShowTouch}
              hint="Where people held the note, from the UV-ink photos (T)"
            />
            <ToggleRow
              label="UV photo"
              checked={showPhoto}
              onChange={setShowPhoto}
              disabled={!showTouch}
              hint="Show the UV photo above the note (U)"
            />
          </ControlSection>

          <ControlSection title="General" shortcut="B">
            <ToggleRow
              label="B&W note"
              checked={mono}
              onChange={setMono}
              hint="Show the artwork in black and white so only the data has colour (B)"
            />
          </ControlSection>
        </ControlCard>

        {panelOpen ? (
          <div className="pointer-events-auto flex min-h-64 flex-col">
            <DetailsPanel
              note={note}
              side={side}
              combined={layout === 'combined'}
              showFlow={showFlow}
              flowMode={flowMode}
              showTouch={showTouch}
              touchPalette={touchPalette}
              touchCoverage={touchCoverage}
              editing={editing}
              dirty={dirty}
              status={status}
              highlighted={highlighted}
              onHighlight={setHighlighted}
              onPointsChange={editPoints(note)}
              onClose={() => setPanelOpen(false)}
              onSave={handleSave}
              onExport={exportJson}
              onDiscard={discard}
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
      </header>
      <div
        className="pointer-events-none absolute top-0 bottom-36 left-0 z-10"
        style={{ width: column.width + 32 }}
      >
        <ColumnResizer {...column.handleProps} />
      </div>

      {/* Top right: zoom, then the Edit tool (a tool, not a view option) */}
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
        <div ref={setZoomSlot} />
        <label
          className={cn(
            'flex items-center gap-2 rounded-lg border bg-background/95 px-2.5 py-1.5 text-sm shadow-sm backdrop-blur',
            !(markers && note.flow) && 'text-muted-foreground',
          )}
          title={
            markers && note.flow
              ? 'Edit the eye-flow points'
              : 'Editing needs eye flow shown as markers on a note with a recording'
          }
        >
          <Switch
            checked={editing}
            onCheckedChange={setEditing}
            disabled={!(markers && note.flow)}
          />
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
              id: n.key,
              label: n.label,
              sublabel: n.flow?.observer ?? 'Touch only',
              thumb: n.obs.front.image,
              vertical: n.obs.orientation === 'vertical',
            }))}
            selectedId={note.key}
            onSelect={select}
          />
        </div>
      </div>
    </div>
  )
}
