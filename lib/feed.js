/**
 * The Douyin side of the plugin: a browser identity, signed requests, the
 * account binding, and the normalisation the client renders.
 *
 * Everything here runs in the Host. The browser never sees a Douyin URL it did
 * not ask the proxy for, never sees the signature, and never sees the account
 * cookie.
 */
import { ABogus, DEFAULT_BROWSER_INFO } from './abogus.js'

/**
 * One desktop Chrome identity. The User-Agent, the `browser_*` query fields and
 * the geometry inside the signature all have to agree: Douyin echoes each back
 * beside the others, so a mismatch is a free signal.
 */
const IDENTITY = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
  browserInfo: DEFAULT_BROWSER_INFO,
  screen: [1920, 1080],
  browser: { name: 'Chrome', version: '146.0.0.0' },
  engine: { name: 'Blink', version: '146.0.0.0' },
  os: { name: 'Windows', version: '10' },
  platform: 'Win32',
}

/** Web client build identifiers. Douyin rejects a `version_code` far behind the live build. */
const WEB_CLIENT = { versionCode: '290100', versionName: '29.1.0', updateVersionCode: '170400' }

const TTWID_ENDPOINT = 'https://ttwid.bytedance.com/ttwid/union/register/'
const FEED_ENDPOINT = 'https://www.douyin.com/aweme/v1/web/tab/feed/'
const PROFILE_ENDPOINT = 'https://www.douyin.com/aweme/v1/web/user/profile/self/'

/** Guest tokens outlive a session by hours; refresh well inside that. */
const TTWID_TTL_MS = 6 * 60 * 60 * 1000
const MS_TOKEN_TTL_MS = 30 * 60 * 1000

function randomToken(length) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-'
  let out = ''
  for (let index = 0; index < length; index += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

/** The query every request carries, before the request's own fields. */
function baseParams() {
  const [width, height] = IDENTITY.screen
  return {
    device_platform: 'webapp',
    aid: '6383',
    channel: 'channel_pc_web',
    pc_client_type: '1',
    version_code: WEB_CLIENT.versionCode,
    version_name: WEB_CLIENT.versionName,
    cookie_enabled: 'true',
    screen_width: String(width),
    screen_height: String(height),
    browser_language: 'zh-CN',
    browser_platform: IDENTITY.platform,
    browser_name: IDENTITY.browser.name,
    browser_version: IDENTITY.browser.version,
    browser_online: 'true',
    engine_name: IDENTITY.engine.name,
    engine_version: IDENTITY.engine.version,
    os_name: IDENTITY.os.name,
    os_version: IDENTITY.os.version,
    cpu_core_num: '8',
    device_memory: '8',
    platform: 'PC',
    downlink: '10',
    effective_type: '4g',
    round_trip_time: '0',
    update_version_code: WEB_CLIENT.updateVersionCode,
  }
}

/** Hosts a proxied media or cover URL may point at. */
const MEDIA_HOST_PATTERN = /(^|\.)(douyin\.com|douyinvod\.com|bytecdn\.cn|douyinpic\.com|douyinstatic\.com|amemv\.com|snssdk\.com|pstatp\.com|byteimg\.com|iesdouyin\.com)$/
const COVER_HOST_PATTERN = /(^|\.)(douyinpic\.com|byteimg\.com|pstatp\.com|douyinstatic\.com|amemv\.com|snssdk\.com)$/

export function isAllowedMedia(url) {
  try {
    const parsed = new URL(url)
    return /^https?:$/.test(parsed.protocol) && MEDIA_HOST_PATTERN.test(parsed.hostname)
  } catch {
    return false
  }
}

export function isAllowedCover(url) {
  try {
    const parsed = new URL(url)
    return /^https?:$/.test(parsed.protocol) && COVER_HOST_PATTERN.test(parsed.hostname)
  } catch {
    return false
  }
}

/**
 * Accept what a user copied out of DevTools: an optional `Cookie:` prefix, one
 * cookie per line or all on one line, and stray whitespace. Everything that is
 * not a `name=value` pair is dropped, so a pasted header block cannot smuggle
 * anything else into a request.
 */
export function normalizeCookie(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return ''
  // Two shapes arrive from a browser: the whole `Cookie:` request header on one
  // line, and a paste of the DevTools cookie table, which is tab-separated with
  // a header row. Both collapse to `name=value` pairs; anything else is dropped,
  // so a pasted block cannot smuggle another header into the request.
  const parts = text.replace(/^cookie:\s*/i, '').split(/[;\r\n]+/)
  const pairs = []
  const seen = new Set()
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    let name
    let value
    if (trimmed.includes('\t')) {
      const cells = trimmed.split('\t')
      name = (cells[0] ?? '').trim()
      value = (cells[1] ?? '').trim()
      if (name === 'Name' && value === 'Value') continue
    } else if (trimmed.includes('=')) {
      const at = trimmed.indexOf('=')
      name = trimmed.slice(0, at).trim()
      value = trimmed.slice(at + 1).trim()
    } else {
      continue
    }
    if (!/^[A-Za-z0-9_.-]+$/.test(name)) continue
    if (seen.has(name)) continue
    seen.add(name)
    pairs.push(`${name}=${value}`)
  }
  return pairs.join('; ')
}

