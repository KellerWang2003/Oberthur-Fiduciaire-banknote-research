import path from 'node:path'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { saveFlowsPlugin } from './vite-save-flows.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    saveFlowsPlugin(),
  ],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
    // The touch extraction tool rewrites these while batch-processing; reloading mid-run would stop it.
    watch: { ignored: ['**/src/data/touch.json', '**/public/touch/**'] },
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
})
