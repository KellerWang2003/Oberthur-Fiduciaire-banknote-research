import { cn } from '@/lib/utils'
import type { FlowPoint, Observation, Side } from '@/data/types'
import { BanknoteFace } from './banknote-face'
import { FlipButton } from './flip-button'
import { HeatmapLayer } from './heatmap-layer'

export type OverlayMode = 'flow' | 'heatmap'

type Props = {
  notes: Observation[]
  mode: OverlayMode
  selectedId: string
  /** Show every observer's flow at full strength instead of focusing the selected one */
  showAll: boolean
  side: Side
  editing: boolean
  highlighted: string | null
  onHighlight: (id: string | null) => void
  onPointsChange: (noteId: string, side: Side, points: FlowPoint[]) => void
  onFlip: () => void
  /** Fully black-and-white artwork (otherwise lightly desaturated) */
  mono?: boolean
  /** Extra layer per side between the stacked artwork and the flows */
  underlay?: (side: Side) => React.ReactNode
  /** Shown between the caption and the stack, e.g. a row of UV photos */
  above?: React.ReactNode
  title?: string
  ref?: React.Ref<HTMLDivElement>
}

const HORIZONTAL_WIDTH = 960
const VERTICAL_HEIGHT = 900

const initials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')

export function OverlayStage({
  notes,
  mode,
  selectedId,
  showAll,
  side,
  editing,
  highlighted,
  onHighlight,
  onPointsChange,
  onFlip,
  mono = false,
  underlay,
  above,
  title,
  ref,
}: Props) {
  // Notes of one currency differ slightly in proportion; stretch them to a shared frame.
  // Points are stored as fractions, so they stay aligned with their own artwork.
  const aspect = notes.reduce((sum, n) => sum + n.aspect, 0) / notes.length
  const vertical = notes[0]?.orientation === 'vertical'
  const width = vertical ? VERTICAL_HEIGHT * aspect : HORIZONTAL_WIDTH
  // Selected flow is painted last so it sits on top.
  const ordered = [
    ...notes.filter((n) => n.id !== selectedId),
    ...notes.filter((n) => n.id === selectedId),
  ]

  const face = (s: Side, className?: string) => (
    <div
      className={cn(
        'absolute inset-0 isolate overflow-hidden rounded-md bg-white shadow-xl backface-hidden',
        className,
      )}
    >
      {notes.map((n) => (
        <img
          key={n.id}
          src={n[s].image}
          alt=""
          draggable={false}
          className={cn(
            'pointer-events-none absolute inset-0 size-full object-fill opacity-30 mix-blend-multiply select-none',
            mono ? 'grayscale' : 'grayscale-[40%]',
          )}
        />
      ))}
      {underlay?.(s)}
      {mode === 'heatmap' && <HeatmapLayer notes={notes} side={s} aspect={aspect} />}
      {mode === 'flow' &&
        ordered.map((n) => {
          const selected = n.id === selectedId
          return (
            <BanknoteFace
              key={n.id}
              alt={`${n.label} ${s}`}
              points={n[s].points}
              editing={editing && selected}
              interactive={selected && side === s}
              highlighted={highlighted}
              onHighlight={onHighlight}
              onChange={(points) => onPointsChange(n.id, s, points)}
              muted={!showAll && !selected}
              tag={initials(n.observer)}
            />
          )
        })}
    </div>
  )

  return (
    <div ref={ref} className="flex flex-col gap-4" style={{ width }}>
      <div className="flex items-baseline gap-3 text-2xl">
        <span className="font-semibold">{title ?? (mode === 'heatmap' ? 'Heatmap' : 'Overlay')}</span>
        <span className="text-muted-foreground">{notes.length} notes</span>
        <span className="ml-auto text-base tracking-wide text-muted-foreground uppercase">
          {side}
        </span>
      </div>
      {above}
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
