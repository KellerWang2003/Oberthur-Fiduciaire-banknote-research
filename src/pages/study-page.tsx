import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Hand, Layers, LayoutGrid, RectangleHorizontal } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CanvasStage } from '@/components/canvas-stage'
import { ColumnResizer } from '@/components/column-resizer'
import {
  ControlSection,
  LayerToggle,
  Segmented,
  SlidingSwitch,
  ToggleRow,
} from '@/components/controls'
import { DenominationDock } from '@/components/denomination-dock'
import { DetailsPanel } from '@/components/details-panel'
import { EditMenu } from '@/components/edit-menu'
import { EyeLegend, TouchLegend } from '@/components/legends'
import { FlipButton } from '@/components/flip-button'
import { HeatmapLayer } from '@/components/heatmap-layer'
import { NoteStage } from '@/components/note-stage'
import { OverlayStage } from '@/components/overlay-stage'
import { PhotoCard } from '@/components/photo-card'
import { TouchHeatLayer } from '@/components/touch-heat-layer'
import { useFlows } from '@/data/store'
import { CURRENCIES, type Side, type TouchCurrency } from '@/data/types'
import { useColumnWidth } from '@/hooks/use-column-width'
import { maskUrl, photoUrl, studyNotes, withoutFlow, type StudyNote } from '@/lib/study-notes'
import { orderColor } from '@/lib/order'
import { PALETTES, type TouchPalette } from '@/lib/touch-palette'

// USD is hidden: it only has eye-flow data, while the other four have both studies.
const SHOWN = CURRENCIES.filter((c) => c.code !== 'USD') as {
  code: TouchCurrency
  name: string
  series: string
}[]

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

// Icon chips for the two layer switches echo each layer's colour scale.
const EYE_SWATCH = `linear-gradient(135deg, ${orderColor(0)}, ${orderColor(1)} 45%, ${orderColor(4)})`
// Flat, slight tile tints for a layer that's switched on (no gradient)
const EYE_TINT = 'rgb(255 246 241)'
const TOUCH_TINT: Record<TouchPalette, string> = {
  violet: 'rgb(246 244 255)',
  warm: 'rgb(255 250 238)',
}
const touchSwatch = (palette: TouchPalette) => {
  // The darker two-thirds of the scale, so the white icon stays legible.
  const [, a, b, c] = PALETTES[palette].map(([, rgb]) => `rgb(${rgb.join(' ')})`)
  return `linear-gradient(135deg, ${a}, ${b} 55%, ${c})`
}

