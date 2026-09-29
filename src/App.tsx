import { useEffect, useState } from 'react'
import { FlowPage } from '@/pages/flow-page'
import { TouchExtractPage } from '@/pages/touch-extract-page'
import { TouchPage } from '@/pages/touch-page'

// Hash routes keep the static build working without server config:
// #/ visual flow · #/touch touch heatmap · #/touch/extract extraction tool (dev only)
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
  if (route === '/touch/extract' && import.meta.env.DEV) return <TouchExtractPage />
  if (route.startsWith('/touch')) return <TouchPage />
  return <FlowPage />
}
