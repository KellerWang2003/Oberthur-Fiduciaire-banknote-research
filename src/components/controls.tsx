import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

/** One labelled group of controls in the sidebar */
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
    <section className="flex flex-col p-1.5">
      <h2 className="px-2 pt-1 pb-0.5 text-[10px] font-medium tracking-wider text-muted-foreground/80 uppercase">
        {title}
        {shortcut && (
          <span className="font-normal tracking-normal normal-case opacity-70"> · {shortcut}</span>
        )}
      </h2>
      {children}
    </section>
  )
}

/**
 * A primary data layer (eye flow, touch), drawn as a tile so it outranks everything else in the
 * sidebar. The icon chip carries the layer's colour and, while on, the tile takes a flat, slight tint
 * of it and holds the layer's options.
 */
export function LayerToggle({
  icon: Icon,
  title,
  description,
  shortcut,
  swatch,
  tint,
  checked,
  onChange,
  children,
}: {
  icon: LucideIcon
  title: string
  description: string
  shortcut?: string
  /** CSS background for the icon chip, echoing the layer's colour scale */
  swatch: string
  /** Flat, slight background colour for the tile while the layer is on */
  tint: string
  checked: boolean
  onChange: (value: boolean) => void
  children?: ReactNode
}) {
  return (
    <section
      className={cn(
        'flex flex-col rounded-xl border transition-colors',
        checked ? 'border-foreground/10 shadow-sm' : 'border-dashed bg-transparent',
      )}
      style={checked ? { backgroundColor: tint } : undefined}
    >
      <label
        title={shortcut ? `${title} (${shortcut})` : title}
        className="flex cursor-pointer items-center gap-3 p-3"
      >
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg transition-all [&_svg]:size-5',
            checked ? 'text-white shadow-sm' : 'bg-muted text-muted-foreground',
          )}
          style={checked ? { backgroundImage: swatch } : undefined}
        >
          <Icon />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={cn(
              'text-[15px] leading-tight font-semibold',
              checked ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {title}
          </span>
          <span className="text-xs leading-snug text-muted-foreground">
            {checked ? description : 'Hidden'}
          </span>
        </span>
        <Switch checked={checked} onCheckedChange={onChange} />
      </label>
      {checked && children && (
        <div className="flex flex-col gap-2 px-3 pb-3 [&_[role=radiogroup]]:mx-0">{children}</div>
      )}
    </section>
  )
}

/** Horizontal segmented switch with a highlight that slides to the chosen option */
export function SlidingSwitch<T extends string>({
  label,
  options,
  value,
  onChange,
  shortcut,
}: {
  label: string
  options: { value: T; label: string; icon: LucideIcon }[]
  value: T
  onChange: (value: T) => void
  shortcut?: string
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )
  return (
    <div
      role="radiogroup"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      className="pointer-events-auto relative grid rounded-xl border bg-background/95 p-1 shadow-lg backdrop-blur"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {/* Sliding highlight behind the active option */}
      <span
        aria-hidden
        className="absolute top-1 bottom-1 left-1 rounded-lg bg-primary shadow-sm transition-transform duration-300 ease-out"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
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
              'relative z-10 flex items-center justify-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4',
              active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
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
        'flex items-center gap-2 px-2 py-1 text-[13px] whitespace-nowrap',
        disabled && 'text-muted-foreground',
      )}
    >
      <Switch size="sm" checked={checked} onCheckedChange={onChange} disabled={disabled} />
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
      // White track with a dark active option, so it reads on any tile tint (matches the layout switch).
      className={cn(
        'mx-1 flex rounded-lg border bg-background p-0.5 shadow-xs',
        disabled && 'opacity-50',
      )}
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
              'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
