/**
 * a_bogus — the signature Douyin's Web puts on every data endpoint.
 *
 * A JavaScript port of the clean-room Python implementation in `dtk`
 * (`src/dtk/signing/native/abogus.py`, Apache-2.0), which was reversed from
 * Douyin's own `bdms.js` v1.0.1.19-fix.01. The layout, the constants and the
 * three digest chains are reproduced exactly; the noise bytes are free, so two
 * correct signers never produce the same string.
 *
 * `decode()` and `structureError()` exist for tests: they take a signature
 * apart and re-check every fixed field, which is how a port proves itself
 * against signatures a real browser produced.
 */
import { sm3, utf8 } from './sm3.js'

/** The two alphabets the SDK reaches from here: `s3` for the User-Agent, `s4` for the result. */
export const ALPHABETS = {
  s3: 'ckdp1h4ZKsUB80/Mfvw36XIgR25+WQAlEi7NLboqYTOPuzmFjJnryx9HVGDaStCe',
  s4: 'Dkdpgh2ZmsQB80/MfvV36XI1R45-WUAlEixNLwoqYTOPuzKFjJnry79HbGcaStCe',
}

/** Appended to the query and the body before hashing. */
export const SALT = 'dhzx'

/** The two plaintext bytes every signature's header carries. */
export const HEADER_MAGIC = [3, 82]

/** `1.0.1.19-fix.01` as the SDK parses it. */
export const SDK_VERSION = [1, 0, 1, 0]

/** The one-byte payload key. */
export const PAYLOAD_KEY = 0xd3

/** 2024-07-24T16:00:00Z; one field counts fortnights from here. */
export const FORTNIGHT_EPOCH_MS = 1_721_836_800_000

/** Douyin web's own identifiers, carried in the signature and in the query. */
export const PAGE_ID = 6241
export const AID = 6383

const NOISE_MASKS = [0x91, 0x42, 0x2c]
const DATA_MASKS = [0x6e, 0xbd, 0xd3]

/** How the fifty scalars are shuffled into the payload. */
export const FIELD_ORDER = [
  'L34', 'L44', 'L56', 'L61', 'L73', 'L29', 'L70', 'L45', 'L35', 'L49',
  'L38', 'L66', 'L51', 'L68', 'L28', 'L48', 'L64', 'L47', 'L30', 'L71',
  'L26', 'L55', 'L31', 'L69', 'L59', 'L40', 'L62', 'L63', 'L27', 'L72',
  'L41', 'L74', 'L57', 'L52', 'L42', 'L39', 'L33', 'L67', 'L53', 'L43',
  'L65', 'L46', 'L36', 'L24', 'L60', 'L32', 'L79', 'L80', 'L84', 'L85',
]

/** Sentinel / offset / fallback for the three digest canaries. */
const CANARIES = [[3, 11, 12], [4, 8, 9], [5, 12, 13]]

/** Where each hashed input leaves its three bytes. */
const DIGEST_CHAINS = {
  query: { slots: ['L48', 'L49', 'L51'], indices: [9, 18], canary: CANARIES[0] },
  body: { slots: ['L52', 'L53', 'L55'], indices: [10, 19], canary: CANARIES[1] },
  user_agent: { slots: ['L56', 'L57', 'L59'], indices: [11, 21], canary: CANARIES[2] },
}

const ENV_FLAGS = 1
const DETECT_FLAGS = 14
const NR_FLAGS = 0x21
const NR_TAG = [0, 0, 0, 0]
const TRIPWIRE_LOCKED = 3
const CALL_BUCKET = 6

/** Chrome on a 1080p display, the identity used when a caller does not supply one. */
export const DEFAULT_BROWSER_INFO = '1920|947|1920|1032|1920|1032|1920|1080|Win32'

