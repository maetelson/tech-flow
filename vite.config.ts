import { defineConfig } from 'vite'
import path from 'path'
import { writeFileSync, mkdirSync } from 'fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const saveFlowsPlugin = {
  name: 'save-flows-api',
  configureServer(server: any) {
    server.middlewares.use('/api/save-flows', (req: any, res: any) => {
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.end('Method Not Allowed')
        return
      }
      let body = ''
      req.on('data', (chunk: any) => { body += chunk })
      req.on('end', () => {
        try {
          const data = JSON.parse(body)
          const outputDir = path.resolve(__dirname, 'public/data')
          const outputPath = path.join(outputDir, 'flows.seed.json')
          mkdirSync(outputDir, { recursive: true })
          writeFileSync(outputPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ ok: false, error: String(e) }))
        }
      })
    })
  },
}

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    saveFlowsPlugin,
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
