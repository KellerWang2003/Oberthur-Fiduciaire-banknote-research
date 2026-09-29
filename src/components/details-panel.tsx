import { Download, Hand, PanelLeftClose, Save, ScanSearch, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { FlowPoint, Side } from '@/data/types'
import { HEAT_GRADIENT, ORDER_LEGEND } from '@/lib/order'
import type { StudyNote } from '@/lib/study-notes'
import { touchGradient, type TouchPalette } from '@/lib/touch-palette'
import { cn } from '@/lib/utils'
import { StepList } from './step-list'

type Props = {
  note: StudyNote
  side: Side
  combined: boolean
  showFlow: boolean
  flowMode: 'markers' | 'heatmap'
  showTouch: boolean
  touchPalette: TouchPalette
  /** Share of the surface touched per side (averaged over all notes when combined) */
  touchCoverage: (side: Side) => number | undefined
  editing: boolean
  dirty: boolean
  status: string | null
  highlighted: string | null
  onHighlight: (id: string | null) => void
  onPointsChange: (side: Side, points: FlowPoint[]) => void
  onClose: () => void
  onSave: () => void
  onExport: () => void
  onDiscard: () => void
}

const pct = (v: number | undefined) => (v === undefined ? '—' : `${Math.round(v * 100)}%`)

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  )
}

function Scale({ gradient, from, to }: { gradient: string; from: string; to: string }) {
  return (
    <>
      <div className="h-2.5 rounded-full" style={{ backgroundImage: gradient }} />
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{from}</span>
        <span>{to}</span>
      </div>
    </>
  )
}

/** Left-column details for the selected note: eye flow and touch, depending on what's shown */
export function DetailsPanel({
  note,
  side,
  combined,
  showFlow,
  flowMode,
  showTouch,
  touchPalette,
  touchCoverage,
  editing,
  dirty,
  status,
  highlighted,
  onHighlight,
  onPointsChange,
  onClose,
  onSave,
  onExport,
  onDiscard,
}: Props) {
  const flow = note.flow
  const hasTouch = !!(note.touch.front?.extraction || note.touch.back?.extraction)
  const canEdit = editing && !!flow && showFlow && flowMode === 'markers'

  return (
    <aside className="flex min-h-0 w-full flex-col overflow-hidden rounded-xl border bg-background/95 shadow-lg backdrop-blur">
      <div className="flex items-start gap-2 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-semibold">{note.label}</h2>
            <span className="text-sm text-muted-foreground capitalize">{side}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{flow ? flow.observer : 'No eye-flow recording'}</Badge>
            {flow?.grip && (
              <Badge variant="outline" className="h-auto whitespace-normal">
                <Hand />
                {flow.grip}
              </Badge>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Hide panel" onClick={onClose}>
          <PanelLeftClose />
        </Button>
      </div>

      <Separator />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {showFlow && (
          <div className="flex flex-col gap-3">
            <div>
              <Heading>Eye flow</Heading>
              {flowMode === 'heatmap' ? (
                <Scale gradient={HEAT_GRADIENT} from="Seen first" to="Seen later" />
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  {ORDER_LEGEND.map((o) => (
                    <span
                      key={o.label}
                      className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
                      style={{ backgroundColor: o.color, opacity: o.opacity }}
                    >
                      {o.label}
                    </span>
                  ))}
                  <span className="ml-1 text-xs text-muted-foreground">first → later</span>
                </div>
              )}
              {combined && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {flowMode === 'heatmap'
                    ? 'All observers combined, including the path between points.'
                    : 'The selected observer is in focus; initials mark where each flow starts.'}
                </p>
              )}
            </div>
            {flow ? (
              <>
                <div>
                  <Heading>{side} · viewing order</Heading>
                  <StepList
                    points={flow[side].points}
                    editing={canEdit}
                    highlighted={highlighted}
                    onHighlight={onHighlight}
                    onChange={(points) => onPointsChange(side, points)}
                  />
                  {canEdit && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Click the note to add a point · drag a marker to move it
                    </p>
                  )}
                </div>
                <blockquote className="border-l-2 pl-3 text-sm leading-relaxed text-muted-foreground">
                  “{flow.quote}”
                </blockquote>
                {flow.notes && <p className="text-xs text-muted-foreground">Note: {flow.notes}</p>}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                This denomination wasn't part of the eye-flow session.
              </p>
            )}
          </div>
        )}

        {showFlow && showTouch && <Separator />}

        {showTouch && (
          <div className="flex flex-col gap-3">
            <div>
              <Heading>Touch</Heading>
              <Scale
                gradient={touchGradient(touchPalette)}
                from={combined ? 'Few notes' : 'Light'}
                to={combined ? 'Every note' : 'Heavy'}
              />
            </div>
            {hasTouch || combined ? (
              <div className="grid grid-cols-2 gap-3">
                {(['front', 'back'] as const).map((s) => (
                  <div key={s}>
                    <div className="text-xs text-muted-foreground capitalize">{s} touched</div>
                    <div
                      className={cn(
                        'text-xl font-semibold tabular-nums',
                        s !== side && 'text-muted-foreground',
                      )}
                    >
                      {pct(touchCoverage(s))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                This denomination wasn't part of the UV-ink session.
              </p>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              {combined
                ? 'Average share of each note’s surface with ink; the heat shows on how many notes a spot was touched. '
                : ''}
              Three people handled printed notes with invisible ink on their hands; the ink glows
              under UV light and was mapped onto the artwork. All three are combined.
            </p>
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
        )}

        {!showFlow && !showTouch && (
          <p className="text-xs text-muted-foreground">Turn on Eye flow or Touch to see data.</p>
        )}
      </div>

      {canEdit && (
        <>
          <Separator />
          <div className="flex flex-wrap items-center gap-2 p-3">
            {dirty ? (
              <Badge variant="secondary">Unsaved changes</Badge>
            ) : (
              <span className="text-xs text-muted-foreground">{status ?? 'No changes'}</span>
            )}
            <div className="ml-auto flex gap-1">
              <Button variant="ghost" size="sm" disabled={!dirty} onClick={onDiscard}>
                <Undo2 />
                Discard
              </Button>
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download />
                Export
              </Button>
              <Button size="sm" disabled={!dirty} onClick={onSave}>
                <Save />
                Save
              </Button>
            </div>
          </div>
        </>
      )}
    </aside>
  )
}