const HEADER_NOISE_BANDS = {
  chrome: 0,
  firefox: 40,
  safari: 81,
  edge: 125,
  huawei: 170,
  other: 210,
}
const TRIPWIRE_SET = 0xb2
const TRIPWIRE_FREE = 0x4d

const TASKBAR_PX = 48
const CHROME_PX = 85

/** The `navigator`/`screen` string the signature carries verbatim. */
export function buildBrowserInfo(values) {
  return [
    values.innerWidth,
    values.innerHeight,
    values.outerWidth,
    values.outerHeight,
    values.availWidth,
    values.availHeight,
    values.screenWidth,
    values.screenHeight,
    values.platform,
  ].join('|')
}

/** A nine-field geometry consistent with one screen size. */
export function browserInfoFromScreen(width, height, platform) {
  const availHeight = Math.max(height - TASKBAR_PX, 1)
  return buildBrowserInfo({
    innerWidth: width,
    innerHeight: Math.max(availHeight - CHROME_PX, 1),
    outerWidth: width,
    outerHeight: availHeight,
    availWidth: width,
    availHeight,
    screenWidth: width,
    screenHeight: height,
    platform,
  })
}

/** The SDK's RC4: descending S-box, multiplying key schedule, stock keystream. */
export function rc4(key, data) {
  const box = new Uint8Array(256)
  for (let i = 0; i < 256; i += 1) box[255 - i] = i
  let j = 0
  for (let i = 0; i < 256; i += 1) {
    j = (j * box[i] + j + key[i % key.length]) % 256
    const swap = box[i]
    box[i] = box[j]
    box[j] = swap
  }
  const out = new Uint8Array(data.length)
  let i = 0
  j = 0
  for (let index = 0; index < data.length; index += 1) {
    i = (i + 1) % 256
    j = (j + box[i]) % 256
    const swap = box[i]
    box[i] = box[j]
    box[j] = swap
    out[index] = data[index] ^ box[(box[i] + box[j]) % 256]
  }
  return out
}

/** Base64 over one of the SDK's alphabets, with a literal `=` pad. */
export function encodeBase64(data, alphabet = 's4') {
  const table = ALPHABETS[alphabet]
  const out = []
  for (let offset = 0; offset < data.length; offset += 3) {
    const chunk = data.subarray(offset, offset + 3)
    let block = 0
    for (let i = 0; i < 3; i += 1) block = block * 256 + (i < chunk.length ? chunk[i] : 0)
    const shifts = [18, 12, 6, 0]
    for (let i = 0; i < chunk.length + 1; i += 1) out.push(table[(block >> shifts[i]) & 0x3f])
  }
  while (out.length % 4) out.push('=')
  return out.join('')
}

/** Inverse of `encodeBase64`. */
export function decodeBase64(text, alphabet = 's4') {
  const table = ALPHABETS[alphabet]
  const index = new Map()
  for (let i = 0; i < table.length; i += 1) index.set(table[i], i)
  const body = text.replace(/=+$/, '')
  const out = []
  for (let offset = 0; offset < body.length; offset += 4) {
    const chunk = body.slice(offset, offset + 4)
    let block = 0
    for (const char of chunk) {
      const digit = index.get(char)
      if (digit === undefined) throw new Error(`not a ${alphabet} digit: ${char}`)
      block = block * 64 + digit
    }
    for (let i = 0; i < chunk.length - 1; i += 1) {
      out.push((block >> (16 - i * 8)) & 0xff)
    }
  }
  return Uint8Array.from(out)
}

/**
 * A JavaScript string as the SDK turns it into bytes: one byte per UTF-16 code
 * unit below U+0100, two big-endian bytes above it. Not UTF-8.
 */
export function jsBytes(text) {
  const out = []
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    if (code & 0xff00) out.push(code >> 8)
    out.push(code & 0xff)
  }
  return Uint8Array.from(out)
}

function littleEndianBytes(value, count) {
  const out = []
  for (let index = 0; index < count; index += 1) out.push(Math.floor(value / 2 ** (8 * index)) & 0xff)
  return out
}

