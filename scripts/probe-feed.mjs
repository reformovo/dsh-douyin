/**
 * Live probe: can a_bogus alone get the home feed?
 *
 * This is the experiment the whole plugin rests on. It registers a guest
 * ttwid, builds the same query the Web page builds, signs it, and prints the
 * status and a slice of the body. Nothing here ships; `lib/feed.js` is the
 * same sequence with caching.
 *
 * Run: node scripts/probe-feed.mjs [--no-ms] [--no-ttwid]
 */
import { ABogus, DEFAULT_BROWSER_INFO } from '../lib/abogus.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
const args = new Set(process.argv.slice(2))
const base = {
  device_platform: 'webapp',
  aid: '6383',
  channel: 'channel_pc_web',
  pc_client_type: '1',
  version_code: '290100',
  version_name: '29.1.0',
  cookie_enabled: 'true',
  screen_width: '1920',
  screen_height: '1080',
  browser_language: 'zh-CN',
  browser_platform: 'Win32',
  browser_name: 'Chrome',
  browser_version: '146.0.0.0',
  browser_online: 'true',
  engine_name: 'Blink',
  engine_version: '146.0.0.0',
  os_name: 'Windows',
  os_version: '10',
  cpu_core_num: '8',
  device_memory: '8',
  platform: 'PC',
  downlink: '10',
  effective_type: '4g',
  round_trip_time: '0',
  update_version_code: '170400',
}

function randomString(length) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-'
  let out = ''
  for (let i = 0; i < length; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

async function registerTtwid() {
  if (args.has('--no-ttwid')) return null
  const response = await fetch('https://ttwid.bytedance.com/ttwid/union/register/', {
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
  })
  const cookies = response.headers.getSetCookie?.() ?? []
  const ttwid = cookies.map((line) => line.split(';')[0]).find((pair) => pair.startsWith('ttwid='))
  console.log(`ttwid register: ${response.status} ${ttwid ? `${ttwid.slice(0, 24)}…` : 'no cookie'}`)
  return ttwid ? ttwid.slice('ttwid='.length) : null
}

const ttwid = await registerTtwid()
const msToken = args.has('--no-ms') ? null : randomString(107)

const params = {
  ...base,
  count: '10',
  refresh_index: '1',
  refer_id: '',
  refer_type: '10',
  is_pull_refresh: '1',
  hot_search: '',
  cold_start: '0',
  category_id: '',
  query_correct_type: '1',
  is_filter_search: '0',
}
if (msToken) params.msToken = msToken

const query = new URLSearchParams(params).toString()
const signer = new ABogus(UA, { browserInfo: DEFAULT_BROWSER_INFO })
const aBogus = signer.getValue(query)
const url = `https://www.douyin.com/aweme/v1/web/tab/feed/?${query}&a_bogus=${aBogus}`

const cookie = [ttwid && `ttwid=${ttwid}`, msToken && `msToken=${msToken}`].filter(Boolean).join('; ')
const started = Date.now()
const response = await fetch(url, {
  headers: {
    'User-Agent': UA,
    Referer: 'https://www.douyin.com/',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    ...(cookie ? { Cookie: cookie } : {}),
  },
})
const text = await response.text()
console.log(`feed: ${response.status} ${text.length}B in ${Date.now() - started}ms`)
console.log(text.slice(0, 400).replace(/\s+/g, ' '))

let parsed = null
try {
  parsed = JSON.parse(text)
} catch {
  console.log('\n(not JSON)')
}
if (parsed) {
  console.log(`\nstatus_code=${parsed.status_code} aweme_list=${parsed.aweme_list?.length ?? 0}`)
  const first = parsed.aweme_list?.[0]
  if (first) {
    console.log('first:', JSON.stringify({
      id: first.aweme_id,
      desc: String(first.desc).slice(0, 40),
      author: first.author?.nickname,
      duration: first.video?.duration,
      play: first.video?.play_addr?.url_list?.[0]?.slice(0, 90),
      cover: first.video?.cover?.url_list?.[0]?.slice(0, 70),
    }, null, 2))
  }
}
