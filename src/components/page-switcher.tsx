import { Eye, Hand } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PageId = 'flow' | 'touch'

const PAGES: { id: PageId; label: string; href: string; icon: typeof Eye }[] = [
  { id: 'flow', label: 'Visual Flow', href: '#/', icon: Eye },
  { id: 'touch', label: 'Touch Heatmap', href: '#/touch', icon: Hand },
]

/** Top of the left column: the two studies as primary navigation */
export function PageSwitcher({ current }: { current: PageId }) {
  return (
    <nav
      aria-label="Studies"
      className="pointer-events-auto flex flex-col gap-1 rounded-xl border bg-background/95 p-1.5 shadow-sm backdrop-blur"
    >
      <span className="px-2 pt-1 pb-0.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        Studies
      </span>
      {PAGES.map((p) => {
        const active = p.id === current
        return (
          <a
            key={p.id}
            href={p.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors [&_svg]:size-4',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <p.icon />
            {p.label}
          </a>
        )
      })}
    </nav>
  )
}