function readUrl(legacyTouch: boolean) {
  const p = new URLSearchParams(location.search)
  const c = p.get('c')?.toUpperCase()
  const view = p.get('view')
  return {
    currency: (SHOWN.some((x) => x.code === c) ? c : 'EUR') as TouchCurrency,
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
  const [currency, setCurrency] = useState<TouchCurrency>(initial.currency)
  const [layout, setLayout] = useState<Layout>(initial.layout)
  const [selected, setSelected] = useState<Partial<Record<TouchCurrency, string>>>(
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
  // Notes start collapsed; the legends live with the layer switches, so they're always visible.
  const [detailsOpen, setDetailsOpen] = useState(false)
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
  const canEditFlow = markers && !!note.flow

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

  /** Marks notes that weren't part of the eye-flow session, while eye flow is shown */
  const noFlowBadge = (n: StudyNote) =>
    showFlow && !n.flow ? (
      <span className="flex items-center gap-1.5 rounded-lg border bg-background/95 px-2.5 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground shadow-md backdrop-blur">
        <EyeOff className="size-4" />
        No eye-flow data
      </span>
    ) : null

  const flowCount = notes.filter((n) => n.flow).length
  const combinedCaption =
    showFlow && flowCount < notes.length
      ? `${notes.length} notes · eye flow on ${flowCount}`
      : `${notes.length} notes`

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

  // Keyboard: F flip · ←/→ denomination · 1–4 currency · G layout
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
      else if (/^[1-4]$/.test(e.key)) setCurrency(SHOWN[Number(e.key) - 1].code)
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
          // Sidebar width plus a small gap before the note.
          left: column.settled + 24,
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
            badge={noFlowBadge(note)}
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
                  subtitle={n.flow?.observer ?? 'No eye-flow data'}
                  badge={noFlowBadge(n)}
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
            caption={combinedCaption}
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

      {/* Top centre of the canvas area: layout switch */}
      <div
        className="pointer-events-none absolute top-4 right-0 z-10 flex justify-center"
        style={{ left: column.width }}
      >
        <SlidingSwitch
          label="Layout"
          shortcut="G"
          options={LAYOUTS}
          value={layout}
          onChange={setLayout}
        />
      </div>

      {/* Docked sidebar (like Figma's design panel): flat sections divided by rules */}
      <aside
        className="absolute inset-y-0 left-0 z-20 flex max-w-[calc(100vw-4rem)] flex-col overflow-y-auto border-r bg-background"
        style={{ width: column.width }}
      >
        <div className="border-b px-4 pt-4 pb-3">
          <h1 className="text-[15px] leading-tight font-semibold">Banknote Ergo Research</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Eye flow &amp; touch · Oberthur Fiduciaire
          </p>
        </div>

        {/* The two data layers are the primary controls: large tiles */}
        <div className="flex flex-col gap-2 border-b p-3">
          <h2 className="px-1 text-[10px] font-medium tracking-wider text-muted-foreground/80 uppercase">
            Layers
          </h2>
          <LayerToggle
            icon={Eye}
            title="Eye flow"
            description="Where people looked"
            shortcut="E"
            swatch={EYE_SWATCH}
            tint={EYE_TINT}
            checked={showFlow}
            onChange={setShowFlow}
          >
            <Segmented
              label="Eye flow display"
              options={FLOW_MODES}
              value={flowMode}
              onChange={setFlowMode}
            />
            {layout === 'combined' && flowMode === 'markers' && (
              <ToggleRow
                label="All flows equally"
                checked={showAllFlows}
                onChange={setShowAllFlows}
                hint="Show every observer at full strength instead of focusing the selected one"
              />
            )}
            <EyeLegend mode={flowMode} combined={layout === 'combined'} />
          </LayerToggle>
          <LayerToggle
            icon={Hand}
            title="Touch"
            description="Where people held it"
            shortcut="T"
            swatch={touchSwatch(touchPalette)}
            tint={TOUCH_TINT[touchPalette]}
            checked={showTouch}
            onChange={setShowTouch}
          >
            <TouchLegend palette={touchPalette} combined={layout === 'combined'} />
          </LayerToggle>
        </div>

        <div className="border-b px-2 pb-1">
          <ControlSection title="General">
            <ToggleRow
              label="UV photo"
              checked={showPhoto}
              onChange={setShowPhoto}
              disabled={!showTouch}
              hint={
                showTouch
                  ? 'Show the UV photo above the note (U)'
                  : 'Turn on Touch to show the UV photos (U)'
              }
            />
            <ToggleRow
              label="B&W note"
              checked={mono}
              onChange={setMono}
              hint="Show the artwork in black and white so only the data has colour (B)"
            />
          </ControlSection>
        </div>

        <DetailsPanel
          note={note}
          side={side}
          combined={layout === 'combined'}
          showFlow={showFlow}
          flowMode={flowMode}
          showTouch={showTouch}
          touchCoverage={touchCoverage}
          editing={editing}
          dirty={dirty}
          status={status}
          highlighted={highlighted}
          onHighlight={setHighlighted}
          onPointsChange={editPoints(note)}
          onSave={handleSave}
          onExport={exportJson}
          onDiscard={discard}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      </aside>
      {/* Resize handle on the sidebar's right edge */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-20"
        style={{ width: column.width }}
      >
        <ColumnResizer {...column.handleProps} />
      </div>

      {/* Top right: zoom, then the Edit menu (data-correction tools, not view options) */}
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
        <div ref={setZoomSlot} />
        <EditMenu
          editing={editing && canEditFlow}
          onEditingChange={setEditing}
          canEditFlow={canEditFlow}
        />
      </div>

      {/* Bottom of the canvas area: currency tabs above the denomination dock */}
      <div
        className="pointer-events-none absolute right-0 bottom-0 z-10 flex flex-col items-center gap-2 p-4"
        style={{ left: column.width }}
      >
        <Tabs
          value={currency}
          onValueChange={(v) => setCurrency(v as TouchCurrency)}
          className="pointer-events-auto max-w-full"
        >
          <TabsList className="h-10! rounded-xl border bg-background/95 p-1 shadow-lg backdrop-blur">
            {SHOWN.map((c) => (
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
              sublabel: n.flow?.observer ?? 'No eye flow',
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
