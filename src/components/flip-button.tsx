import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Side } from '@/data/types'

type Props = {
  side: Side
  onClick: () => void
}

/**
 * Lives on the canvas under a note, so it pans with it. It counter-scales against the
 * camera zoom (`--cam-k`, set by CanvasStage) to stay readable, up to 3× when zoomed far out.
 */
export function FlipButton({ side, onClick }: Props) {
  return (
    <div className="flex h-10 justify-center">
      <Button
        className="h-10 origin-top rounded-xl px-4 shadow-lg"
        style={{ scale: 'clamp(1, calc(1 / var(--cam-k, 1)), 3)' }}
        onClick={onClick}
        title="Flip (F)"
      >
        <RotateCw className={cn('transition-transform duration-700', side === 'back' && 'rotate-180')} />
        {side === 'front' ? 'Flip to back' : 'Flip to front'}
      </Button>
    </div>
  )
}
