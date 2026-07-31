const http = require('http')
const { main } = require('./index')

const PORT = Number(process.env.PORT || 9000)
const MAX_BODY_BYTES = 64 * 1024

const server = http.createServer(async (request, response) => {
  const chunks = []
  let bytesRead = 0

  request.on('data', (chunk) => {
    bytesRead += chunk.length
    if (bytesRead > MAX_BODY_BYTES) {
      request.destroy()
      return
    }
    chunks.push(chunk)
  })

  request.on('error', () => {
    writeResponse(response, 400, { error: 'invalid_request' })
  })

  request.on('end', async () => {
    if (bytesRead > MAX_BODY_BYTES) {
      writeResponse(response, 413, { error: 'payload_too_large' })
      return
    }

    try {
      const result = await main({
        body: Buffer.concat(chunks).toString('utf8'),
        httpMethod: request.method,
      })
      writeResponse(response, result.statusCode, result.body, result.headers, true)
    } catch {
      writeResponse(response, 500, { error: 'internal_error' })
    }
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`logAnalyticsEvent listening on ${PORT}`)
})

function writeResponse(response, statusCode, body, headers = {}, isSerialized = false) {
  if (response.writableEnded) return
  response.writeHead(statusCode, headers)
  response.end(isSerialized ? body : JSON.stringify(body))
}