function canary(digest, offset, sentinel, fallback) {
  for (let i = offset; i < digest.length; i += 1) {
    if (digest[i] !== sentinel) return digest[i]
  }
  return fallback
}

/** `SM3(SM3(text + SALT))`. */
export function digestOf(text) {
  return sm3(sm3(utf8(text + SALT)))
}

/** The third chain: RC4 the User-Agent, base64 it, hash it once. */
export function userAgentDigest(userAgent) {
  const key = Uint8Array.from([Math.floor(ENV_FLAGS / 256), ENV_FLAGS % 256, DETECT_FLAGS % 256])
  const sealed = rc4(key, jsBytes(userAgent.trim()))
  return sm3(utf8(encodeBase64(sealed, 's3')))
}

function chainBytes(chain, digest) {
  return [
    digest[chain.indices[0]],
    digest[chain.indices[1]],
    canary(digest, chain.canary[0], chain.canary[1], chain.canary[2]),
  ]
}

function familyOf(userAgent) {
  const ua = userAgent.toLowerCase()
  for (const name of ['edg', 'huawei', 'firefox', 'chrome', 'safari']) {
    if (ua.includes(name)) return name === 'edg' ? 'edge' : name
  }
  return 'other'
}

function headerNoise(userAgent, rng) {
  const base = HEADER_NOISE_BANDS[familyOf(userAgent)] ?? HEADER_NOISE_BANDS.other
  return (base + Math.floor(rng() * 40)) & 0xff
}

function probeNoise(rng) {
  const value = Math.floor(rng() * 240)
  return value > 109 ? value + (value % 2) + 1 : value
}

function tripwireNoise(rng) {
  return (Math.floor(rng() * 255) & TRIPWIRE_FREE) | TRIPWIRE_SET
}

function maskPair(pair, rng, { low, high } = {}) {
  const noise = Math.floor(rng() * 65535)
  const lowByte = (low === undefined ? noise & 0xff : low & 0xff)
  const highByte = (high === undefined ? (noise >> 8) & 0xff : high & 0xff)
  return [
    (lowByte & 0xaa) | (pair[0] & 0x55),
    (lowByte & 0x55) | (pair[0] & 0xaa),
    (highByte & 0xaa) | (pair[1] & 0x55),
    (highByte & 0x55) | (pair[1] & 0xaa),
  ]
}

function unmaskPair(carrier) {
  return [
    (carrier[0] & 0x55) | (carrier[1] & 0xaa),
    (carrier[2] & 0x55) | (carrier[3] & 0xaa),
  ]
}

function expandNoise(body, rng) {
  const out = []
  for (let offset = 0; offset < body.length; offset += 3) {
    const group = body.subarray(offset, offset + 3)
    if (group.length < 3) {
      out.push(group[0])
      if (group.length > 1 && group[1]) out.push(group[1])
      continue
    }
    const noise = Math.floor(rng() * 1000) & 0xff
    for (let i = 0; i < 3; i += 1) out.push((noise & NOISE_MASKS[i]) | (group[i] & DATA_MASKS[i]))
    out.push((group[0] & NOISE_MASKS[0]) | (group[1] & NOISE_MASKS[1]) | (group[2] & NOISE_MASKS[2]))
  }
  return Uint8Array.from(out)
}

function collapseNoise(frame) {
  const out = []
  for (let offset = 0; offset < frame.length; offset += 4) {
    const group = frame.subarray(offset, offset + 4)
    if (group.length < 4) {
      out.push(...group)
      continue
    }
    for (let i = 0; i < 3; i += 1) out.push((group[i] & DATA_MASKS[i]) | (group[3] & NOISE_MASKS[i]))
  }
  return Uint8Array.from(out)
}

