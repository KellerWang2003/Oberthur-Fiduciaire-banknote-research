export type Side = 'front' | 'back'

export type FlowPoint = {
  id: string
  label: string
  /** 0–1, fraction of the note image width */
  x: number
  /** 0–1, fraction of the note image height */
  y: number
}

export type NoteSide = {
  image: string
  /** Ordered: index 0 is what the observer saw first */
  points: FlowPoint[]
}

export type Observation = {
  id: string
  currency: CurrencyCode
  observer: string
  denomination: number
  label: string
  orientation: 'horizontal' | 'vertical'
  /** Front image width / height */
  aspect: number
  grip?: string
  quote: string
  notes?: string
  front: NoteSide
  back: NoteSide
}

export type CurrencyCode = 'USD' | 'EUR' | 'CHF' | 'RUB' | 'GBP'

export const CURRENCIES: { code: CurrencyCode; name: string; series: string }[] = [
  { code: 'USD', name: 'US Dollar', series: 'Current series' },
  { code: 'EUR', name: 'Euro', series: 'Europa series (ES2)' },
  { code: 'CHF', name: 'Swiss Franc', series: '9th series' },
  { code: 'RUB', name: 'Russian Ruble', series: '2004 / 2017 issues' },
  { code: 'GBP', name: 'British Pound', series: 'Elizabeth II polymer series' },
]

export const OBSERVERS = ['Keller Wang', 'Sylva Tang', 'Rylee Kang', 'Wen Jing']

export type TouchCurrency = Exclude<CurrencyCode, 'USD'>

export type InkSettings = {
  /** Minimum brightness (0–1) for any pixel to count as ink */
  minValue: number
  /** Pink / violet ink starts at this hue (°); the blue UV background sits below it */
  pinkHue: number
  /** Pink / red ink: minimum saturation */
  pinkSaturation: number
  /** Yellow-green ink: minimum saturation */
  greenSaturation: number
  /** Yellow-green ink: hues from 45° up to this value count */
  greenHue: number
  /** Pale ink photographs as cyan: hues from 150° up to this value count (the paper sits ~215–235°) */
  cyanHue: number
  /** White ink: maximum saturation */
  paleSaturation: number
  /** Cyan / white ink: minimum brightness */
  paleValue: number
}

export type Extraction = {
  /** Clockwise rotation applied to the photo to make it upright */
  rotation: 0 | 90 | 180 | 270
  /** Note corners in the upright photo, as 0–1 fractions: top-left, top-right, bottom-right, bottom-left */
  corners: [number, number][]
  ink: InkSettings
  /** Share of the note surface with ink (0–1) */
  coverage: number
  mask: string
  /** Straightened UV photo aligned to the reference artwork */
  photo?: string
  savedAt: number
}

export type TouchEntry = {
  id: string
  currency: TouchCurrency
  denomination: number
  label: string
  side: Side
  /** Rendered UV photo (dev server only) */
  source: string
  /** Reference artwork the mask is aligned to */
  image: string
  aspect: number
  orientation: 'horizontal' | 'vertical'
  extraction: Extraction | null
}
