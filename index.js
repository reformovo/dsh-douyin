/**
 * dsh-douyin — Host half.
 *
 * Owns everything that talks to Douyin: a guest identity (ttwid + msToken), the
 * a_bogus signer, the optional account binding, the home feed, and a
 * same-origin proxy for covers and video. The page only ever sees
 * `/api/douyin/...`, so the signed CDN URLs never enter browser history, and
 * neither the signature nor the account cookie leaves the Host.
 *
 * The Client half draws the vertical feed in the right Sidebar.
 */
import { Readable } from 'node:stream'
import { BrowserLogin } from './lib/browser-login.js'
import {
  DouyinSession,
  normalize,
  normalizeCookie,
  looksLoggedIn,
  isAllowedCover,
  isAllowedMedia,
} from './lib/feed.js'

export const name = 'dsh-douyin'

/** Every route this plugin serves lives under one prefix. */
const ROUTE_PREFIX = '/api/douyin'

/** Where the account jar lives in the credential store: `<owner>/<id>`. */
const CREDENTIAL_KEY = 'dsh-douyin/session'

const DEFAULTS = {
  autoPrompt: true,
  feedCount: 8,
}

/** A desktop User-Agent for the CDN, which only checks that one is present. */
const CDN_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'

/** How many cover images stay cached. */
const COVER_CACHE_LIMIT = 200
/** A pasted cookie jar is a few kilobytes; anything far larger is not one. */
const BODY_LIMIT = 64 * 1024

function resolveConfig(raw = {}) {
  const input = raw && typeof raw === 'object' ? raw : {}
  const feedCount = Number(input.feedCount)
  return {
    autoPrompt: typeof input.autoPrompt === 'boolean' ? input.autoPrompt : DEFAULTS.autoPrompt,
    feedCount: Number.isFinite(feedCount) ? Math.min(20, Math.max(4, Math.round(feedCount))) : DEFAULTS.feedCount,
  }
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body)
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.end(payload)
}

