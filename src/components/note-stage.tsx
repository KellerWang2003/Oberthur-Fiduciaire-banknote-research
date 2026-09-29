import { cn } from '@/lib/utils'
import type { FlowPoint, Observation, Side } from '@/data/types'
import { BanknoteFace } from './banknote-face'
import { FlipButton } from './flip-button'

type Props = {
  note: Observation
  side: Side
  editing: boolean
  selected?: boolean
  caption?: boolean
  highlighted: string | null
  onHighlight: (id: string | null) => void
  onPointsChange: (side: Side, points: FlowPoint[]) => void
  onSelect?: () => void
  onFlip: () => void
  /** Black-and-white artwork */
  mono?: boolean
  ref?: React.Ref<HTMLDivElement>
}

// Horizontal notes share a common width on the canvas; vertical ones share a common height.
const HORIZONTAL_WIDTH = 960
const VERTICAL_HEIGHT = 900

export function NoteStage({
  note,
  side,
  editing,
  selected = true,
  caption = false,
  highlighted,
  onHighlight,
  onPointsChange,
  onSelect,
  onFlip,
  mono = false,
  ref,
}: Props) {
  const flipped = side === 'back'
  const width = note.orientation === 'vertical' ? VERTICAL_HEIGHT * note.aspect : HORIZONTAL_WIDTH

  const faceProps = (s: Side) => ({
    image: note[s].image,
    mono,
    alt: `${note.label} ${s}`,
    points: note[s].points,
    // In the grid only the selected note is editable; clicking the others selects them.
    editing: editing && selected,
    interactive: side === s && selected,
    highlighted: selected ? highlighted : null,
    onHighlight,
    onChange: (points: FlowPoint[]) => onPointsChange(s, points),
  })

  return (
    <div ref={ref} className="flex flex-col gap-4" style={{ width }}>
      {caption && (
        <div className="flex items-baseline gap-3 text-2xl">
          <span className="font-semibold">{note.label}</span>
          <span className="text-muted-foreground">{note.observer}</span>
          <span className="ml-auto text-base tracking-wide text-muted-foreground uppercase">
            {side}
          </span>
        </div>
      )}
      <div
        className={cn(
          'relative rounded-xl perspective-[2400px]',
          !selected && 'cursor-pointer opacity-70 transition-opacity hover:opacity-100',
        )}
        style={{ aspectRatio: note.aspect }}
        onClick={selected ? undefined : onSelect}
      >
        <div
          className={cn(
            'absolute inset-0 rounded-xl transition-transform duration-700 ease-in-out transform-3d',
            flipped && 'rotate-y-180',
          )}
        >
          <div
            className={cn(
              'absolute inset-0 rounded-md shadow-xl backface-hidden',
              selected && caption && 'ring-4 ring-primary ring-offset-8 ring-offset-transparent',
            )}
          >
            <BanknoteFace {...faceProps('front')} />
          </div>
          <div
            className={cn(
              'absolute inset-0 rotate-y-180 rounded-md shadow-xl backface-hidden',
              selected && caption && 'ring-4 ring-primary ring-offset-8 ring-offset-transparent',
            )}
          >
            <BanknoteFace {...faceProps('back')} />
          </div>
        </div>
      </div>
      <FlipButton side={side} onClick={onFlip} />
    </div>
  )
}