/** Computes a_bogus for one browser identity. Cheap, stateless apart from its config. */
export class ABogus {
  constructor(userAgent, { browserInfo = DEFAULT_BROWSER_INFO, pageId = PAGE_ID, aid = AID, rng = Math.random } = {}) {
    this.userAgent = userAgent
    this.browserInfo = browserInfo
    this.pageId = pageId
    this.aid = aid
    this.rng = rng
  }

  fields(query, body, now) {
    const digests = {
      query: digestOf(query),
      body: digestOf(body),
      user_agent: userAgentDigest(this.userAgent),
    }
    const ink = now - 1
    const fortnights = Math.floor((now - FORTNIGHT_EPOCH_MS) / (1000 * 60 * 60 * 24 * 14))
    const infoBytes = jsBytes(this.browserInfo)
    const tailBytes = jsBytes(`${(now + 3) & 0xff},`)

    const fields = {
      L24: 41,
      L26: fortnights,
      L27: CALL_BUCKET,
      L28: 3,
      L35: ENV_FLAGS & 0xff,
      L36: Math.floor(ENV_FLAGS / 256) & 0xff,
      L38: NR_FLAGS & 0xff,
      L39: (NR_FLAGS >> 8) & 0xff,
      L66: TRIPWIRE_LOCKED,
      L79: infoBytes.length & 0xff,
      L80: (infoBytes.length >> 8) & 0xff,
      L84: tailBytes.length & 0xff,
      L85: (tailBytes.length >> 8) & 0xff,
    }
    littleEndianBytes(now, 6).forEach((byte, index) => { fields[`L${29 + index}`] = byte })
    littleEndianBytes(DETECT_FLAGS, 4).forEach((byte, index) => { fields[`L${44 + index}`] = byte })
    NR_TAG.forEach((byte, index) => { fields[`L${40 + index}`] = byte })
    littleEndianBytes(ink, 6).forEach((byte, index) => { fields[`L${60 + index}`] = byte })
    littleEndianBytes(this.pageId, 4).forEach((byte, index) => { fields[`L${67 + index}`] = byte })
    littleEndianBytes(this.aid, 4).forEach((byte, index) => { fields[`L${71 + index}`] = byte })
    for (const [name, chain] of Object.entries(DIGEST_CHAINS)) {
      const written = chainBytes(chain, digests[name])
      chain.slots.forEach((slot, index) => { fields[slot] = written[index] })
    }
    return fields
  }

  /** The `a_bogus` value for one request. `query` excludes `a_bogus` itself. */
  getValue(query, { body = '', contentType = '', nowMs } = {}) {
    const payloadBody = contentType.toLowerCase().includes('multipart/form-data') ? '' : body
    const now = nowMs ?? Date.now()
    if (now < FORTNIGHT_EPOCH_MS) throw new Error(`clock is before the a_bogus epoch: ${now}`)
    const fields = this.fields(query, payloadBody, now)

    const version = [
      ...maskPair(SDK_VERSION.slice(0, 2), this.rng),
      ...maskPair(SDK_VERSION.slice(2), this.rng, { low: probeNoise(this.rng), high: tripwireNoise(this.rng) }),
    ]

    let checksum = 0
    for (const byte of version) checksum ^= byte
    for (const name of FIELD_ORDER) checksum ^= fields[name]

    const bodyBytes = Uint8Array.from([
      ...FIELD_ORDER.map((name) => fields[name]),
      ...jsBytes(this.browserInfo),
      ...jsBytes(`${(now + 3) & 0xff},`),
      checksum,
    ])

    const header = maskPair(HEADER_MAGIC, this.rng, { high: headerNoise(this.userAgent, this.rng) })
    const frame = expandNoise(bodyBytes, this.rng)
    const sealed = rc4(Uint8Array.from([PAYLOAD_KEY]), Uint8Array.from([...version, ...frame]))
    return encodeBase64(Uint8Array.from([...header, ...sealed]), 's4')
  }
}

