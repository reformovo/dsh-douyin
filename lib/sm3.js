/**
 * SM3 (GB/T 32905-2016), the hash a_bogus uses.
 *
 * A direct port of the pure-Python reference in dtk (Apache-2.0). Only the
 * 32-bit paths matter here: every message is a query string, a body, or a
 * User-Agent, and none of them is large enough to need streaming.
 */

const IV = [
  0x7380166f, 0x4914b2b9, 0x172442d7, 0xda8a0600,
  0xa96f30bc, 0x163138aa, 0xe38dee4d, 0xb0fb0e4e,
]

const T0 = 0x79cc4519
const T1 = 0x7a879d8a

/** Rotate left, where `bits` is taken modulo 32 like the reference does. */
function rotl(value, bits) {
  const shift = bits & 31
  if (shift === 0) return value >>> 0
  return ((value << shift) | (value >>> (32 - shift))) >>> 0
}

function ff(index, x, y, z) {
  return index < 16 ? (x ^ y ^ z) >>> 0 : ((x & y) | (x & z) | (y & z)) >>> 0
}

function gg(index, x, y, z) {
  return index < 16 ? (x ^ y ^ z) >>> 0 : ((x & y) | (~x & z)) >>> 0
}

function expand(block) {
  const w = new Array(68)
  for (let i = 0; i < 16; i += 1) {
    w[i] = ((block[i * 4] << 24) | (block[i * 4 + 1] << 16) | (block[i * 4 + 2] << 8) | block[i * 4 + 3]) >>> 0
  }
  for (let i = 16; i < 68; i += 1) {
    let x = (w[i - 16] ^ w[i - 9] ^ rotl(w[i - 3], 15)) >>> 0
    x = (x ^ rotl(x, 15) ^ rotl(x, 23)) >>> 0
    w[i] = (x ^ rotl(w[i - 13], 7) ^ w[i - 6]) >>> 0
  }
  const w1 = new Array(64)
  for (let i = 0; i < 64; i += 1) w1[i] = (w[i] ^ w[i + 4]) >>> 0
  return [w, w1]
}

function compress(state, block) {
  const [w, w1] = expand(block)
  let [a, b, c, d, e, f, g, h] = state
  for (let j = 0; j < 64; j += 1) {
    const t = j < 16 ? T0 : T1
    const ss1 = rotl((rotl(a, 12) + e + rotl(t, j)) >>> 0, 7)
    const ss2 = (ss1 ^ rotl(a, 12)) >>> 0
    const tt1 = (ff(j, a, b, c) + d + ss2 + w1[j]) >>> 0
    const tt2 = (gg(j, e, f, g) + h + ss1 + w[j]) >>> 0
    d = c
    c = rotl(b, 9)
    b = a
    a = tt1
    h = g
    g = rotl(f, 19)
    f = e
    e = (tt2 ^ rotl(tt2, 9) ^ rotl(tt2, 17)) >>> 0
  }
  return [
    (state[0] ^ a) >>> 0,
    (state[1] ^ b) >>> 0,
    (state[2] ^ c) >>> 0,
    (state[3] ^ d) >>> 0,
    (state[4] ^ e) >>> 0,
    (state[5] ^ f) >>> 0,
    (state[6] ^ g) >>> 0,
    (state[7] ^ h) >>> 0,
  ]
}

function pad(message) {
  const length = message.length
  const bitLength = BigInt(length) * 8n
  const rest = (length + 1) % 64
  const zeros = rest <= 56 ? 56 - rest : 120 - rest
  const out = new Uint8Array(length + 1 + zeros + 8)
  out.set(message, 0)
  out[length] = 0x80
  for (let i = 0; i < 8; i += 1) {
    out[out.length - 1 - i] = Number((bitLength >> BigInt(8 * i)) & 0xffn)
  }
  return out
}

/** The 32-byte SM3 digest of `message`. */
export function sm3(message) {
  const input = message instanceof Uint8Array ? message : Uint8Array.from(message)
  const padded = pad(input)
  let state = IV.slice()
  for (let offset = 0; offset < padded.length; offset += 64) {
    state = compress(state, padded.subarray(offset, offset + 64))
  }
  const out = new Uint8Array(32)
  for (let i = 0; i < 8; i += 1) {
    out[i * 4] = state[i] >>> 24
    out[i * 4 + 1] = (state[i] >>> 16) & 0xff
    out[i * 4 + 2] = (state[i] >>> 8) & 0xff
    out[i * 4 + 3] = state[i] & 0xff
  }
  return out
}

const encoder = new TextEncoder()

/** UTF-8 bytes, which is how the reference hashes every string input. */
export function utf8(text) {
  return encoder.encode(text)
}
