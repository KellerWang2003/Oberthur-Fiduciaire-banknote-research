import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Maximize, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Camera = { x: number; y: number; k: number }
type Insets = { top: number; right: number; bottom: number; left: number }

type Props = {
  children: React.ReactNode
  /** Element the camera frames when `fitKey` changes or "fit" is pressed */
  fitTarget: RefObject<HTMLElement | null>
  fitKey: string
  /** Space reserved for floating UI around the edges */
  insets: Insets
  className?: string
  /** Where to render the zoom controls (e.g. under the page nav); bottom-left of the canvas if unset */
  controlsContainer?: HTMLElement | null
}

const MIN_K = 0.1
const MAX_K = 4
const DRAG_THRESHOLD = 3
const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k))

export function CanvasStage({
  children,
  fitTarget,
  fitKey,
  insets,
  className,
  controlsContainer,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const [cam, setCam] = useState<Camera>({ x: 0, y: 0, k: 1 })
  const [animating, setAnimating] = useState(false)
  const [panning, setPanning] = useState(false)
  const pan = useRef<{
    id: number
    sx: number
    sy: number
    cx: number
    cy: number
    moved: boolean
  } | null>(null)
  const suppressClick = useRef(false)
  // True once the user pans/zooms by hand; until then resizes keep the target framed.
  const userMoved = useRef(false)
  const hasFitted = useRef(false)

  const camRef = useRef(cam)
  const insetsRef = useRef(insets)
  useLayoutEffect(() => {
    camRef.current = cam
    insetsRef.current = insets
  })

  const animateTo = useCallback((next: Camera) => {
    setAnimating(true)
    setCam(next)
    window.setTimeout(() => setAnimating(false), 450)
  }, [])

  function fit() {
    userMoved.current = false
    const vp = viewportRef.current
    const world = worldRef.current
    const el = fitTarget.current
    if (!vp || !world || !el) return
    const c = camRef.current
    const insets = insetsRef.current
    const v = vp.getBoundingClientRect()
    const w = world.getBoundingClientRect()
    const e = el.getBoundingClientRect()
    // Target box in world units, independent of the current zoom.
    const bx = (e.left - w.left) / c.k
    const by = (e.top - w.top) / c.k
    const bw = e.width / c.k
    const bh = e.height / c.k
    if (!bw || !bh) return
    const availW = v.width - insets.left - insets.right
    const availH = v.height - insets.top - insets.bottom
    const k = clampK(Math.min(availW / bw, availH / bh) * 0.92)
    const next = {
      k,
      x: insets.left + (availW - bw * k) / 2 - bx * k,
      y: insets.top + (availH - bh * k) / 2 - by * k,
    }
    // No fly-in on first load.
    if (hasFitted.current) animateTo(next)
    else setCam(next)
    hasFitted.current = true
  }

  const fitRef = useRef(fit)
  useLayoutEffect(() => {
    fitRef.current = fit
  })

  // Re-frame whenever the selection or layout changes.
  useLayoutEffect(() => {
    fit()
    // Only re-frame on fitKey changes, never on pans/zooms in between.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey])

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    let frame = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!userMoved.current) fitRef.current()
      })
    })
    ro.observe(vp)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])

  const zoomAround = useCallback(
    (factor: number, px: number, py: number, animate = false) => {
      const apply = (c: Camera) => {
        const k = clampK(c.k * factor)
        return { k, x: px - (px - c.x) * (k / c.k), y: py - (py - c.y) * (k / c.k) }
      }
      // Wheel events can outpace renders, so non-animated zoom uses the updater form.
      if (animate) animateTo(apply(camRef.current))
      else setCam(apply)
    },
    [animateTo],
  )

  // Wheel: pinch / ctrl+scroll zooms, plain scroll pans (Figma-style).
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      userMoved.current = true
      const r = vp.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        zoomAround(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top)
      } else {
        setCam((c) => ({ ...c, x: c.x - e.deltaX, y: c.y - e.deltaY }))
      }
    }
    vp.addEventListener('wheel', onWheel, { passive: false })
    return () => vp.removeEventListener('wheel', onWheel)
  }, [zoomAround])

  function zoomCenter(factor: number) {
    userMoved.current = true
    const v = viewportRef.current!.getBoundingClientRect()
    const cx = insets.left + (v.width - insets.left - insets.right) / 2
    const cy = insets.top + (v.height - insets.top - insets.bottom) / 2
    zoomAround(factor, cx, cy, true)
  }

  const controls = (
    <div
      className={cn(
        'flex w-fit items-center gap-0.5 rounded-lg border bg-background/95 p-1 shadow-sm backdrop-blur',
        !controlsContainer && 'absolute bottom-4 left-4 z-10',
      )}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Zoom out"
        onClick={() => zoomCenter(1 / 1.25)}
      >
        <Minus />
      </Button>
      <span className="w-11 text-center text-xs tabular-nums text-muted-foreground">
        {Math.round(cam.k * 100)}%
      </span>
      <Button variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={() => zoomCenter(1.25)}>
        <Plus />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Fit to screen" onClick={fit}>
        <Maximize />
      </Button>
    </div>
  )

  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)}>
      <div
        ref={viewportRef}
        className={cn(
          'absolute inset-0 touch-none bg-muted/40',
          panning ? 'cursor-grabbing' : 'cursor-grab',
        )}
        style={{
          backgroundImage:
            'radial-gradient(circle, color-mix(in oklch, var(--foreground) 18%, transparent) 1px, transparent 1px)',
          backgroundSize: `${24 * cam.k}px ${24 * cam.k}px`,
          backgroundPosition: `${cam.x}px ${cam.y}px`,
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 && e.button !== 1) return
          pan.current = {
            id: e.pointerId,
            sx: e.clientX,
            sy: e.clientY,
            cx: cam.x,
            cy: cam.y,
            moved: false,
          }
        }}
        onPointerMove={(e) => {
          const p = pan.current
          if (!p || p.id !== e.pointerId) return
          const dx = e.clientX - p.sx
          const dy = e.clientY - p.sy
          if (!p.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
          if (!p.moved) {
            p.moved = true
            userMoved.current = true
            // Capture only once it's a real drag, so plain clicks still reach the notes.
            e.currentTarget.setPointerCapture(e.pointerId)
            setPanning(true)
          }
          setCam((c) => ({ ...c, x: p.cx + dx, y: p.cy + dy }))
        }}
        onPointerUp={() => {
          suppressClick.current = !!pan.current?.moved
          pan.current = null
          setPanning(false)
        }}
        onPointerCancel={() => {
          pan.current = null
          setPanning(false)
        }}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.stopPropagation()
            suppressClick.current = false
          }
        }}
      >
        <div
          ref={worldRef}
          className={cn(
            'absolute top-0 left-0 w-max origin-top-left',
            animating && 'transition-transform duration-[450ms] ease-out',
          )}
          style={
            {
              transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.k})`,
              // Lets on-canvas controls counter-scale to stay readable.
              '--cam-k': cam.k,
            } as React.CSSProperties
          }
        >
          {children}
        </div>
      </div>

      {controlsContainer ? createPortal(controls, controlsContainer) : controls}
    </div>
  )
}