async function readJsonBody(request, limit = BODY_LIMIT) {
  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size > limit) throw new Error('request body too large')
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export function apply(ctx, config = {}) {
  const settings = resolveConfig(config)
  const logger = ctx.logger ?? { info() {}, warn() {}, error() {} }
  const session = new DouyinSession({ logger, count: settings.feedCount })
  const credentials = ctx.get('credentials')
  const login = new BrowserLogin({ logger })

  /** The account the jar belongs to, as the Host last saw it. */
  const auth = { profile: null, persisted: Boolean(credentials) }

  /** Every aweme id already handed to the page, so one stream never repeats. */
  const seen = new Set()
  /** cover url -> { type, bytes } */
  const covers = new Map()

  function proxied() {
    return {
      media: (url) => (url ? `${ROUTE_PREFIX}/media?u=${encodeURIComponent(url)}` : null),
      cover: (url) => (url ? `${ROUTE_PREFIX}/cover?u=${encodeURIComponent(url)}` : null),
    }
  }

  /** A new identity means a new recommendation stream, so forget what was served. */
  function invalidateFeed() {
    seen.clear()
  }

  /** Restore the bound account before anything reads the feed. */
  const bindingReady = (async () => {
    if (!credentials) {
      logger.warn?.('[douyin] no credential store; a bound account will only last this run')
      return
    }
    try {
      const record = await credentials.readRecord(CREDENTIAL_KEY)
      const payload = record?.kind === 'grant' ? record.payload : null
      if (payload?.cookie) {
        session.setUserCookie(payload.cookie)
        auth.profile = payload.profile ?? null
      }
    } catch (error) {
      logger.warn?.(`[douyin] could not read the account record: ${error?.message ?? error}`)
    }
  })()

  /**
   * One page, normalized and deduplicated. Ads and image posts are dropped.
   *
   * Pages are not cached here: the page holds the queue, and a repeat request
   * for a cursor means a new stream (a reopened tab or a refresh), which must
   * hit Douyin again rather than replay what the user already watched.
   */
  async function loadPage(cursor) {
    const list = await session.page(cursor)
    const items = []
    for (const aweme of list) {
      if (!aweme || aweme.is_ads || aweme.ad_aweme_source) continue
      const id = String(aweme.aweme_id ?? '')
      if (!id || seen.has(id)) continue
      const item = normalize(aweme, proxied())
      if (!item.play) continue
      seen.add(id)
      items.push(item)
    }
    return items
  }

  /** Ask for `cursor`, walking forward if a page is all ads or all repeats. */
  async function readFeed(cursor) {
    let current = cursor
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const items = await loadPage(current)
      if (items.length) return { items, cursor: current, nextCursor: current + 1 }
      current += 1
    }
    return { items: [], cursor: current, nextCursor: current + 1, exhausted: true }
  }

  async function proxyMedia(request, response, url) {
    const target = url.searchParams.get('u')
    if (!target || !isAllowedMedia(target)) return sendJson(response, 400, { ok: false, error: 'unsupported media url' })
    const headers = {
      'User-Agent': CDN_USER_AGENT,
      Referer: 'https://www.douyin.com/',
      Accept: '*/*',
      ...(request.headers.range ? { Range: request.headers.range } : {}),
    }
    const upstream = await fetch(target, { headers })
    if (!upstream.ok && upstream.status !== 206) {
      logger.warn?.(`[douyin] media upstream ${upstream.status} range=${request.headers.range ?? '-'} host=${new URL(target).host}`)
      response.statusCode = upstream.status === 403 ? 410 : 502
      response.end()
      return
    }
    response.statusCode = upstream.status
    for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
      const value = upstream.headers.get(header)
      if (value) response.setHeader(header, value)
    }
    response.setHeader('cache-control', 'private, max-age=3600')
    if (!upstream.body) {
      response.end()
      return
    }
    const stream = Readable.fromWeb(upstream.body)
    const abort = () => stream.destroy()
    request.on('close', abort)
    stream.on('error', () => response.destroy())
    stream.pipe(response)
  }

  async function proxyCover(response, url) {
    const target = url.searchParams.get('u')
    if (!target || !isAllowedCover(target)) return sendJson(response, 400, { ok: false, error: 'unsupported cover url' })
    const cached = covers.get(target)
    if (cached) {
      response.statusCode = 200
      response.setHeader('content-type', cached.type)
      response.setHeader('cache-control', 'private, max-age=86400')
      response.end(cached.bytes)
      return
    }
    const upstream = await fetch(target, {
      headers: { 'User-Agent': CDN_USER_AGENT, Referer: 'https://www.douyin.com/', Accept: 'image/*' },
    })
    if (!upstream.ok) {
      response.statusCode = upstream.status === 404 ? 404 : 502
      response.end()
      return
    }
    const bytes = Buffer.from(await upstream.arrayBuffer())
    const type = upstream.headers.get('content-type') ?? 'image/jpeg'
    covers.set(target, { type, bytes })
    if (covers.size > COVER_CACHE_LIMIT) covers.delete(covers.keys().next().value)
    response.statusCode = 200
    response.setHeader('content-type', type)
    response.setHeader('cache-control', 'private, max-age=86400')
    response.end(bytes)
  }

  /** Validate a jar against Douyin and, on success, make it the bound account. */
  async function bindCookie(rawCookie) {
    const cookie = normalizeCookie(rawCookie)
    if (!cookie) return { ok: false, status: 400, error: 'empty-cookie' }
    if (!looksLoggedIn(cookie)) return { ok: false, status: 400, error: 'not-logged-in' }
    const previous = session.userCookie
    session.setUserCookie(cookie)
    let result
    try {
      result = await session.profile()
    } catch (error) {
      session.setUserCookie(previous)
      return { ok: false, status: 502, error: `profile check failed: ${error?.message ?? error}` }
    }
    if (!result.loggedIn) {
      session.setUserCookie(previous)
      return { ok: false, status: 400, error: 'not-logged-in', reason: result.reason }
    }
    auth.profile = result.user
    invalidateFeed()
    if (credentials) {
      try {
        await credentials.modifyRecord(CREDENTIAL_KEY, async () => ({
          kind: 'grant',
          payload: { cookie, profile: result.user, at: Date.now() },
        }))
      } catch (error) {
        logger.warn?.(`[douyin] could not store the account record: ${error?.message ?? error}`)
        auth.persisted = false
      }
    }
    return { ok: true, profile: auth.profile, persisted: auth.persisted }
  }

  async function handleSession(request, response, url) {
    if (request.method === 'GET') {
      // A bound jar can expire without anything else noticing: the feed quietly
      // falls back to anonymous recommendations while the avatar stays. Asking
      // for `check=1` re-asks Douyin whose session this is.
      let expired = false
      if (session.bound && url.searchParams.get('check') === '1') {
        try {
          const result = await session.profile()
          if (result.loggedIn) {
            auth.profile = result.user
          } else {
            expired = true
          }
        } catch (error) {
          logger.warn?.(`[douyin] profile check failed: ${error?.message ?? error}`)
        }
      }
      return sendJson(response, 200, {
        ok: true,
        bound: session.bound,
        profile: auth.profile,
        persisted: auth.persisted,
        expired,
      })
    }
    if (request.method === 'DELETE') {
      session.setUserCookie('')
      auth.profile = null
      if (credentials) {
        try {
          await credentials.deleteRecord(CREDENTIAL_KEY)
        } catch (error) {
          logger.warn?.(`[douyin] could not delete the account record: ${error?.message ?? error}`)
        }
      }
      invalidateFeed()
      return sendJson(response, 200, { ok: true, bound: false, profile: null })
    }
    if (request.method !== 'POST') return sendJson(response, 405, { ok: false, error: 'method not allowed' })

    let body
    try {
      body = await readJsonBody(request)
    } catch (error) {
      return sendJson(response, 400, { ok: false, error: `bad request body: ${error?.message ?? error}` })
    }
    const result = await bindCookie(body?.cookie)
    if (!result.ok) return sendJson(response, result.status, { ok: false, error: result.error, reason: result.reason })
    return sendJson(response, 200, { ok: true, bound: true, profile: result.profile, persisted: result.persisted })
  }

  /** The one-click sign-in window, and the account binding it feeds. */
  async function handleLogin(request, response, path) {
    if (path === '/login/start') {
      if (request.method !== 'POST') return sendJson(response, 405, { ok: false, error: 'method not allowed' })
      try {
        await login.start()
      } catch (error) {
        const code = error?.code === 'no-browser' ? 'no-browser' : 'failed'
        return sendJson(response, code === 'no-browser' ? 501 : 500, { ok: false, error: code, message: error?.message ?? String(error) })
      }
      return sendJson(response, 200, { ok: true, state: login.state, browser: login.status().browser })
    }
    if (path === '/login/cancel') {
      await login.cancel()
      return sendJson(response, 200, { ok: true, state: login.state })
    }
    if (request.method !== 'GET') return sendJson(response, 405, { ok: false, error: 'method not allowed' })
    const current = login.status()
    if (current.state !== 'done' || !current.cookies) {
      return sendJson(response, 200, { ok: true, state: current.state, error: current.error, browser: current.browser })
    }
    // The window produced a jar: validate it, bind it, and only then let the
    // client stop polling.
    const jar = login.take()
    const result = await bindCookie(jar)
    if (!result.ok) {
      return sendJson(response, 200, { ok: true, state: 'failed', error: result.error, reason: result.reason })
    }
    return sendJson(response, 200, { ok: true, state: 'done', profile: result.profile, persisted: result.persisted })
  }

  async function handle(request, response) {
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`)
    const path = url.pathname.slice(ROUTE_PREFIX.length) || '/'

    if (path === '/session') {
      await bindingReady
      return handleSession(request, response, url)
    }
    if (path.startsWith('/login/')) {
      await bindingReady
      return handleLogin(request, response, path)
    }
    if (request.method === 'OPTIONS') {
      response.statusCode = 204
      response.end()
      return
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return sendJson(response, 405, { ok: false, error: 'method not allowed' })

    if (path === '/config') {
      return sendJson(response, 200, { ok: true, autoPrompt: settings.autoPrompt, feedCount: settings.feedCount })
    }
    if (path === '/feed') {
      await bindingReady
      const cursor = Math.max(1, Number(url.searchParams.get('cursor') ?? '1') || 1)
      const page = await readFeed(cursor)
      return sendJson(response, 200, { ok: true, bound: session.bound, ...page })
    }
    if (path === '/media') return proxyMedia(request, response, url)
    if (path === '/cover') return proxyCover(response, url)
    return sendJson(response, 404, { ok: false, error: 'not found' })
  }

  // Closing the sign-in window when the plugin unloads keeps a stray browser
  // from outliving the tab that opened it.
  ctx.effect(() => () => login.dispose(), 'douyin: sign-in window')

  // The Web server is optional in non-web profiles; the plugin simply parks.
  ctx.inject(['webServer'], (web) => {
    return ctx.effect(() => {
      const stop = web.webServer.register({
        kind: 'prefix',
        path: ROUTE_PREFIX,
        handler: (request, response) =>
          Promise.resolve(handle(request, response)).catch((error) => {
            logger.warn?.(`[douyin] route error: ${error?.stack ?? error}`)
            if (!response.headersSent) {
              sendJson(response, 500, { ok: false, error: 'internal error' })
            } else {
              response.end()
            }
          }),
      })
      return () => stop()
    }, 'douyin: routes')
  })
}
