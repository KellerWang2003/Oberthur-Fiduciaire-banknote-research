import { ChevronDown, Download, Hand, Save, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { FlowPoint, Side } from '@/data/types'
import type { StudyNote } from '@/lib/study-notes'
import { cn } from '@/lib/utils'
import { StepList } from './step-list'

type Props = {
  note: StudyNote
  side: Side
  combined: boolean
  showFlow: boolean
  flowMode: 'markers' | 'heatmap'
  showTouch: boolean
  /** Share of the surface touched per side (averaged over all notes when combined) */
  touchCoverage: (side: Side) => number | undefined
  editing: boolean
  dirty: boolean
  status: string | null
  highlighted: string | null
  onHighlight: (id: string | null) => void
  onPointsChange: (side: Side, points: FlowPoint[]) => void
  onSave: () => void
  onExport: () => void
  onDiscard: () => void
  /** Section expanded (collapsible like a Figma panel section) */
  open: boolean
  onOpenChange: (open: boolean) => void
}

const pct = (v: number | undefined) => (v === undefined ? '—' : `${Math.round(v * 100)}%`)

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
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
  touchCoverage,
  editing,
  dirty,
  status,
  highlighted,
  onHighlight,
  onPointsChange,
  onSave,
  onExport,
  onDiscard,
  open,
  onOpenChange,
}: Props) {
  const flow = note.flow
  const hasTouch = !!(note.touch.front?.extraction || note.touch.back?.extraction)
  const canEdit = editing && !!flow && showFlow && flowMode === 'markers'

  return (
    // Flat section of the sidebar: the sidebar scrolls, the edit bar sticks to its bottom.
    <div className="flex flex-1 flex-col">
      {/* Collapsible heading, like a Figma panel section */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center gap-2 px-4 pt-3 pb-2 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/40"
      >
        <span className="flex-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          Selected note
        </span>
        {!open && (
          <span className="text-xs text-muted-foreground capitalize">
            {note.label} · {side}
          </span>
        )}
        <ChevronDown
          className={cn('size-4 text-muted-foreground transition-transform', !open && '-rotate-90')}
        />
      </button>
      {open && (
        <>
          <div className="flex items-start gap-2 px-4 pb-3">
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
          </div>

          <Separator />

          <div className="flex flex-1 flex-col gap-4 p-4">
            {showFlow && (
              <div className="flex flex-col gap-3">
                {flow ? (
                  <>
                    <div>
                      <Heading>Eye flow · {side} viewing order</Heading>
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
                    {flow.notes && (
                      <p className="text-xs text-muted-foreground">Note: {flow.notes}</p>
                    )}
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
                <Heading>Touch</Heading>
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
                  Three people handled printed notes with invisible ink on their hands; the ink
                  glows under UV light and was mapped onto the artwork. All three are combined.
                </p>
              </div>
            )}

            {!showFlow && !showTouch && (
              <p className="text-xs text-muted-foreground">
                Turn on Eye flow or Touch to see data.
              </p>
            )}
          </div>
        </>
      )}

      {canEdit && (
        <>
          <div className="sticky bottom-0 mt-auto flex flex-col gap-2 border-t bg-background p-3">
            {dirty ? (
              <Badge variant="secondary">Unsaved changes</Badge>
            ) : (
              <span className="text-xs text-muted-foreground">{status ?? 'No changes'}</span>
            )}
            {/* Equal columns so all three fit however narrow the sidebar is */}
            <div className="grid grid-cols-3 gap-1 [&_button]:px-1.5">
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
    </div>
  )
}
