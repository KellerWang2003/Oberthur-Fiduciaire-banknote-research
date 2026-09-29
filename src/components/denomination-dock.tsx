import { cn } from '@/lib/utils'

export type DockItem = {
  id: string
  label: string
  sublabel?: string
  thumb: string
  vertical: boolean
}

type Props = {
  notes: DockItem[]
  selectedId: string
  onSelect: (id: string) => void
}

export function DenominationDock({ notes, selectedId, onSelect }: Props) {
  return (
    <nav className="flex max-w-full gap-1 overflow-x-auto rounded-xl border bg-background/95 p-1.5 shadow-lg backdrop-blur">
      {notes.map((n) => {
        const active = n.id === selectedId
        return (
          <button
            key={n.id}
            type="button"
            onClick={() => onSelect(n.id)}
            aria-pressed={active}
            className={cn(
              'flex shrink-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
              active && 'bg-muted ring-1 ring-border',
            )}
          >
            <span className="flex h-10 w-16 items-center justify-center">
              <img
                src={n.thumb}
                alt=""
                className={cn(
                  'max-h-10 max-w-16 rounded-[3px] shadow-sm',
                  n.vertical && 'max-h-16 -rotate-90',
                )}
              />
            </span>
            <span className="flex flex-col pr-1">
              <span className="text-sm leading-tight font-semibold">{n.label}</span>
              {n.sublabel && (
                <span className="text-xs leading-tight text-muted-foreground">{n.sublabel}</span>
              )}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