/** Does this cookie jar carry the login token Douyin issues after signing in? */
export function looksLoggedIn(cookie) {
  return /(^|;\s*)(sessionid|sessionid_ss|sid_tt)=/.test(cookie)
}

/** The jar's own values win; the guest tokens only fill what is missing. */
function mergeCookies(jar, extra) {
  const pairs = (jar ?? '').split(';').map((part) => part.trim()).filter(Boolean)
  const names = new Set(pairs.map((pair) => pair.slice(0, pair.indexOf('=')).trim()))
  for (const [name, value] of Object.entries(extra)) {
    if (value && !names.has(name)) pairs.push(`${name}=${value}`)
  }
  return pairs.join('; ')
}

/**
 * Pick a playable URL. Douyin publishes HEVC first and H.264 beside it; a
 * Chromium page can only decode the latter, so prefer an explicit H.264
 * rendition and fall back to the generic one.
 */
function pickPlayUrl(video) {
  // `play_addr` lists a direct CDN host first and Douyin's own `/aweme/v1/play/`
  // redirect last. The CDN hosts reject requests that did not come from the
  // page that asked for them; the redirect route hands back a working URL for
  // any client, so it is the one to take.
  const candidates = [
    ...(video?.play_addr_h264?.url_list ?? []),
    ...(video?.play_addr?.url_list ?? []),
  ]
  const signed = candidates.find((url) => {
    try {
      return new URL(url).hostname === 'www.douyin.com'
    } catch {
      return false
    }
  })
  if (signed) return signed
  if (candidates[0]) return candidates[0]
  const rates = Array.isArray(video?.bit_rate) ? video.bit_rate : []
  const h264 = rates.filter((rate) => rate && rate.is_h265 !== 1 && rate.play_addr?.url_list?.[0])
  const preferred = h264
    .slice()
    .sort((left, right) => (right.play_addr?.width ?? 0) - (left.play_addr?.width ?? 0))[0]
  return preferred?.play_addr?.url_list?.[0] ?? rates.find((rate) => rate?.play_addr?.url_list?.[0])?.play_addr?.url_list?.[0] ?? null
}

function pickCover(aweme) {
  return aweme?.video?.cover?.url_list?.[0]
    ?? aweme?.video?.origin_cover?.url_list?.[0]
    ?? aweme?.video?.dynamic_cover?.url_list?.[0]
    ?? aweme?.images?.[0]?.url_list?.[0]
    ?? null
}

/** One `aweme` as the client needs it, with same-origin URLs for media. */
export function normalize(aweme, proxied) {
  const play = pickPlayUrl(aweme?.video)
  const cover = pickCover(aweme)
  const stats = aweme?.statistics ?? {}
  return {
    id: String(aweme?.aweme_id ?? ''),
    desc: String(aweme?.desc ?? '').trim(),
    author: {
      name: String(aweme?.author?.nickname ?? ''),
      avatar: proxied.cover(aweme?.author?.avatar_thumb?.url_list?.[0] ?? aweme?.author?.avatar_medium?.url_list?.[0]),
    },
    duration: Number(aweme?.video?.duration ?? 0),
    width: Number(aweme?.video?.width ?? 0),
    height: Number(aweme?.video?.height ?? 0),
    cover: proxied.cover(cover),
    play: play ? proxied.media(play) : null,
    music: String(aweme?.music?.title ?? ''),
    stats: {
      digg: Number(stats.digg_count ?? 0),
      comment: Number(stats.comment_count ?? 0),
      share: Number(stats.share_count ?? 0),
      collect: Number(stats.collect_count ?? 0),
    },
    // Image posts carry slides instead of a video stream.
    images: Array.isArray(aweme?.images) && aweme.images.length
      ? aweme.images.map((image) => proxied.cover(image?.url_list?.[0])).filter(Boolean)
      : null,
  }
}

/**
 * A Douyin web session: a registered `ttwid`, a local `msToken`, the signer,
 * and — once the user binds one — their account's cookie jar.
 *
 * Reading the feed while bound is what makes the recommendations personal:
 * Douyin answers the same endpoint from the account's own history instead of a
 * guest profile.
 */
