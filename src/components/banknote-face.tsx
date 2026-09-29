import { useId, useRef } from 'react'
import { orderColor, orderOpacity } from '@/lib/order'
import { cn } from '@/lib/utils'
import type { FlowPoint } from '@/data/types'

type Props = {
  /** Omit to draw only the flow (used by the overlay, which paints images separately) */
  image?: string
  alt: string
  points: FlowPoint[]
  editing: boolean
  interactive: boolean
  highlighted: string | null
  onHighlight: (id: string | null) => void
  onChange: (points: FlowPoint[]) => void
  /** Push this flow into the background (overlay: not the selected observer) */
  muted?: boolean
  /** Short label pinned to the first point, e.g. observer initials */
  tag?: string
}

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const round = (v: number) => Math.round(v * 1000) / 1000

// Board convention: the first fixation gets the biggest marker.
// Sizes are in cqmax (the note's long edge) so portrait notes (CHF) match landscape ones.
function markerSize(index: number) {
  return Math.max(6, 11 - index * 1.5)
}

export function BanknoteFace({
  image,
  alt,
  points,
  editing,
  interactive,
  highlighted,
  onHighlight,
  onChange,
  muted = false,
  tag,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef<string | null>(null)
  const gradientId = `flow${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  function toLocal(e: React.PointerEvent | React.MouseEvent) {
    const rect = ref.current!.getBoundingClientRect()
    return {
      x: round(clamp((e.clientX - rect.left) / rect.width)),
      y: round(clamp((e.clientY - rect.top) / rect.height)),
    }
  }

  function addPoint(e: React.MouseEvent) {
    if (!editing || e.target !== e.currentTarget) return
    const { x, y } = toLocal(e)
    onChange([
      ...points,
      { id: crypto.randomUUID().slice(0, 8), label: `Point ${points.length + 1}`, x, y },
    ])
  }

  const segments = points.slice(1).map((p, i) => ({ from: points[i], to: p, index: i }))

  return (
    <div
      ref={ref}
      className={cn(
        'absolute inset-0 overflow-hidden rounded-md @container-[size]',
        !interactive && 'pointer-events-none',
        editing && 'cursor-crosshair',
      )}
      onClick={addPoint}
    >
      {image && (
        <img
          src={image}
          alt={alt}
          draggable={false}
          className="pointer-events-none size-full object-fill select-none"
        />
      )}

      {/* Clicks pass through this layer to the face so edit mode can add points; markers opt back in. */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 transition-opacity duration-300',
          muted && 'opacity-35',
        )}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 size-full"
        >
          <defs>
            {segments.map((s) => (
              <linearGradient
                key={s.index}
                id={`${gradientId}-${s.index}`}
                gradientUnits="userSpaceOnUse"
                x1={s.from.x * 100}
                y1={s.from.y * 100}
                x2={s.to.x * 100}
                y2={s.to.y * 100}
              >
                <stop offset="0" stopColor={orderColor(s.index)} stopOpacity={orderOpacity(s.index)} />
                <stop
                  offset="1"
                  stopColor={orderColor(s.index + 1)}
                  stopOpacity={orderOpacity(s.index + 1)}
                />
              </linearGradient>
            ))}
          </defs>
          {segments.map((s) => (
            <g key={s.index}>
              <line
                x1={s.from.x * 100}
                y1={s.from.y * 100}
                x2={s.to.x * 100}
                y2={s.to.y * 100}
                stroke="white"
                strokeOpacity={0.85 * orderOpacity(s.index)}
                strokeWidth={5}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={s.from.x * 100}
                y1={s.from.y * 100}
                x2={s.to.x * 100}
                y2={s.to.y * 100}
                stroke={`url(#${gradientId}-${s.index})`}
                strokeWidth={2.5}
                strokeDasharray="7 4"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
        </svg>

        {points.map((p, i) => {
          const size = markerSize(i)
          const active = highlighted === p.id
          return (
            <button
              key={p.id}
              type="button"
              title={p.label}
              className={cn(
                'absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-semibold text-white shadow-sm ring-2 ring-white/80 transition-[transform,opacity] select-none',
                interactive && 'pointer-events-auto',
                active && 'z-10 scale-125 opacity-100!',
                editing ? 'cursor-grab touch-none active:cursor-grabbing' : 'cursor-default',
              )}
              style={{
                left: `${p.x * 100}%`,
                top: `${p.y * 100}%`,
                width: `max(${size}cqmax, 22px)`,
                height: `max(${size}cqmax, 22px)`,
                fontSize: `max(${size * 0.45}cqmax, 11px)`,
                backgroundColor: orderColor(i),
                opacity: orderOpacity(i),
              }}
              onPointerEnter={() => onHighlight(p.id)}
              onPointerLeave={() => onHighlight(null)}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => {
                if (!editing) return
                // Keep the canvas from panning while a marker is dragged.
                e.stopPropagation()
                e.currentTarget.setPointerCapture(e.pointerId)
                dragging.current = p.id
              }}
              onPointerMove={(e) => {
                if (dragging.current !== p.id) return
                const { x, y } = toLocal(e)
                onChange(points.map((q) => (q.id === p.id ? { ...q, x, y } : q)))
              }}
              onPointerUp={() => (dragging.current = null)}
            >
              {i + 1}
              {tag && i === 0 && (
                <span className="absolute top-1/2 left-full ml-1 -translate-y-1/2 rounded-md bg-foreground px-1.5 py-0.5 text-[max(2.2cqmax,11px)] leading-none font-semibold whitespace-nowrap text-background shadow-sm">
                  {tag}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
