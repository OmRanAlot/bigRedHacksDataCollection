import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'

const dataFile = join(process.cwd(), 'data', 'samples.json')
const mainDataFile = join(process.cwd(), 'data', 'main.json')

function localStorageApi(): Plugin {
  async function readSamples(file = dataFile): Promise<unknown[]> {
    try {
      return JSON.parse(await readFile(file, 'utf8')) as unknown[]
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
  }

  async function writeSamples(samples: unknown[], file = dataFile): Promise<void> {
    const directory = join(process.cwd(), 'data')
    const temporaryFile = `${file}.tmp`
    await mkdir(directory, { recursive: true })
    await writeFile(temporaryFile, `${JSON.stringify(samples, null, 2)}\n`, 'utf8')
    await rm(file, { force: true })
    await rename(temporaryFile, file)
  }

  return {
    name: 'local-sample-storage',
    configureServer(server: ViteDevServer) {
      const handler = (file: string) => async (request: Parameters<ViteDevServer['middlewares']['use']>[1] extends (req: infer R, res: unknown, next: unknown) => unknown ? R : never, response: Parameters<ViteDevServer['middlewares']['use']>[1] extends (req: unknown, res: infer R, next: unknown) => unknown ? R : never) => {
        try {
          if (request.method === 'GET') {
            response.setHeader('Content-Type', 'application/json')
            response.end(JSON.stringify(await readSamples(file)))
            return
          }

          const chunks: Buffer[] = []
          for await (const chunk of request) chunks.push(Buffer.from(chunk))
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown

          if (request.method === 'POST') {
            const samples = await readSamples(file)
            const incoming = body as { id?: string }
            const withoutExisting = samples.filter(sample => (sample as { id?: string }).id !== incoming.id)
            await writeSamples([...withoutExisting, incoming], file)
          } else if (request.method === 'PUT') {
            if (!Array.isArray(body)) throw new Error('Samples must be an array.')
            await writeSamples(body, file)
          } else if (request.method === 'DELETE') {
            const id = new URL(request.url ?? '/', 'http://localhost').searchParams.get('id')
            await writeSamples((await readSamples(file)).filter(sample => (sample as { id?: string }).id !== id), file)
          } else {
            response.statusCode = 405
            response.end('Method Not Allowed')
            return
          }
          response.statusCode = 204
          response.end()
        } catch (error) {
          response.statusCode = 500
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Local storage failed.' }))
        }
      }
      server.middlewares.use('/api/samples', handler(dataFile))
      server.middlewares.use('/api/main', handler(mainDataFile))
    },
  }
}

export default defineConfig({
  plugins: [react(), localStorageApi()],
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
  server: {
    allowedHosts: ['.ngrok-free.app']
  }
})
