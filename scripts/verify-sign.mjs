/**
 * Offline proof that the port matches the real SDK.
 *
 * The fixture holds a_bogus strings a real Chromium produced. Every fixed thing
 * in them is checked here: the header magic, the SDK version block, the
 * checksum, Douyin's own page id and aid, and — the part that matters — the
 * three digest chains, which bind the query, the body and the User-Agent. Those
 * digests are deterministic, so recomputing them from the same inputs must
 * reproduce the bytes the browser wrote.
 *
 * Run: node scripts/verify-sign.mjs
 */
import { readFile } from 'node:fs/promises'
import {
  ABogus, decode, digestOf, structureError, userAgentDigest, DEFAULT_BROWSER_INFO,
} from '../lib/abogus.js'

const fixture = JSON.parse(await readFile(new URL('../fixtures/abogus_browser.json', import.meta.url), 'utf8'))

function chain(digest, chain) {
  return [
    digest[chain.indices[0]],
    digest[chain.indices[1]],
    (() => {
      for (let i = chain.canary[0]; i < digest.length; i += 1) {
        if (digest[i] !== chain.canary[1]) return digest[i]
      }
      return chain.canary[2]
    })(),
  ]
}

const CHAINS = {
  query: { slots: ['L48', 'L49', 'L51'], indices: [9, 18], canary: [3, 11, 12] },
  body: { slots: ['L52', 'L53', 'L55'], indices: [10, 19], canary: [4, 8, 9] },
  user_agent: { slots: ['L56', 'L57', 'L59'], indices: [11, 21], canary: [5, 12, 13] },
}

let failures = 0
const report = (ok, label, detail = '') => {
  if (!ok) failures += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
}

for (const [index, sample] of fixture.samples.entries()) {
  console.log(`\n--- sample ${index + 1} (${sample.bdms_version}) ---`)
  const problem = structureError(sample.a_bogus)
  report(problem === null, 'structure', problem ?? '')
  if (problem) continue

  const decoded = decode(sample.a_bogus)
  report(decoded.aid === 6383, 'aid', String(decoded.aid))
  report(decoded.pageId === 6241, 'pageId', String(decoded.pageId))
  report(
    Math.abs(decoded.nowMs / 1000 - sample.sibling_timestamp) <= 2,
    'clock agrees with sibling timestamp',
    `${decoded.nowMs} vs ${sample.sibling_timestamp * 1000}`,
  )

  const expected = {
    query: digestOf(sample.query),
    body: digestOf(sample.body),
    user_agent: userAgentDigest(sample.user_agent),
  }
  for (const [name, chainSpec] of Object.entries(CHAINS)) {
    const want = chain(expected[name], chainSpec)
    const got = chainSpec.slots.map((slot) => decoded.fields[slot])
    report(want.join() === got.join(), `${name} digest chain`, `${got.join()} vs ${want.join()}`)
  }
  const geometry = decoded.browserInfo
  report(geometry === sample.browser_info, 'browser geometry', `${geometry} vs ${sample.browser_info}`)
}

console.log('\n--- signing round trip ---')
const signer = new ABogus(fixture.samples[0].user_agent, { browserInfo: DEFAULT_BROWSER_INFO })
const query = 'device_platform=webapp&aid=6383&channel=channel_pc_web&count=10&refresh_index=1'
const value = signer.getValue(query)
const roundTrip = structureError(value)
report(roundTrip === null, 'generated signature is well formed', roundTrip ?? '')
if (!roundTrip) {
  const decoded = decode(value)
  report(decoded.aid === 6383 && decoded.pageId === 6241, 'generated carries aid/pageId')
  report(
    CHAINS.query.slots.map((slot) => decoded.fields[slot]).join() === chain(digestOf(query), CHAINS.query).join(),
    'generated binds its query',
  )
  console.log(`\na_bogus(${value.length} chars): ${value.slice(0, 60)}…`)
}

console.log(`\n${failures === 0 ? 'PASS' : `FAIL (${failures})`}`)
process.exit(failures === 0 ? 0 : 1)
