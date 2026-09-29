import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

/** A card in the left column; its sections are divided by thin lines */
export function ControlCard({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-auto flex flex-col divide-y rounded-xl border bg-background/95 shadow-sm backdrop-blur">
      {children}
    </div>
  )
}

/** One labelled group of controls inside a ControlCard */
export function ControlSection({
  title,
  shortcut,
  children,
}: {
  title: string
  shortcut?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-0.5 p-1.5">
      <h2 className="px-2 pt-1 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        {title}
        {shortcut && (
          <span className="font-normal tracking-normal normal-case opacity-70"> · {shortcut}</span>
        )}
      </h2>
      {children}
    </section>
  )
}

/** Mutually exclusive options laid out as a vertical list */
export function OptionList<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string; icon: LucideIcon }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-0.5">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4',
              active
                ? 'bg-muted font-medium text-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            <o.icon />
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** A labelled on/off switch */
export function ToggleRow({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  hint?: string
  disabled?: boolean
}) {
  return (
    <label
      title={hint}
      className={cn(
        'flex items-center gap-2 px-2 py-1 text-sm whitespace-nowrap',
        disabled && 'text-muted-foreground',
      )}
    >
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
      {label}
    </label>
  )
}

/** Two or three compact choices side by side, for "how to show" settings */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('mx-1 flex rounded-md bg-muted p-0.5', disabled && 'opacity-50')}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex-1 rounded-[5px] px-2 py-1 text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              active
                ? 'bg-background font-medium text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
