/**
 * Sign in without copying anything: open a throwaway Chromium window on
 * douyin.com, let the user log in there, and read the cookies out of that
 * browser over the DevTools protocol.
 *
 * The window uses its own temporary profile, so the user's real browser is
 * untouched, and the profile is deleted when the attempt ends. No OS permission
 * is involved: the browser belongs to this process, and `Storage.getCookies`
 * reports HttpOnly cookies too.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'

/** Chromium-based browsers that can host the sign-in window, in preference order. */
const BROWSERS = [
  ['Google Chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
  ['Microsoft Edge', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
  ['Brave', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'],
  ['Chromium', '/Applications/Chromium.app/Contents/MacOS/Chromium'],
  ['Google Chrome', '/usr/bin/google-chrome'],
  ['Chromium', '/usr/bin/chromium'],
  ['Google Chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'],
  ['Google Chrome', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'],
]

/** How long a sign-in window may stay open before it is closed for the user. */
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000
/** How often the window's cookie jar is asked for the session cookie. */
const POLL_INTERVAL_MS = 1500

function findBrowser() {
  for (const [name, path] of BROWSERS) {
    if (existsSync(path)) return { name, path }
  }
  return null
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

/** Minimal DevTools client: request/response over the browser-level socket. */
class DevTools {
  #socket
  #pending = new Map()
  #nextId = 0

  static async connect(port, timeoutMs = 10_000) {
    const deadline = Date.now() + timeoutMs
    let version
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`)
        if (response.ok) {
          version = await response.json()
          break
        }
      } catch {
        // The port is not listening yet.
      }
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    if (!version?.webSocketDebuggerUrl) throw new Error('browser did not expose a DevTools endpoint')
    const client = new DevTools(version.webSocketDebuggerUrl)
    await client.#open()
    return client
  }

  constructor(url) {
    this.#socket = new WebSocket(url)
  }

  #open() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('DevTools socket did not open')), 8000)
      this.#socket.addEventListener('open', () => {
        clearTimeout(timer)
        resolve()
      }, { once: true })
      this.#socket.addEventListener('error', () => {
        clearTimeout(timer)
        reject(new Error('DevTools socket failed'))
      }, { once: true })
      this.#socket.addEventListener('message', (event) => {
        let message
        try {
          message = JSON.parse(typeof event.data === 'string' ? event.data : '')
        } catch {
          return
        }
        const waiter = message.id ? this.#pending.get(message.id) : undefined
        if (!waiter) return
        this.#pending.delete(message.id)
        waiter(message)
      })
    })
  }

  send(method, params = {}, timeoutMs = 6000) {
    return new Promise((resolve) => {
      const id = ++this.#nextId
      this.#pending.set(id, resolve)
      try {
        this.#socket.send(JSON.stringify({ id, method, params }))
      } catch {
        this.#pending.delete(id)
        resolve({})
      }
      setTimeout(() => {
        if (this.#pending.delete(id)) resolve({})
      }, timeoutMs)
    })
  }

  close() {
    try {
      this.#socket.close()
    } catch {
      // Already closed.
    }
  }
}

function cookieString(cookies) {
  return cookies
    .filter((cookie) => (cookie.domain ?? '').replace(/^\./, '').endsWith('douyin.com'))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ')
}

/**
 * One sign-in attempt at a time. `start()` opens the window; `status()` reports
 * progress and hands over the cookie jar once Douyin has issued a session.
 */
export class BrowserLogin {
  #logger
  #state = 'idle'
  #error = null
  #cookies = null
  #browser = null
  #child = null
  #profile = null
  #devtools = null
  #timer = null
  #deadline = 0
  #disposed = false

  constructor({ logger } = {}) {
    this.#logger = logger ?? { warn() {} }
  }

  get state() {
    return this.#state
  }

  /** Open a sign-in window. Resolves once the browser is up, not once it is used. */
  async start() {
    if (this.#state === 'waiting') return
    const browser = findBrowser()
    if (!browser) {
      const error = new Error('no-supported-browser')
      error.code = 'no-browser'
      throw error
    }
    this.#reset()
    this.#browser = browser
    this.#state = 'waiting'
    this.#deadline = Date.now() + LOGIN_TIMEOUT_MS
    this.#profile = await mkdtemp(join(tmpdir(), 'dsh-douyin-'))
    const port = await freePort()
    this.#child = spawn(browser.path, [
      `--user-data-dir=${this.#profile}`,
      `--remote-debugging-port=${port}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-features=Translate,MediaRouter',
      '--window-size=980,760',
      'https://www.douyin.com/',
    ], { stdio: 'ignore' })
    this.#child.on('exit', () => {
      if (this.#state === 'waiting') {
        this.#state = 'closed'
        this.#cleanup()
      }
    })
    try {
      this.#devtools = await DevTools.connect(port)
    } catch (error) {
      this.#state = 'error'
      this.#error = error?.message ?? String(error)
      await this.#cleanup()
      throw error
    }
    this.#poll()
  }

  /** Current attempt, plus the jar once it is complete. */
  status() {
    return { state: this.#state, cookies: this.#state === 'done' ? this.#cookies : null, error: this.#error, browser: this.#browser?.name ?? null }
  }

  /** Take the completed jar out of the attempt and return to idle. */
  take() {
    const cookies = this.#cookies
    this.#reset()
    return cookies
  }

  async cancel() {
    if (this.#state === 'waiting') this.#state = 'cancelled'
    await this.#cleanup()
  }

  async dispose() {
    this.#disposed = true
    await this.#cleanup()
  }

  #reset() {
    this.#state = 'idle'
    this.#error = null
    this.#cookies = null
  }

  #poll() {
    this.#timer = setTimeout(async () => {
      if (this.#state !== 'waiting' || this.#disposed) return
      if (Date.now() > this.#deadline) {
        this.#state = 'timeout'
        await this.#cleanup()
        return
      }
      try {
        const response = await this.#devtools.send('Storage.getCookies')
        const cookies = response?.result?.cookies ?? []
        const jar = cookieString(cookies)
        if (/(^|;\s*)sessionid=/.test(jar)) {
          this.#cookies = jar
          this.#state = 'done'
          await this.#cleanup()
          return
        }
      } catch (error) {
        this.#logger.warn?.(`[douyin] sign-in poll failed: ${error?.message ?? error}`)
      }
      this.#poll()
    }, POLL_INTERVAL_MS)
  }

  async #cleanup() {
    if (this.#timer) {
      clearTimeout(this.#timer)
      this.#timer = null
    }
    this.#devtools?.close()
    this.#devtools = null
    if (this.#child && this.#child.exitCode === null) {
      try {
        this.#child.kill('SIGTERM')
      } catch {
        // Already gone.
      }
    }
    this.#child = null
    const profile = this.#profile
    this.#profile = null
    if (profile) {
      await new Promise((resolve) => setTimeout(resolve, 400))
      await rm(profile, { recursive: true, force: true }).catch(() => {})
    }
  }
}
