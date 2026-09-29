import { useRef, useState } from 'react'

const STORAGE_KEY = 'left-column-width'
const MIN = 220
const MAX = 420
const DEFAULT = 256

function stored() {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY))
    return v >= MIN && v <= MAX ? v : DEFAULT
  } catch {
    return DEFAULT
  }
}

/**
 * Width of the left column (navigation, view and details panels), shared by both pages.
 * `width` follows the drag live; `settled` only changes on release, for re-framing the canvas.
 */
export function useColumnWidth() {
  const [width, setWidth] = useState(stored)
  const [settled, setSettled] = useState(width)
  const drag = useRef<{ x: number; w: number } | null>(null)

  const handleProps = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = { x: e.clientX, w: width }
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!drag.current) return
      setWidth(Math.min(MAX, Math.max(MIN, drag.current.w + e.clientX - drag.current.x)))
    },
    onPointerUp: () => {
      drag.current = null
      setSettled(width)
      try {
        localStorage.setItem(STORAGE_KEY, String(width))
      } catch {
        /* storage unavailable */
      }
    },
    onDoubleClick: () => {
      setWidth(DEFAULT)
      setSettled(DEFAULT)
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* storage unavailable */
      }
    },
  }

  return { width, settled, handleProps }
}