const DECODE_PROBLEMS = new Set(['alphabet', 'length not a multiple of four', 'payload too short'])

/** Whether `problem` means "not an a_bogus" rather than "unexpected contents". */
export function isDecodeProblem(problem) {
  return DECODE_PROBLEMS.has(problem)
}

/** The first way `value` fails to be a well-formed a_bogus, or null. */
export function structureError(value, alphabet = 's4') {
  const body = value.replace(/=+$/, '')
  if (!body || body.includes('=') || [...body].some((char) => !ALPHABETS[alphabet].includes(char))) return 'alphabet'
  if (value.length % 4) return 'length not a multiple of four'
  const payload = decodeBase64(value, alphabet)
  if (payload.length < 80) return 'payload too short'
  if (unmaskPair(payload.subarray(0, 4)).join() !== HEADER_MAGIC.join()) return 'header magic'
  const plain = rc4(Uint8Array.from([PAYLOAD_KEY]), payload.subarray(4))
  const version = plain.subarray(0, 8)
  const frame = plain.subarray(8)
  if (unmaskPair(version.subarray(0, 4)).join() !== SDK_VERSION.slice(0, 2).join()) return 'sdk version'
  if (unmaskPair(version.subarray(4, 8)).join() !== SDK_VERSION.slice(2).join()) return 'sdk version'
  const unpacked = collapseNoise(frame)
  if (unpacked.length < FIELD_ORDER.length + 1) return 'frame too short'
  const fields = {}
  FIELD_ORDER.forEach((name, index) => { fields[name] = unpacked[index] })
  const infoLength = fields.L79 | (fields.L80 << 8)
  const tailLength = fields.L84 | (fields.L85 << 8)
  const end = FIELD_ORDER.length + infoLength + tailLength
  if (end + 1 > unpacked.length) return 'declared lengths overrun the frame'
  if (unpacked.length - (end + 1) > 2) return 'declared lengths leave a tail'
  let checksum = 0
  for (const byte of version) checksum ^= byte
  for (const name of FIELD_ORDER) checksum ^= fields[name]
  if (unpacked[end] !== checksum) return 'checksum'
  return null
}

/** Take an a_bogus apart. For diagnosis and tests, not for signing. */
export function decode(value, alphabet = 's4') {
  const problem = structureError(value, alphabet)
  if (problem !== null) throw new Error(`not a well-formed a_bogus: ${problem}`)
  const payload = decodeBase64(value, alphabet)
  const plain = rc4(Uint8Array.from([PAYLOAD_KEY]), payload.subarray(4))
  const unpacked = collapseNoise(plain.subarray(8))
  const fields = {}
  FIELD_ORDER.forEach((name, index) => { fields[name] = unpacked[index] })
  const littleEndian = (first, count) => {
    let total = 0
    for (let index = 0; index < count; index += 1) total += fields[`L${first + index}`] * 2 ** (8 * index)
    return total
  }
  const infoLength = fields.L79 | (fields.L80 << 8)
  const tailLength = fields.L84 | (fields.L85 << 8)
  const start = FIELD_ORDER.length
  const decoder = new TextDecoder()
  return {
    headerMagic: unmaskPair(payload.subarray(0, 4)),
    sdkVersion: [...unmaskPair(plain.subarray(0, 4)), ...unmaskPair(plain.subarray(4, 8))],
    nowMs: littleEndian(29, 6),
    inkMs: littleEndian(60, 6),
    pageId: littleEndian(67, 4),
    aid: littleEndian(71, 4),
    envFlags: fields.L35,
    detectFlags: littleEndian(44, 4),
    callBucket: fields.L27,
    tripwire: fields.L66,
    browserInfo: decoder.decode(unpacked.subarray(start, start + infoLength)),
    tail: decoder.decode(unpacked.subarray(start + infoLength, start + infoLength + tailLength)),
    fields,
  }
}
