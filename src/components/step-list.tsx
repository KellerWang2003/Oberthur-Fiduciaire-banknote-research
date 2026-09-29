import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { orderColor, orderOpacity } from '@/lib/order'
import { cn } from '@/lib/utils'
import type { FlowPoint } from '@/data/types'

type Props = {
  points: FlowPoint[]
  editing: boolean
  highlighted: string | null
  onHighlight: (id: string | null) => void
  onChange: (points: FlowPoint[]) => void
}

export function StepList({ points, editing, highlighted, onHighlight, onChange }: Props) {
  function move(from: number, to: number) {
    const next = [...points]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  if (points.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        {editing ? 'Click on the note to add the first point.' : 'No viewing order recorded.'}
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-1">
      {points.map((p, i) => (
        <li
          key={p.id}
          onPointerEnter={() => onHighlight(p.id)}
          onPointerLeave={() => onHighlight(null)}
          className={cn(
            'flex items-center gap-2.5 rounded-md px-2 py-1 text-sm transition-colors',
            highlighted === p.id && 'bg-muted',
          )}
        >
          <span
            className="flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={{ backgroundColor: orderColor(i), opacity: orderOpacity(i) }}
          >
            {i + 1}
          </span>
          {editing ? (
            <>
              <Input
                value={p.label}
                onChange={(e) =>
                  onChange(points.map((q) => (q.id === p.id ? { ...q, label: e.target.value } : q)))
                }
                className="h-7"
              />
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Move up"
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Move down"
                disabled={i === points.length - 1}
                onClick={() => move(i, i + 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Delete point"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onChange(points.filter((q) => q.id !== p.id))}
              >
                <Trash2 />
              </Button>
            </>
          ) : (
            <span>{p.label}</span>
          )}
        </li>
      ))}
    </ol>
  )
}
