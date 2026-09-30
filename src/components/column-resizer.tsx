import { useState } from 'react'
import type { useColumnWidth } from '@/hooks/use-column-width'
import { cn } from '@/lib/utils'

/** Drag handle on the column's right edge; double-click resets the width */
export function ColumnResizer(props: ReturnType<typeof useColumnWidth>['handleProps']) {
  const [active, setActive] = useState(false)
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panels"
      title="Drag to resize · double-click to reset"
      className="group pointer-events-auto absolute inset-y-0 -right-1.5 flex w-3 cursor-col-resize touch-none justify-center"
      {...props}
      onPointerDown={(e) => {
        setActive(true)
        props.onPointerDown(e)
      }}
      onPointerUp={() => {
        setActive(false)
        props.onPointerUp()
      }}
    >
      <div
        className={cn(
          'h-full w-0.5 rounded-full bg-transparent transition-colors group-hover:bg-border',
          active && 'bg-primary/40 group-hover:bg-primary/40',
        )}
      />
    </div>
  )
}
