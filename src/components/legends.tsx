import { HEAT_GRADIENT } from '@/lib/order'
import { touchGradient, type TouchPalette } from '@/lib/touch-palette'

function Scale({ gradient, from, to }: { gradient: string; from: string; to: string }) {
  return (
    <div>
      <div className="h-2 rounded-full" style={{ backgroundImage: gradient }} />
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{from}</span>
        <span>{to}</span>
      </div>
    </div>
  )
}

/**
 * Key for the eye-flow layer. Only the heatmap needs a scale; numbered markers explain themselves.
 */
export function EyeLegend({ mode, combined }: { mode: 'markers' | 'heatmap'; combined: boolean }) {
  if (mode === 'markers' && !combined) return null
  return (
    <div className="flex flex-col gap-1.5 px-0.5">
      {mode === 'heatmap' && <Scale gradient={HEAT_GRADIENT} from="Seen first" to="Seen later" />}
      {combined && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {mode === 'heatmap'
            ? 'All observers combined, including the path between points.'
            : 'Selected observer in focus; initials mark where each flow starts.'}
        </p>
      )}
    </div>
  )
}

/** Key for the touch layer */
export function TouchLegend({ palette, combined }: { palette: TouchPalette; combined: boolean }) {
  return (
    <div className="px-0.5">
      <Scale
        gradient={touchGradient(palette)}
        from={combined ? 'Few notes' : 'Light'}
        to={combined ? 'Every note' : 'Heavy'}
      />
    </div>
  )
}
