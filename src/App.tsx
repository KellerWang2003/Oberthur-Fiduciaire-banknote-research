import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
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

function Page({ route }: { route: string }) {
  if (route === '/touch/extract' && import.meta.env.DEV) return <TouchExtractPage />
  if (route.startsWith('/touch')) return <TouchPage />
  return <FlowPage />
}

export default function App() {
  const route = useHashRoute()
  // Pages live in the hash, which Vercel can't see; report them as paths so each study counts separately.
  const page = route.startsWith('/touch') ? '/touch' : '/'
  return (
    <>
      <Page route={route} />
      <Analytics route={page} path={page} />
    </>
  )
}
