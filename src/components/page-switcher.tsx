import { Eye, Hand } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PageId = 'flow' | 'touch'

const PAGES: { id: PageId; label: string; href: string; icon: typeof Eye }[] = [
  { id: 'flow', label: 'Banknote Visual Flow', href: '#/', icon: Eye },
  { id: 'touch', label: 'Touch Heatmap', href: '#/touch', icon: Hand },
]

/** Top-left card: the two studies listed vertically, current one highlighted */
export function PageSwitcher({ current, subtitle }: { current: PageId; subtitle?: string }) {
  return (
    <nav className="pointer-events-auto hidden flex-col gap-0.5 rounded-xl border bg-background/95 p-1 shadow-sm backdrop-blur md:flex">
      {PAGES.map((p) => {
        const active = p.id === current
        return (
          <a
            key={p.id}
            href={p.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors [&_svg]:size-4',
              active
                ? 'bg-muted font-semibold text-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            <p.icon />
            {p.label}
          </a>
        )
      })}
      {subtitle && <p className="px-2.5 pt-1 pb-1 text-xs text-muted-foreground">{subtitle}</p>}
    </nav>
  )
}
