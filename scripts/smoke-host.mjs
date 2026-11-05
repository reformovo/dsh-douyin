/**
 * Host smoke test: mount `apply` the way the Loader does, serve the routes the
 * way the Web server does, and hit them over HTTP. This is the closest thing
 * to the real plugin without installing it.
 *
 * Run: node scripts/smoke-host.mjs
 */
import http from 'node:http'
import { apply } from '../index.js'

const routes = []

const ctx = {
  logger: console,
  inject(services, callback) {
    if (!services.includes('webServer')) return
    callback({
      webServer: {
        register(route) {
          routes.push(route)
          return () => {
            const at = routes.indexOf(route)
            if (at >= 0) routes.splice(at, 1)
          }
        },
      },
    })
  },
  effect(factory) {
    return factory()
  },
  on() {},
  get() {
    return undefined
  },
}

apply(ctx, { panelWidth: 420, feedCount: 8 })

const server = http.createServer((request, response) => {
  const route = routes.find((entry) => request.url.startsWith(entry.path))
  if (!route) {
    response.statusCode = 404
    response.end('no route')
    return
  }
  Promise.resolve(route.handler(request, response)).catch((error) => {
    response.statusCode = 500
    response.end(String(error))
  })
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
console.log(`routes: ${routes.map((route) => route.path).join(', ')}`)
console.log(`listening on ${base}`)

const config = await (await fetch(`${base}/api/douyin/config`)).json()
console.log('config:', JSON.stringify(config))

const session0 = await (await fetch(`${base}/api/douyin/session`)).json()
console.log('session (anonymous):', JSON.stringify(session0))

const rejected = await fetch(`${base}/api/douyin/session`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ cookie: 'foo=bar; baz=qux' }),
})
console.log('bind without sessionid:', rejected.status, (await rejected.json()).error)

const fake = await fetch(`${base}/api/douyin/session`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ cookie: 'Cookie: sessionid=deadbeef; sid_tt=deadbeef; uid_tt=1' }),
})
console.log('bind with a fake session:', fake.status, (await fake.json()).error)

const unbound = await (await fetch(`${base}/api/douyin/session`, { method: 'DELETE' })).json()
console.log('unbind:', JSON.stringify(unbound))

const started = Date.now()
const feed = await (await fetch(`${base}/api/douyin/feed?cursor=1`)).json()
console.log(`feed: ok=${feed.ok} items=${feed.items?.length} cursor=${feed.cursor} next=${feed.nextCursor} in ${Date.now() - started}ms`)
if (!feed.items?.length) {
  console.log('FAIL: empty feed')
  process.exit(1)
}
const first = feed.items[0]
console.log('first:', first.id, '|', first.author.name, '|', first.desc.slice(0, 30).replace(/\n/g, ' '), '|', `${first.width}x${first.height}`, `${first.duration}ms`)
console.log('play:', first.play.slice(0, 80))
console.log('cover:', first.cover.slice(0, 70))

const media = await fetch(base + first.play, { headers: { Range: 'bytes=0-4095' } })
console.log('media:', media.status, media.headers.get('content-type'), media.headers.get('content-range'), (await media.arrayBuffer()).byteLength, 'bytes')
if (media.status !== 206) console.log('FAIL: media did not answer a range request')

const cover = await fetch(base + first.cover)
console.log('cover proxy:', cover.status, cover.headers.get('content-type'), (await cover.arrayBuffer()).byteLength, 'bytes')

const second = await (await fetch(`${base}/api/douyin/feed?cursor=${feed.nextCursor}`)).json()
const overlap = new Set(feed.items.map((entry) => entry.id))
console.log(`page 2: items=${second.items?.length} new=${second.items?.filter((entry) => !overlap.has(entry.id)).length}`)

const blocked = await fetch(`${base}/api/douyin/media?u=${encodeURIComponent('https://example.com/x.mp4')}`)
console.log('host allowlist:', blocked.status)

server.close()
const problems = [
  feed.ok,
  feed.items.length,
  media.status === 206,
  cover.status === 200,
  second.items.length,
  session0.bound === false,
  rejected.status === 400,
  fake.status === 400,
  unbound.bound === false,
].filter((value) => !value).length
console.log(problems === 0 ? '\nPASS' : `\nFAIL (${problems})`)
process.exit(problems === 0 ? 0 : 1)
