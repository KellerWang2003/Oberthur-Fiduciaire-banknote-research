import { cn } from '@/lib/utils'
import type { Side } from '@/data/types'

type Props = {
  aspect: number
  side: Side
  front: string | null
  back: string | null
}

/** The straightened UV photo shown above a note; flips together with it */
export function PhotoCard({ aspect, side, front, back }: Props) {
  const face = (src: string | null, className?: string) => (
    <div
      className={cn(
        'absolute inset-0 overflow-hidden rounded-md bg-muted shadow-lg backface-hidden',
        className,
      )}
    >
      {src && (
        <img
          src={src}
          alt="UV photo"
          draggable={false}
          className="size-full object-fill select-none"
        />
      )}
    </div>
  )
  return (
    <div className="flex flex-col gap-2">
      <span className="text-base tracking-wide text-muted-foreground uppercase">UV photo</span>
      <div className="relative perspective-[2400px]" style={{ aspectRatio: aspect }}>
        <div
          className={cn(
            'absolute inset-0 transition-transform duration-700 ease-in-out transform-3d',
            side === 'back' && 'rotate-y-180',
          )}
        >
          {face(front)}
          {face(back, 'rotate-y-180')}
        </div>
      </div>
    </div>
  )
}