export class DouyinSession {
  constructor({ logger, count = 8 } = {}) {
    this.logger = logger ?? { info() {}, warn() {} }
    this.count = count
    this.ttwid = null
    this.ttwidAt = 0
    this.msToken = null
    this.msTokenAt = 0
    this.userCookie = ''
    this.signer = new ABogus(IDENTITY.userAgent, { browserInfo: IDENTITY.browserInfo })
  }

  /** Attach or clear the account jar. Accepts what a user pasted. */
  setUserCookie(raw) {
    this.userCookie = normalizeCookie(raw)
    return this.userCookie
  }

  get bound() {
    return this.userCookie.length > 0
  }

  async ensureSession() {
    const now = Date.now()
    if (!this.ttwid || now - this.ttwidAt > TTWID_TTL_MS) {
      this.ttwid = await this.registerTtwid()
      this.ttwidAt = now
    }
    if (!this.msToken || now - this.msTokenAt > MS_TOKEN_TTL_MS) {
      this.msToken = randomToken(107)
      this.msTokenAt = now
    }
    return { ttwid: this.ttwid, msToken: this.msToken }
  }

  /** Register a guest `ttwid`; this is the only token that needs the network. */
  async registerTtwid() {
    const response = await fetch(TTWID_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        region: 'cn',
        aid: 1768,
        needFid: false,
        service: 'www.ixigua.com',
        migrate_info: { ticket: '', source: 'node' },
        cbUrlProtocol: 'https',
        union: true,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    const cookies = response.headers.getSetCookie?.() ?? []
    const pair = cookies.map((line) => line.split(';')[0]).find((entry) => entry.startsWith('ttwid='))
    if (!pair) throw new Error(`ttwid registration returned no cookie (HTTP ${response.status})`)
    return pair.slice('ttwid='.length)
  }

  /** One signed GET. The `a_bogus` covers the exact query string sent. */
  async signedGet(endpoint, params) {
    const { ttwid, msToken } = await this.ensureSession()
    const query = new URLSearchParams({ ...baseParams(), ...params, msToken }).toString()
    const aBogus = this.signer.getValue(query)
    return fetch(`${endpoint}?${query}&a_bogus=${aBogus}`, {
      headers: {
        'User-Agent': IDENTITY.userAgent,
        Referer: 'https://www.douyin.com/',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        Cookie: mergeCookies(this.userCookie, { ttwid, msToken }),
      },
      signal: AbortSignal.timeout(15_000),
    })
  }

  /** One page of the home feed. `refreshIndex` is the page counter the page itself sends. */
  async feed(refreshIndex = 1) {
    const response = await this.signedGet(FEED_ENDPOINT, {
      count: String(this.count),
      refresh_index: String(refreshIndex),
      refer_id: '',
      refer_type: '10',
      is_pull_refresh: '1',
      hot_search: '',
      cold_start: '0',
      category_id: '',
      query_correct_type: '1',
      is_filter_search: '0',
    })
    if (!response.ok) throw new Error(`feed request failed with HTTP ${response.status}`)
    const body = await response.json().catch(() => null)
    if (!body || typeof body !== 'object') throw new Error('feed response was not JSON')
    if (body.status_code !== 0) throw new Error(`feed rejected the request (status_code ${body.status_code})`)
    return Array.isArray(body.aweme_list) ? body.aweme_list : []
  }

  /** Who is behind the current cookie jar. */
  async profile() {
    const response = await this.signedGet(PROFILE_ENDPOINT, {})
    if (!response.ok) throw new Error(`profile request failed with HTTP ${response.status}`)
    const body = await response.json().catch(() => null)
    if (!body || body.status_code !== 0 || !body.user) {
      return { loggedIn: false, reason: String(body?.status_msg ?? '') }
    }
    const user = body.user
    return {
      loggedIn: true,
      user: {
        nickname: String(user.nickname ?? ''),
        uid: String(user.uid ?? ''),
        secUid: String(user.sec_uid ?? ''),
        avatar: String(user.avatar_thumb?.url_list?.[0] ?? user.avatar_medium?.url_list?.[0] ?? ''),
        uniqueId: String(user.unique_id ?? ''),
      },
    }
  }

  /** Fetch the feed, retrying once; a bound session keeps its account cookie. */
  async page(refreshIndex = 1) {
    let list = await this.feed(refreshIndex)
    if (!list.length) {
      this.logger.warn?.('[douyin] empty feed page, retrying with a fresh guest identity')
      // The guest tokens are ours to rotate; the account's cookie is not.
      this.ttwid = null
      this.msToken = null
      list = await this.feed(refreshIndex)
    }
    return list
  }
}

export { IDENTITY }
