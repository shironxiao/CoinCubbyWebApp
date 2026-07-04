import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { config } from './config.js'
import { pulseLocker } from './gpio.js'
import { reportInsertedPayment } from './api.js'

const publicDir = join(process.cwd(), 'public')

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
}

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://localhost:${config.port}`)
  const safePath = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^(\.\.[/\\])+/, '')
  const filePath = join(publicDir, safePath)
  const contentType = contentTypes[extname(filePath)] || 'application/octet-stream'
  const file = await readFile(filePath)

  response.writeHead(200, { 'Content-Type': contentType })
  response.end(file)
}

export function startServer(deviceState) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://localhost:${config.port}`)

      if (request.method === 'GET' && url.pathname === '/api/status') {
        return json(response, 200, deviceState.snapshot())
      }

      if (request.method === 'POST' && url.pathname === '/api/test-unlock') {
        const body = await readJson(request)
        const lockerId = Number(body.locker_id)
        const pin = await pulseLocker(lockerId)
        return json(response, 200, { ok: true, locker_id: lockerId, gpio: pin })
      }

      if (request.method === 'POST' && url.pathname === '/api/payment-progress') {
        const body = await readJson(request)
        const result = await reportInsertedPayment(Number(body.payment_session_id), Number(body.amount_inserted))
        return json(response, 200, result)
      }

      if (request.method === 'GET') {
        return serveStatic(request, response)
      }

      return json(response, 405, { error: 'Method not allowed.' })
    } catch (error) {
      return json(response, 500, { error: error.message })
    }
  })

  server.listen(config.port, () => {
    console.log(`CoinCubby Pi controller status page: http://localhost:${config.port}`)
  })

  return server
}
