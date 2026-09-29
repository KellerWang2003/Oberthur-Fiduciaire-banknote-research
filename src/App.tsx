import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { StudyPage } from '@/pages/study-page'
import { TouchExtractPage } from '@/pages/touch-extract-page'

// Everything lives on one page; the hash only selects the dev-only extraction tool (#/touch/extract).
// Old #/touch and #/combined links still open the study.
function useHashRoute() {
  const [hash, setHash] = useState(() => location.hash)
  useEffect(() => {
    const onChange = () => setHash(location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash.replace(/^#/, '').split('?')[0]
}

export default function App() {
  const route = useHashRoute()
  return (
    <>
      {route === '/touch/extract' && import.meta.env.DEV ? (
        <TouchExtractPage />
      ) : (
        // Old Touch Heatmap links open with eye flow off, as that page showed touch only.
        <StudyPage legacyTouch={route === '/touch'} />
      )}
      <Analytics route="/" path="/" />
    </>
  )
}
