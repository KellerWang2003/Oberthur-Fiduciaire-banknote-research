import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type Mode<T extends string> = { value: T; label: string; icon: LucideIcon }

type Props<T extends string> = {
  modes: Mode<T>[]
  value: T
  onChange: (value: T) => void
  /** Switches shown under "Options" */
  children?: ReactNode
}

/** Secondary controls under the page navigation: view modes laid out as a list, then options */
export function ModePanel<T extends string>({ modes, value, onChange, children }: Props<T>) {
  return (
    <div className="pointer-events-auto flex flex-col gap-0.5 rounded-xl border bg-background/95 p-1.5 shadow-sm backdrop-blur">
      <span className="px-2 pt-1 pb-0.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        View <span className="font-normal normal-case">· G</span>
      </span>
      <div role="radiogroup" aria-label="View" className="flex flex-col gap-0.5">
        {modes.map((m) => {
          const active = m.value === value
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(m.value)}
              className={cn(
                'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4',
                active
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              <m.icon />
              {m.label}
            </button>
          )
        })}
      </div>
      {children && (
        <>
          <Separator className="my-1" />
          <span className="px-2 pb-0.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Options
          </span>
          {children}
        </>
      )}
    </div>
  )
}
