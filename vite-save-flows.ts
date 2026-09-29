import fs from 'node:fs'
import path from 'node:path'
import type { Connect, Plugin } from 'vite'

function readJson(
  req: Connect.IncomingMessage,
  onBody: (data: unknown) => void,
  res: import('node:http').ServerResponse,
) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end()
    return
  }
  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => {
    try {
      onBody(JSON.parse(body))
      res.setHeader('Content-Type', 'application/json')
      res.end('{"ok":true}')
    } catch (err) {
      res.statusCode = 400
      res.end(JSON.stringify({ ok: false, error: String(err) }))
    }
  })
}

// Dev-only endpoints: edit mode writes corrected points to src/data/flows.json, and the
// touch extraction tool writes masks to public/touch/ and settings to src/data/touch.json.
export function saveFlowsPlugin(): Plugin {
  return {
    name: 'save-flows',
    apply: 'serve',
    configureServer(server) {
      const root = server.config.root

      server.middlewares.use('/api/save-flows', (req, res) => {
        readJson(
          req,
          (data) => {
            const file = path.resolve(root, 'src/data/flows.json')
            fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
          },
          res,
        )
      })

      server.middlewares.use('/api/save-touch-page', (req, res) => {
        readJson(
          req,
          (data) => {
            const { id, extraction, maskPng, photoJpg } = data as {
              id: string
              extraction: Record<string, unknown>
              maskPng: string
              /** Straightened UV photo, aligned to the reference artwork */
              photoJpg?: string
            }
            if (!/^[a-z]+-\d+-(front|back)$/.test(id)) throw new Error(`bad id ${id}`)
            const dir = path.resolve(root, 'public/touch')
            fs.mkdirSync(dir, { recursive: true })
            const write = (name: string, dataUrl: string) =>
              fs.writeFileSync(
                path.join(dir, name),
                Buffer.from(dataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64'),
              )
            write(`${id}.png`, maskPng)
            if (photoJpg) {
              write(`${id}-photo.jpg`, photoJpg)
              extraction.photo = `/touch/${id}-photo.jpg`
            }
            const file = path.resolve(root, 'src/data/touch.json')
            const entries = JSON.parse(fs.readFileSync(file, 'utf8')) as { id: string }[]
            const entry = entries.find((e) => e.id === id)
            if (!entry) throw new Error(`unknown id ${id}`)
            Object.assign(entry, { extraction: { ...extraction, mask: `/touch/${id}.png` } })
            fs.writeFileSync(file, JSON.stringify(entries, null, 2) + '\n')
            // The watcher ignores this file (see vite.config.ts), so drop the cached module by hand:
            // the next page load gets fresh data without interrupting the tool with a live reload.
            const mod = server.moduleGraph.getModuleById(file)
            if (mod) server.moduleGraph.invalidateModule(mod)
          },
          res,
        )
      })

      const TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg' }
      const serveDir = (url: string, dir: string) =>
        server.middlewares.use(url, (req, res, next) => {
          const rel = decodeURIComponent((req.url ?? '').split('?')[0])
          const base = path.resolve(root, dir)
          const file = path.resolve(base, `.${rel}`)
          if (!file.startsWith(base) || !fs.existsSync(file) || !fs.statSync(file).isFile())
            return next()
          res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream')
          res.setHeader('Cache-Control', 'no-cache')
          fs.createReadStream(file).pipe(res)
        })
      // Rendered UV photos are only needed by the extraction tool, so they stay out of public/.
      serveDir('/uv-source', 'uv-source')
      // Masks are written after startup into a watcher-ignored folder, so Vite's public-file index
      // doesn't know them; serve them directly. (Builds copy public/ as usual.)
      serveDir('/touch', 'public/touch')
    },
  }
}
