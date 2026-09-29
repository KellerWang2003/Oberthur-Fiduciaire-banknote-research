import { Download, Hand, PanelRightClose, Save, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { HEAT_GRADIENT, ORDER_LEGEND } from '@/lib/order'
import type { FlowPoint, Observation, Side } from '@/data/types'
import { StepList } from './step-list'

type Props = {
  note: Observation
  side: Side
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
  /** Overlay layout: shows the "show all flows" option */
  overlay: boolean
  /** Heatmap layout: swaps the order key for the heat scale */
  heatmap: boolean
  showAllFlows: boolean
  onShowAllFlowsChange: (value: boolean) => void
}

export function InspectorPanel({
  note,
  side,
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
  overlay,
  heatmap,
  showAllFlows,
  onShowAllFlowsChange,
}: Props) {
  return (
    <aside className="flex max-h-full w-full flex-col overflow-hidden rounded-xl border bg-background/95 shadow-lg backdrop-blur">
      <div className="flex items-start gap-2 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-semibold">{note.label}</h2>
            <span className="text-sm text-muted-foreground">{note.observer}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="capitalize">
              {note.orientation}
            </Badge>
            {note.grip && (
              <Badge variant="outline" className="h-auto whitespace-normal">
                <Hand />
                {note.grip}
              </Badge>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Hide panel" onClick={onClose}>
          <PanelRightClose />
        </Button>
      </div>

      <Separator />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div>
          <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Gaze order
          </h3>
          {heatmap ? (
            <div>
              <div className="h-2.5 rounded-full" style={{ backgroundImage: HEAT_GRADIENT }} />
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>Seen first</span>
                <span>Seen later</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                All four observers combined. Colour shows how early an area was looked at; stronger
                colour means more attention.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
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
          {overlay && (
            <label className="mt-3 flex items-center gap-2 text-sm">
              <Switch checked={showAllFlows} onCheckedChange={onShowAllFlowsChange} />
              Show all flows equally
            </label>
          )}
        </div>
        <Separator />
        <div>
          <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {side} · viewing order
          </h3>
          <StepList
            points={note[side].points}
            editing={editing}
            highlighted={highlighted}
            onHighlight={onHighlight}
            onChange={(points) => onPointsChange(side, points)}
          />
          {editing && (
            <p className="mt-2 text-xs text-muted-foreground">
              Click the note to add a point · drag a marker to move it
            </p>
          )}
        </div>
        <Separator />
        <blockquote className="border-l-2 pl-3 text-sm leading-relaxed text-muted-foreground">
          “{note.quote}”
        </blockquote>
        {note.notes && <p className="text-xs text-muted-foreground">Note: {note.notes}</p>}
      </div>

      {editing && (
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
