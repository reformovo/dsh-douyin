/**
 * dsh-douyin — Client half.
 *
 * Registers one right-Sidebar tab type (`kind: 'douyin'`) that scrolls the home
 * feed one video at a time, a footer button that opens it, and an ambient card
 * in the composer dock that offers it while the agent runs. All network work
 * lives in the Host; this module only calls `/api/douyin`.
 */
window.__ModuleLoader__.load({
  id: 'dsh-douyin',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const API = '/api/douyin'
    const TAB_ID = 'dsh-douyin'
    const KIND = 'douyin'
    const NS = 'douyin'
    const MUTED_KEY = 'dsh.douyin.muted'

    const zh = {
      'tab.title': '摸鱼抖音',
      'button.label': '抖音',
      'button.tooltip': '打开摸鱼抖音',
      'guide.title': '摸鱼抖音',
      'guide.description': '右侧边栏一直往下刷抖音，Agent 干活时陪你一起等',
      'prompt.title': 'Agent 干活中，刷会儿抖音？',
      'prompt.action': '打开',
      'prompt.dismiss': '不用了',
      'feed.loading': '正在加载推荐…',
      'feed.loadingMore': '正在加载下一条…',
      'feed.exhausted': '暂时没有更多了',
      'feed.reload': '重新加载',
      'feed.error': '加载失败：{message}',
      'feed.retry': '重试',
      'feed.mute': '静音',
      'feed.unmute': '取消静音',
      'feed.refresh': '换一批',
      'feed.seek': '拖动进度',
      'feed.play': '播放',
      'feed.pause': '暂停',
      'feed.next': '下一条',
      'feed.prev': '上一条',
      'feed.finished': '任务完成了，先暂停一下。看完结果再刷。',
      'feed.unavailable': '这条暂时播不了，往下滑换一条',
      'feed.likes': '{count} 赞',
      'feed.comments': '{count} 评论',
      'feed.share': '{count} 分享',
      'account.login': '登录',
      'account.title': '抖音账号',
      'account.intro': '绑定浏览器里的抖音登录 Cookie 之后，推荐会按你自己的账号来，而不是匿名访客的那一套。',
      'account.steps': '① 浏览器打开 douyin.com 并登录；② 按 F12 → Network，刷新页面；③ 点最上面那条 douyin.com 的请求，找到 Request Headers 里的 Cookie，整行复制（不是单个 cookie）；④ 粘贴到下面。',
      'account.placeholder': '粘贴整条 Cookie（含 sessionid=…）',
      'account.bind': '绑定',
      'account.unbind': '解绑',
      'account.close': '关闭',
      'account.busy': '正在验证…',
      'account.invalid': '这个 Cookie 没有登录态，或者已经失效了。',
      'account.failed': '绑定失败：{message}',
      'account.current': '当前账号',
      'account.anonymous': '未登录，推荐来自匿名访客',
      'account.bound': '推荐按你账号的喜好来',
      'account.expired': '这个登录已经失效了，推荐已经退回匿名；解绑后重新登录一次即可。',
      'account.auto': '扫码登录',
      'account.autoHint': '会在一个独立窗口打开抖音，用抖音 App 扫码登录；完成后自动读取登录态，不用复制 Cookie。',
      'account.waiting': '登录窗口已打开：在窗口里点「登录」并扫码，完成后这里会自动继续。',
      'account.cancelLogin': '取消',
      'account.manual': '手动粘贴',
      'account.manualHint': '从 DevTools 的请求头里复制整行 Cookie。',
      'account.noBrowser': '没找到 Chrome / Edge，只能手动粘贴。',
      'account.timeout': '等了 5 分钟还没登录，窗口已关闭。再试一次，或手动粘贴。',
      'account.closed': '登录窗口被关掉了。再试一次，或手动粘贴。',
    }

    const en = {
      'tab.title': 'Douyin Break',
      'button.label': 'Douyin',
      'button.tooltip': 'Open Douyin Break',
      'guide.title': 'Douyin Break',
      'guide.description': 'Keep scrolling Douyin in the right Sidebar while the agent works',
      'prompt.title': 'Agent working — scroll Douyin?',
      'prompt.action': 'Open',
      'prompt.dismiss': 'Not now',
      'feed.loading': 'Loading recommendations…',
      'feed.loadingMore': 'Loading the next one…',
      'feed.exhausted': 'Nothing more for now',
      'feed.reload': 'Reload',
      'feed.error': 'Could not load: {message}',
      'feed.retry': 'Retry',
      'feed.mute': 'Mute',
      'feed.unmute': 'Unmute',
      'feed.refresh': 'New batch',
      'feed.seek': 'Seek',
      'feed.play': 'Play',
      'feed.pause': 'Pause',
      'feed.next': 'Next',
      'feed.prev': 'Previous',
      'feed.finished': 'Task finished — paused for you. Resume when ready.',
      'feed.unavailable': 'This one will not play — scroll on',
      'feed.likes': '{count} likes',
      'feed.comments': '{count} comments',
      'feed.share': '{count} shares',
      'account.login': 'Sign in',
      'account.title': 'Douyin account',
      'account.intro': 'Bind the Douyin cookie from your browser and the feed follows your own account instead of an anonymous guest.',
      'account.steps': '1) Open douyin.com and sign in; 2) press F12, open Network, reload; 3) pick the first douyin.com request and copy the whole Cookie line from Request Headers; 4) paste it below.',
      'account.placeholder': 'Paste the whole cookie line (contains sessionid=…)',
      'account.bind': 'Bind',
      'account.unbind': 'Unbind',
      'account.close': 'Close',
      'account.busy': 'Checking…',
      'account.invalid': 'That cookie carries no session, or it has expired.',
      'account.failed': 'Binding failed: {message}',
      'account.current': 'Signed in as',
      'account.anonymous': 'Not signed in — anonymous recommendations',
      'account.bound': 'Recommendations follow your account',
      'account.expired': 'This session has expired, so the feed fell back to anonymous. Sign in again.',
      'account.auto': 'Scan QR code',
      'account.autoHint': 'Opens Douyin in its own window; scan the QR with the Douyin app and this finishes by itself — no cookie to copy.',
      'account.waiting': 'The window is open: click 登录 there and scan the QR. This continues automatically.',
      'account.cancelLogin': 'Cancel',
      'account.manual': 'Paste instead',
      'account.manualHint': 'Copy the whole Cookie line from a DevTools request header.',
      'account.noBrowser': 'No Chrome or Edge found, so paste a cookie instead.',
      'account.timeout': 'No sign-in after five minutes, so the window was closed. Try again or paste a cookie.',
      'account.closed': 'The sign-in window was closed. Try again or paste a cookie.',
    }

    /** The Client locale service, captured at apply time. */
    const localeRef = { current: undefined }

    const translate = (key) => {
      const locale = localeRef.current
      if (locale && typeof locale.bind === 'function' && !translate.bound) translate.bound = locale.bind(NS)
      const text = translate.bound ? translate.bound(key) : undefined
      return text ?? zh[key] ?? key
    }

    function useLocaleRevision() {
      const [revision, bump] = React.useState(0)
      React.useEffect(() => {
        const locale = localeRef.current
        if (!locale || typeof locale.subscribe !== 'function') return undefined
        return locale.subscribe(() => bump((value) => value + 1))
      }, [])
      return revision
    }

    function useTranslate() {
      useLocaleRevision()
      return translate
    }

    const pluginCtx = { current: undefined }
    /** Host settings, read once at apply; the dock card honours `autoPrompt`. */
    const pluginConfig = { current: { autoPrompt: true } }
    /**
     * How far the feed has come. It lives outside the component so closing and
     * reopening the tab continues the stream instead of replaying the batch it
     * showed last time.
     */
    let streamCursor = 1
    /**
     * Live players, so the dock can pause the feed when a run finishes. The dock
     * is always mounted and sees the session status reliably; the tab body is a
     * pane and does not always get status updates, so it registers here instead
     * of watching the status on its own.
     */
    const feedPlayers = new Set()

    /** A compact note-shaped mark, drawn inline so no asset has to load. */
    function Mark({ size = 16 }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
        h('path', {
          d: 'M14.5 3v9.2a3.6 3.6 0 1 1-3.1-3.57V6.1a6.1 6.1 0 1 0 5.6 6.08V8.9c1.1.86 2.44 1.36 3.9 1.4V7.5a3.9 3.9 0 0 1-3.9-3.9h-2.5Z',
          fill: 'currentColor',
        }),
      )
    }

    /** A chevron, used by the previous/next controls. */
    function Chevron({ up = false, size = 16 }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
        h('path', {
          d: up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6',
          stroke: 'currentColor',
          strokeWidth: 2.2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    /** A speaker with waves when audible, a slash when muted. */
    function Speaker({ muted = false, size = 16 }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
        h('path', { d: 'M4 9.5h3.2L12 5.5v13L7.2 14.5H4v-5Z', fill: 'currentColor' }),
        muted
          ? h('path', { d: 'M16 9l5 6M21 9l-5 6', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' })
          : h('path', {
            d: 'M15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12',
            stroke: 'currentColor',
            strokeWidth: 1.9,
            strokeLinecap: 'round',
          }),
      )
    }

    /** A circular arrow, for the manual refresh control. */
    function Refresh({ size = 16 }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
        h('path', {
          d: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.6v5.2h-5.2',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    /** A play triangle or a pause pair, for the transport controls. */
    function Transport({ playing = false, size = 16 }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
        playing
          ? h('path', { d: 'M8 5.5v13M16 5.5v13', stroke: 'currentColor', strokeWidth: 2.6, strokeLinecap: 'round' })
          : h('path', { d: 'M8.5 5.4v13.2L19 12 8.5 5.4Z', fill: 'currentColor' }),
      )
    }

    function formatCount(value) {
      const count = Number(value) || 0
      if (count >= 100_000_000) return `${(count / 100_000_000).toFixed(1)}亿`
      if (count >= 10_000) return `${(count / 10_000).toFixed(1)}万`
      return String(count)
    }

    function formatTime(ms) {
      const total = Math.max(0, Math.round((Number(ms) || 0) / 1000))
      const minutes = Math.floor(total / 60)
      const seconds = total % 60
      return `${minutes}:${String(seconds).padStart(2, '0')}`
    }

    /** Open the feed tab. */
    function openFeed(ctx) {
      const sidebar = ctx?.get('sidebarRight')
      try {
        sidebar?.openTab(KIND)
      } catch (error) {
        console.error('[douyin] failed to open the tab', error?.message ?? String(error))
      }
    }

    const CSS = `
.dy-root{position:relative;display:flex;flex-direction:column;height:100%;min-height:0;background:#000;color:#fff;overflow:hidden;font-size:13px;}
.dy-stage{position:relative;flex:1;min-height:0;background:#000;overflow:hidden;touch-action:pan-x;}
.dy-track{position:absolute;inset:0;overflow:hidden;}
.dy-slide{position:absolute;inset:0;background:#000;transform:translateY(0);transition:transform .34s cubic-bezier(.22,.61,.36,1);will-change:transform;}
.dy-video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;}
.dy-shade{position:absolute;inset:0;pointer-events:none;background:linear-gradient(to top,rgba(0,0,0,.78) 0,rgba(0,0,0,.25) 26%,rgba(0,0,0,0) 48%),linear-gradient(to bottom,rgba(0,0,0,.5) 0,rgba(0,0,0,0) 18%);}
.dy-head{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;gap:8px;padding:10px 12px;z-index:3;}
.dy-head .dy-brand{display:flex;align-items:center;gap:6px;font-weight:600;font-size:13px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.6);}
.dy-head .dy-spacer{flex:1;}
.dy-ghost{appearance:none;border:0;background:rgba(0,0,0,.38);color:#fff;border-radius:999px;padding:6px 10px;font:inherit;font-size:12px;line-height:1;cursor:pointer;backdrop-filter:blur(6px);}
.dy-ghost:hover{background:rgba(0,0,0,.56);}
.dy-ghost[disabled]{opacity:.45;cursor:default;}
.dy-ghost:focus-visible{outline:2px solid #fff;outline-offset:1px;}
.dy-refresh{appearance:none;border:0;width:26px;height:26px;border-radius:999px;background:rgba(0,0,0,.42);color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;backdrop-filter:blur(6px);}
.dy-refresh:hover{background:rgba(0,0,0,.62);}
.dy-refresh:active svg{transform:rotate(-70deg);}
.dy-refresh:focus-visible{outline:2px solid #fff;outline-offset:1px;}
.dy-refresh svg{transition:transform .18s ease;}
.dy-account{appearance:none;border:0;padding:0;height:26px;min-width:26px;border-radius:999px;background:rgba(0,0,0,.42);color:#fff;display:inline-flex;align-items:center;justify-content:center;font:inherit;font-size:11px;line-height:1;cursor:pointer;overflow:hidden;backdrop-filter:blur(6px);}
.dy-account:hover{background:rgba(0,0,0,.62);}
.dy-account:focus-visible{outline:2px solid #fff;outline-offset:1px;}
.dy-account img{width:26px;height:26px;object-fit:cover;display:block;}
.dy-account span{padding:0 9px;white-space:nowrap;}
.dy-rail{position:absolute;right:10px;bottom:96px;display:flex;flex-direction:column;gap:10px;z-index:3;}
.dy-rail button{appearance:none;border:0;width:38px;height:38px;border-radius:999px;background:rgba(0,0,0,.42);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;backdrop-filter:blur(6px);}
.dy-rail button:hover{background:rgba(0,0,0,.6);}
.dy-rail button[disabled]{opacity:.35;cursor:default;}
.dy-rail button:focus-visible{outline:2px solid #fff;outline-offset:1px;}
.dy-meta{position:absolute;left:12px;right:58px;bottom:34px;z-index:3;display:flex;flex-direction:column;gap:6px;text-shadow:0 1px 3px rgba(0,0,0,.7);}
.dy-author{display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px;}
.dy-avatar{width:26px;height:26px;border-radius:999px;object-fit:cover;border:1px solid rgba(255,255,255,.5);background:#222;}
.dy-desc{font-size:13px;line-height:1.45;max-height:5.8em;overflow:hidden;white-space:pre-wrap;word-break:break-word;opacity:.95;}
.dy-stats{display:flex;gap:12px;font-size:12px;opacity:.82;}
.dy-progress{position:absolute;left:0;right:0;bottom:0;height:16px;z-index:5;cursor:pointer;touch-action:none;}
.dy-progress::before{content:'';position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.22);transition:height .12s;}
.dy-progress > i{position:absolute;left:0;bottom:0;height:3px;width:0;background:#fff;transition:height .12s;}
.dy-progress > b{position:absolute;bottom:-2px;width:9px;height:9px;margin-left:-4.5px;border-radius:999px;background:#fff;opacity:0;transition:opacity .12s;pointer-events:none;}
.dy-progress:hover::before,.dy-progress.scrubbing::before{height:5px;}
.dy-progress:hover > i,.dy-progress.scrubbing > i{height:5px;}
.dy-progress:hover > b,.dy-progress.scrubbing > b{opacity:1;}
.dy-time{position:absolute;right:10px;bottom:18px;font-size:11px;color:rgba(255,255,255,.75);z-index:4;font-variant-numeric:tabular-nums;}
.dy-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px;text-align:center;z-index:5;color:rgba(255,255,255,.86);font-size:13px;line-height:1.5;}
.dy-center .dy-spin{width:22px;height:22px;border-radius:999px;border:2px solid rgba(255,255,255,.25);border-top-color:#fff;animation:dy-spin .8s linear infinite;}
@keyframes dy-spin{to{transform:rotate(360deg)}}
.dy-note{position:absolute;left:12px;right:12px;top:52px;z-index:4;display:flex;align-items:center;gap:10px;background:rgba(0,0,0,.62);border-radius:10px;padding:9px 10px;backdrop-filter:blur(8px);font-size:12px;line-height:1.4;}
.dy-note .dy-note-text{flex:1;min-width:0;}
.dy-sheet{position:absolute;inset:0;z-index:9;background:rgba(0,0,0,.58);display:flex;align-items:flex-end;padding:12px;box-sizing:border-box;}
.dy-sheet-card{width:100%;box-sizing:border-box;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px;box-shadow:0 12px 32px rgba(0,0,0,.45);max-height:100%;overflow:auto;}
.dy-sheet-title{font-weight:600;font-size:14px;}
.dy-sheet-text{font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary);}
.dy-sheet textarea{width:100%;box-sizing:border-box;min-height:92px;resize:vertical;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:1.45;padding:8px 10px;}
.dy-sheet textarea:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}
.dy-sheet-actions{display:flex;gap:8px;justify-content:flex-end;}
.dy-sheet-actions button{appearance:none;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;font:inherit;font-size:12px;padding:7px 11px;cursor:pointer;white-space:nowrap;}
.dy-sheet-actions button.primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-base);border-color:transparent;font-weight:600;}
.dy-sheet-actions button[disabled]{opacity:.5;cursor:default;}
.dy-sheet-actions button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}
.dy-error-text{color:#ff6b6b;font-size:12px;line-height:1.45;}
.dy-probe{position:absolute;left:8px;top:42px;z-index:9;max-width:calc(100% - 16px);padding:4px 6px;border-radius:6px;background:rgba(0,0,0,.72);color:#8ef;font:10px/1.4 ui-monospace,Menlo,monospace;pointer-events:none;word-break:break-all;}
.dy-login-wait{display:flex;align-items:center;gap:10px;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);}
.dy-login-wait .dy-spin{width:16px;height:16px;border-radius:999px;border:2px solid var(--dsw-alias-border-l1);border-top-color:var(--dsw-alias-label-primary);animation:dy-spin .8s linear infinite;flex:none;}
.dy-who{display:flex;align-items:center;gap:8px;font-size:13px;}
.dy-who img{width:30px;height:30px;border-radius:999px;object-fit:cover;background:var(--dsw-alias-bg-layer-2);}
.dy-empty{display:flex;flex-direction:column;align-items:center;gap:10px;}
.dy-foot-action{appearance:none;border:0;background:none;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;cursor:pointer;font:inherit;font-size:13px;width:100%;}
.dy-foot-action:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
.dy-foot-action:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}
.dy-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.dy-prompt{display:flex;align-items:center;gap:6px;justify-content:center;margin:0 auto 6px;padding:4px 6px 4px 10px;width:fit-content;max-width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);font-size:12px;color:var(--dsw-alias-label-primary);line-height:1.35;}
.dy-prompt-title{font-weight:500;white-space:nowrap;font-size:12px;}
.dy-prompt-open{appearance:none;border:0;background:none;color:var(--dsw-alias-label-primary);width:24px;height:24px;padding:0;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none;}
.dy-prompt-open:hover{background:var(--dsw-alias-bg-layer-2);}
.dy-prompt-open:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}
.dy-prompt-dismiss{appearance:none;border:0;background:none;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:14px;line-height:1;padding:2px 4px;border-radius:4px;}
.dy-prompt-dismiss:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);}
.dy-prompt-dismiss:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}
.dy-bigplay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:3;pointer-events:none;}
.dy-bigplay span{width:62px;height:62px;border-radius:999px;background:rgba(0,0,0,.42);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;color:#fff;}
.dy-meta{pointer-events:none;}
`

    /** The vertical feed. One video is on stage; the rest wait behind it. */
    function PlayerBody(props) {
      const t = useTranslate()
      const { useSessionStatus, sessionId } = props ?? {}
      const status = useSessionStatus ? useSessionStatus((snapshot) => (sessionId ? snapshot.get(sessionId) : undefined)) : undefined
      const running = status?.running === true

      const [items, setItems] = React.useState([])
      const [index, setIndex] = React.useState(0)
      const [loading, setLoading] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [exhausted, setExhausted] = React.useState(false)
      const [muted, setMuted] = React.useState(() => {
        try {
          return localStorage.getItem(MUTED_KEY) !== '0'
        } catch {
          return true
        }
      })
      const [progress, setProgress] = React.useState(0)
      const [playing, setPlaying] = React.useState(false)
      const [scrubbing, setScrubbing] = React.useState(false)
      const [probe, setProbe] = React.useState(null)
      const probeTimerRef = React.useRef(null)
      const [notice, setNotice] = React.useState(null)
      const [brokenIds, setBrokenIds] = React.useState(() => new Set())
      const [account, setAccount] = React.useState({ bound: false, profile: null })
      const [sheet, setSheet] = React.useState(false)
      const [cookieText, setCookieText] = React.useState('')
      const [authBusy, setAuthBusy] = React.useState(false)
      const [authError, setAuthError] = React.useState(null)
      const [authExpired, setAuthExpired] = React.useState(false)
      const [loginState, setLoginState] = React.useState('idle')
      const [pasteMode, setPasteMode] = React.useState(false)

      const cursorRef = React.useRef(streamCursor)
      const loadingRef = React.useRef(false)
      const itemsRef = React.useRef([])
      const generationRef = React.useRef(0)
      const prefetchBudgetRef = React.useRef(0)
      const lastIndexRef = React.useRef(0)
      const videoRef = React.useRef(null)
      const stageRef = React.useRef(null)
      const wheelRef = React.useRef({ at: 0 })
      const touchRef = React.useRef(null)
      const suppressClickRef = React.useRef(false)
      const wasRunning = React.useRef(running)

      const item = items[index] ?? null

      const load = React.useCallback(async () => {
        if (loadingRef.current) return
        loadingRef.current = true
        const generation = generationRef.current
        setLoading(true)
        try {
          const response = await fetch(`${API}/feed?cursor=${cursorRef.current}`)
          const body = await response.json()
          if (generation !== generationRef.current) return
          if (!body?.ok) throw new Error(body?.error ?? `HTTP ${response.status}`)
          cursorRef.current = body.nextCursor ?? cursorRef.current + 1
          streamCursor = cursorRef.current
          const have = new Set(itemsRef.current.map((entry) => entry.id))
          const fresh = (body.items ?? []).filter((entry) => entry?.play && !have.has(entry.id))
          if (!fresh.length) {
            setExhausted(true)
          } else {
            setExhausted(false)
            itemsRef.current = [...itemsRef.current, ...fresh]
            setItems(itemsRef.current)
          }
          setError(null)
        } catch (caught) {
          if (generation === generationRef.current) setError(caught?.message ?? String(caught))
        } finally {
          loadingRef.current = false
          setLoading(false)
          // A restart that landed mid-flight discarded this request's result;
          // now that the lock is free, ask again for the new generation.
          if (generation !== generationRef.current) load()
        }
      }, [])

      // First page, once.
      React.useEffect(() => {
        load()
      }, [load])

      // Who is bound, so the badge is right before the first scroll.
      React.useEffect(() => {
        fetch(`${API}/session`)
          .then((response) => response.json())
          .then((body) => {
            if (body?.ok) setAccount({ bound: Boolean(body.bound), profile: body.profile ?? null })
          })
          .catch(() => {})
      }, [])

      // Keep the runway topped up: with three or fewer videos left, the next
      // batch is already on its way, so the end of a batch is never visible.
      // Two loads per step is the cap, so a feed that returns one item at a time
      // cannot spin requests without the viewer moving.
      React.useEffect(() => {
        if (index !== lastIndexRef.current) {
          lastIndexRef.current = index
          prefetchBudgetRef.current = 0
        }
        if (exhausted || !items.length) return
        if (items.length - index > 3) return
        if (prefetchBudgetRef.current >= 2) return
        prefetchBudgetRef.current += 1
        load()
      }, [index, items.length, exhausted, load])

      // Pause and explain, either from this pane's own status or from the dock.
      const pauseForFinish = React.useCallback(() => {
        videoRef.current?.pause()
        setNotice('finished')
      }, [])

      React.useEffect(() => {
        const control = {
          pause: () => pauseForFinish(),
          wake: () => setNotice(null),
        }
        feedPlayers.add(control)
        return () => {
          feedPlayers.delete(control)
        }
      }, [pauseForFinish])

      // A task that just finished pauses the feed and says why.
      React.useEffect(() => {
        if (wasRunning.current && !running) pauseForFinish()
        wasRunning.current = running
      }, [running, pauseForFinish])

      // The slide on stage owns playback; its neighbours are already buffered and
      // wait paused, so a switch is only a transform, never a fresh load.
      const findActiveVideo = React.useCallback(
        () => stageRef.current?.querySelector('.dy-slide[data-active="true"] video') ?? null,
        [],
      )

      React.useEffect(() => {
        const video = findActiveVideo()
        videoRef.current = video
        for (const element of stageRef.current?.querySelectorAll('video') ?? []) {
          if (element !== video) element.pause()
        }
        if (video) video.play().catch(() => {})
        setProgress(0)
      }, [item?.id, findActiveVideo])

      React.useEffect(() => {
        for (const element of stageRef.current?.querySelectorAll('video') ?? []) element.muted = muted
        try {
          localStorage.setItem(MUTED_KEY, muted ? '1' : '0')
        } catch {
          // A blocked storage does not break playback.
        }
      }, [muted])

      const canPrev = index > 0
      // The slot past the last video is the loading tile, so swiping forward
      // always has somewhere to go.
      const canNext = index < items.length || (!exhausted && !error)

      const go = React.useCallback((delta) => {
        setNotice(null)
        setIndex((current) => {
          const max = itemsRef.current.length
          const next = current + delta
          if (next < 0) return 0
          if (next > max) return max
          return next
        })
      }, [])

      const togglePlay = React.useCallback(() => {
        const video = videoRef.current
        if (!video) return
        if (video.paused) video.play().catch(() => {})
        else video.pause()
      }, [])

      // Wheel, keyboard and touch all move one video at a time.
      React.useEffect(() => {
        const stage = stageRef.current
        if (!stage) return undefined
        const onWheel = (event) => {
          const now = Date.now()
          if (now - wheelRef.current.at < 420) return
          const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : 0
          if (Math.abs(delta) < 6) return
          wheelRef.current.at = now
          go(delta > 0 ? 1 : -1)
        }
        stage.addEventListener('wheel', onWheel, { passive: true })
        return () => stage.removeEventListener('wheel', onWheel)
      }, [go])

      React.useEffect(() => {
        const onKey = (event) => {
          const target = event.target
          if (target && typeof target.tagName === 'string' && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
          if (target?.isContentEditable) return
          if (event.key === 'ArrowDown' || event.key === 'j' || event.key === 'PageDown') {
            event.preventDefault()
            go(1)
          } else if (event.key === 'ArrowUp' || event.key === 'k' || event.key === 'PageUp') {
            event.preventDefault()
            go(-1)
          } else if (event.key === 'm') {
            setMuted((value) => !value)
          } else if (event.key === ' ' || event.key === 'Spacebar') {
            event.preventDefault()
            togglePlay()
          }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [go, togglePlay])

      const onTouchStart = (event) => {
        touchRef.current = event.touches?.[0]?.clientY ?? null
      }
      const onTouchEnd = (event) => {
        const start = touchRef.current
        const end = event.changedTouches?.[0]?.clientY ?? null
        touchRef.current = null
        if (start === null || end === null) return
        const delta = start - end
        if (Math.abs(delta) < 42) return
        // The browser reports a click after the swipe; that one must not toggle.
        suppressClickRef.current = true
        setTimeout(() => { suppressClickRef.current = false }, 500)
        go(delta > 0 ? 1 : -1)
      }

      const onStageClick = () => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false
          return
        }
        togglePlay()
      }

      /** TEMPORARY: sample the media element so the drag failure can be seen on screen. */
      const sampleProbe = React.useCallback(() => {
        const stage = stageRef.current
        const video = stage?.querySelector('.dy-slide[data-active="true"] video') ?? null
        setProbe((previous) => ({
          ...(previous ?? {}),
          target: scrubRef.current.target,
          ct: video ? video.currentTime : -1,
          dur: video ? video.duration : -1,
          ranges: video && video.seekable.length
            ? `${video.seekable.start(0).toFixed(1)}-${video.seekable.end(video.seekable.length - 1).toFixed(1)}`
            : 'none',
          buffered: video && video.buffered.length
            ? `${video.buffered.start(0).toFixed(1)}-${video.buffered.end(video.buffered.length - 1).toFixed(1)}`
            : 'none',
          paused: video ? video.paused : null,
          seeking: video ? video.seeking : null,
          ready: video ? video.readyState : null,
          network: video ? video.networkState : null,
          src: video && video.currentSrc ? video.currentSrc.slice(-46) : 'none',
          serviceWorker: navigator.serviceWorker?.controller ? 'yes' : 'no',
          videos: stage ? stage.querySelectorAll('video').length : 0,
          active: stage ? stage.querySelectorAll('.dy-slide[data-active="true"]').length : 0,
          uids: stage
            ? [...stage.querySelectorAll('video')].map((element) => `${element.dataset.uid ?? '?'}${element.closest('.dy-slide')?.getAttribute('data-active') === 'true' ? '*' : ''}`).join(',')
            : '-',
        }))
      }, [])

      const sampleWire = React.useCallback(() => {
        fetch(`${API}/_wire`)
          .then((response) => response.json())
          .then((body) => {
            const last = body?.wire?.[body.wire.length - 1]
            if (last) setProbe((current) => (current ? { ...current, wire: last } : current))
          })
          .catch(() => {})
      }, [])

      const startProbe = React.useCallback(() => {
        sampleProbe()
        sampleWire()
        clearInterval(probeTimerRef.current)
        probeTimerRef.current = setInterval(sampleProbe, 300)
        setTimeout(() => {
          clearInterval(probeTimerRef.current)
          probeTimerRef.current = null
          sampleProbe()
        }, 8000)
      }, [sampleProbe])

      const barRef = React.useRef(null)
      const scrubRef = React.useRef({ dragging: false, resume: false, target: null })

      // The bar drives seeking with native pointer events on `window`: a drag
      // that leaves the 16px bar keeps tracking, and no synthetic handler can
      // swallow the move. The video is looked up from the DOM each time, so a
      // slide swap can never leave this pointing at the wrong element.
      React.useEffect(() => {
        const bar = barRef.current
        if (!bar) return undefined
        const currentVideo = () => stageRef.current?.querySelector('.dy-slide[data-active="true"] video') ?? null
        const ratioOf = (event) => {
          const rect = bar.getBoundingClientRect()
          if (!rect.width) return 0
          return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
        }
        const apply = (ratio) => {
          const video = currentVideo()
          if (!video) return
          const duration = Number.isFinite(video.duration) && video.duration > 0
            ? video.duration
            : (video.seekable.length ? video.seekable.end(video.seekable.length - 1) : 0)
          if (!duration) return
          // Never land exactly on the end: with `loop` that wraps straight to 0.
          const target = Math.min(ratio * duration, Math.max(0, duration - 0.25))
          video.currentTime = target
          scrubRef.current.target = target
          setProgress(target / duration)
        }
        const onMove = (event) => {
          if (!scrubRef.current.dragging) return
          event.preventDefault()
          apply(ratioOf(event))
        }
        const onUp = () => {
          if (!scrubRef.current.dragging) return
          scrubRef.current.dragging = false
          setScrubbing(false)
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          window.removeEventListener('pointercancel', onUp)
          startProbe()
          const video = currentVideo()
          if (video) {
            const trail = []
            const names = ['loadstart', 'emptied', 'pause', 'seeking', 'seeked', 'play', 'loadedmetadata']
            const record = (event) => {
              trail.push(event.type)
              setProbe((current) => (current ? { ...current, events: trail.slice(-6).join(',') } : current))
            }
            for (const name of names) video.addEventListener(name, record)
            setTimeout(() => {
              for (const name of names) video.removeEventListener(name, record)
            }, 4000)
          }
          if (!video) return
          const target = scrubRef.current.target
          const resume = scrubRef.current.resume
          let settled = false
          const finish = () => {
            if (settled) return
            settled = true
            // A pending seek can be dropped by a play() that arrives mid-flight,
            // so re-assert the position once before resuming.
            if (Number.isFinite(target) && Math.abs(video.currentTime - target) > 0.4) {
              video.currentTime = target
            }
            if (resume) video.play().catch(() => {})
          }
          if (video.seeking) {
            video.addEventListener('seeked', finish, { once: true })
            setTimeout(() => {
              video.removeEventListener('seeked', finish)
              finish()
            }, 500)
          } else {
            finish()
          }
        }
        const onDown = (event) => {
          if (event.button !== 0) return
          event.preventDefault()
          event.stopPropagation()
          const video = currentVideo()
          scrubRef.current.dragging = true
          scrubRef.current.target = null
          scrubRef.current.resume = Boolean(video && !video.paused)
          if (video) video.pause()
          setScrubbing(true)
          apply(ratioOf(event))
          window.addEventListener('pointermove', onMove, { passive: false })
          window.addEventListener('pointerup', onUp)
          window.addEventListener('pointercancel', onUp)
        }
        const stopClick = (event) => event.stopPropagation()
        bar.addEventListener('pointerdown', onDown)
        bar.addEventListener('click', stopClick)
        return () => {
          bar.removeEventListener('pointerdown', onDown)
          bar.removeEventListener('click', stopClick)
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          window.removeEventListener('pointercancel', onUp)
        }
      }, [item?.id])

      const onTimeUpdate = (event) => {
        const video = event.currentTarget
        if (scrubRef.current.dragging) return
        if (video !== videoRef.current || !Number.isFinite(video.duration) || video.duration <= 0) return
        const target = scrubRef.current.target
        if (Number.isFinite(target)) {
          if (Math.abs(video.currentTime - target) > 1.5 && target > 1) {
            // The seek was ignored or undone (an aborted range request does this);
            // ask once more, then accept whatever the engine decides.
            video.currentTime = target
            scrubRef.current.target = null
            return
          }
          scrubRef.current.target = null
        }
        setProgress(Math.min(1, video.currentTime / video.duration))
      }

      /** Drop the queue and load from `cursor`, discarding any in-flight page. */
      const resetStream = React.useCallback((cursor) => {
        generationRef.current += 1
        prefetchBudgetRef.current = 0
        lastIndexRef.current = 0
        cursorRef.current = cursor
        streamCursor = cursor
        itemsRef.current = []
        setItems([])
        setIndex(0)
        setExhausted(false)
        setError(null)
        setNotice(null)
        setBrokenIds(new Set())
        load()
      }, [load])

      /** Drop everything cached and start the stream again, e.g. after signing in. */
      const restart = React.useCallback(() => resetStream(1), [resetStream])

      /** Ask for a different batch: skip ahead one page and load it. */
      const refresh = () => resetStream(cursorRef.current + 1)

      const reload = () => {
        setExhausted(false)
        load()
      }

      const bind = async () => {
        if (!cookieText.trim() || authBusy) return
        setAuthBusy(true)
        setAuthError(null)
        try {
          const response = await fetch(`${API}/session`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ cookie: cookieText }),
          })
          const body = await response.json().catch(() => ({}))
          if (!body?.ok) {
            setAuthError(body?.error === 'not-logged-in'
              ? t('account.invalid')
              : t('account.failed').replace('{message}', body?.error ?? `HTTP ${response.status}`))
            return
          }
          setAccount({ bound: true, profile: body.profile ?? null })
          setAuthExpired(false)
          setSheet(false)
          setCookieText('')
          restart()
        } catch (caught) {
          setAuthError(t('account.failed').replace('{message}', caught?.message ?? String(caught)))
        } finally {
          setAuthBusy(false)
        }
      }

      const unbind = async () => {
        if (authBusy) return
        setAuthBusy(true)
        setAuthError(null)
        try {
          await fetch(`${API}/session`, { method: 'DELETE' })
          setAccount({ bound: false, profile: null })
          setSheet(false)
          restart()
        } catch (caught) {
          setAuthError(t('account.failed').replace('{message}', caught?.message ?? String(caught)))
        } finally {
          setAuthBusy(false)
        }
      }

      const startLogin = async () => {
        setAuthError(null)
        try {
          const response = await fetch(`${API}/login/start`, { method: 'POST' })
          const body = await response.json().catch(() => ({}))
          if (!body?.ok) {
            setAuthError(body?.error === 'no-browser'
              ? t('account.noBrowser')
              : t('account.failed').replace('{message}', body?.message ?? body?.error ?? `HTTP ${response.status}`))
            setPasteMode(true)
            return
          }
          setLoginState('waiting')
        } catch (caught) {
          setAuthError(t('account.failed').replace('{message}', caught?.message ?? String(caught)))
          setPasteMode(true)
        }
      }

      const cancelLogin = async () => {
        setLoginState('idle')
        await fetch(`${API}/login/cancel`, { method: 'POST' }).catch(() => {})
      }

      // While the window is open, ask the Host whether the jar has arrived.
      React.useEffect(() => {
        if (loginState !== 'waiting') return undefined
        let alive = true
        const tick = async () => {
          try {
            const response = await fetch(`${API}/login/status`)
            const body = await response.json()
            if (!alive || !body?.ok) return
            if (body.state === 'waiting') return
            if (body.state === 'done') {
              setAccount({ bound: true, profile: body.profile ?? null })
              setAuthExpired(false)
              setLoginState('idle')
              setSheet(false)
              restart()
              return
            }
            setLoginState('idle')
            setAuthError(body.state === 'timeout'
              ? t('account.timeout')
              : body.state === 'closed'
                ? t('account.closed')
                : t('account.failed').replace('{message}', body.error ?? body.state ?? ''))
            setPasteMode(true)
          } catch {
            // A transient poll failure keeps the window and the poll alive.
          }
        }
        const timer = setInterval(tick, 1500)
        tick()
        return () => {
          alive = false
          clearInterval(timer)
        }
      }, [loginState, restart])

      const body = (() => {
        if (error && !items.length) {
          return h(
            'div',
            { className: 'dy-center' },
            h('div', null, t('feed.error').replace('{message}', error)),
            h('button', { className: 'dy-ghost', type: 'button', onClick: reload }, t('feed.retry')),
          )
        }
        if (!items.length) {
          return h('div', { className: 'dy-center' }, loading ? h('span', { className: 'dy-spin' }) : null, h('div', null, t('feed.loading')))
        }
        if (!item) {
          if (exhausted) {
            return h(
              'div',
              { className: 'dy-center' },
              h('div', null, t('feed.exhausted')),
              h('button', { className: 'dy-ghost', type: 'button', onClick: reload }, t('feed.reload')),
            )
          }
          return h('div', { className: 'dy-center' }, h('span', { className: 'dy-spin' }), h('div', null, t('feed.loadingMore')))
        }
        // Three slides: the one leaving, the one on stage, the one waiting. Only
        // a transform changes on a switch, and the next video is buffered before
        // it is ever seen.
        const trackStart = Math.max(0, index - 1)
        const slides = items.slice(trackStart, Math.min(items.length, index + 2))
        return h(
          'div',
          { className: 'dy-track' },
          slides.map((entry, position) => {
            const offset = trackStart + position - index
            const active = offset === 0
            return h(
              'div',
              {
                key: entry.id,
                className: 'dy-slide',
                'data-active': active ? 'true' : 'false',
                style: { transform: `translateY(${offset * 100}%)` },
                'aria-hidden': active ? undefined : 'true',
              },
              h('video', {
                ref: (element) => {
                  if (element && !element.dataset.uid) element.dataset.uid = Math.random().toString(36).slice(2, 6)
                },
                className: 'dy-video',
                src: entry.play,
                poster: entry.cover ?? undefined,
                playsInline: true,
                loop: true,
                muted,
                preload: offset < 0 ? 'none' : 'auto',
                'aria-label': entry.desc || entry.author?.name || 'Douyin video',
                onTimeUpdate,
                onPlay: (event) => {
                  if (event.currentTarget !== videoRef.current) return
                  setPlaying(true)
                  setNotice((current) => (current === 'finished' ? null : current))
                },
                onPause: (event) => {
                  if (scrubRef.current.dragging) return
                  if (event.currentTarget !== videoRef.current) return
                  setPlaying(false)
                },
                onError: () => setBrokenIds((previous) => new Set(previous).add(entry.id)),
              }),
              h('div', { className: 'dy-shade' }),
              h(
                'div',
                { className: 'dy-meta' },
                h(
                  'div',
                  { className: 'dy-author' },
                  entry.author?.avatar
                    ? h('img', { className: 'dy-avatar', src: entry.author.avatar, alt: '', loading: 'lazy' })
                    : h('span', { className: 'dy-avatar', style: { display: 'block' } }),
                  h('span', null, entry.author?.name || t('tab.title')),
                ),
                entry.desc ? h('div', { className: 'dy-desc' }, entry.desc) : null,
                h(
                  'div',
                  { className: 'dy-stats' },
                  h('span', null, t('feed.likes').replace('{count}', formatCount(entry.stats?.digg))),
                  h('span', null, t('feed.comments').replace('{count}', formatCount(entry.stats?.comment))),
                  h('span', null, t('feed.share').replace('{count}', formatCount(entry.stats?.share))),
                ),
              ),
              brokenIds.has(entry.id) && active
                ? h(
                  'div',
                  { className: 'dy-center' },
                  h('div', null, t('feed.unavailable')),
                  h('button', { className: 'dy-ghost', type: 'button', onClick: () => go(1) }, t('feed.next')),
                )
                : null,
            )
          }),
        )
      })()

      const accountButton = h(
        'button',
        {
          type: 'button',
          className: 'dy-account',
          title: account.bound ? t('account.bound') : t('account.anonymous'),
          'aria-label': t('account.title'),
          onClick: () => {
            setAuthError(null)
            setSheet(true)
            if (!account.bound) return
            fetch(`${API}/session?check=1`)
              .then((response) => response.json())
              .then((body) => {
                if (!body?.ok) return
                setAuthExpired(Boolean(body.expired))
                if (body.profile) setAccount({ bound: Boolean(body.bound), profile: body.profile })
              })
              .catch(() => {})
          },
        },
        account.bound && account.profile?.avatar
          ? h('img', { src: account.profile.avatar, alt: '', loading: 'lazy' })
          : h('span', null, t('account.login')),
      )

      const sheetView = sheet
        ? h(
          'div',
          { className: 'dy-sheet', onClick: (event) => { if (event.target === event.currentTarget) setSheet(false) } },
          h(
            'div',
            { className: 'dy-sheet-card' },
            h('div', { className: 'dy-sheet-title' }, t('account.title')),
            account.bound
              ? h(
                React.Fragment,
                null,
                h(
                  'div',
                  { className: 'dy-who' },
                  account.profile?.avatar ? h('img', { src: account.profile.avatar, alt: '' }) : null,
                  h('div', null,
                    h('div', null, `${t('account.current')}：${account.profile?.nickname || '—'}`),
                    h('div', { className: 'dy-sheet-text' }, t('account.bound')),
                  ),
                ),
                authExpired ? h('div', { className: 'dy-error-text' }, t('account.expired')) : null,
                h(
                  'div',
                  { className: 'dy-sheet-actions' },
                  h('button', { type: 'button', onClick: () => setSheet(false) }, t('account.close')),
                  h('button', { type: 'button', onClick: unbind, disabled: authBusy }, authBusy ? t('account.busy') : t('account.unbind')),
                ),
              )
              : h(
                React.Fragment,
                null,
                h('div', { className: 'dy-sheet-text' }, t('account.intro')),
                loginState === 'waiting'
                  ? h(
                    React.Fragment,
                    null,
                    h('div', { className: 'dy-login-wait' },
                      h('span', { className: 'dy-spin' }),
                      h('span', null, t('account.waiting')),
                    ),
                    h(
                      'div',
                      { className: 'dy-sheet-actions' },
                      h('button', { type: 'button', onClick: cancelLogin }, t('account.cancelLogin')),
                    ),
                  )
                  : pasteMode
                    ? h(
                      React.Fragment,
                      null,
                      h('div', { className: 'dy-sheet-text' }, t('account.manualHint')),
                      h('div', { className: 'dy-sheet-text' }, t('account.steps')),
                      h('textarea', {
                        value: cookieText,
                        placeholder: t('account.placeholder'),
                        spellCheck: false,
                        onChange: (event) => setCookieText(event.target.value),
                      }),
                      authError ? h('div', { className: 'dy-error-text' }, authError) : null,
                      h(
                        'div',
                        { className: 'dy-sheet-actions' },
                        h('button', { type: 'button', onClick: () => setSheet(false) }, t('account.close')),
                        h('button', { type: 'button', className: 'primary', onClick: bind, disabled: authBusy || !cookieText.trim() }, authBusy ? t('account.busy') : t('account.bind')),
                      ),
                    )
                    : h(
                      React.Fragment,
                      null,
                      h('div', { className: 'dy-sheet-text' }, t('account.autoHint')),
                      authError ? h('div', { className: 'dy-error-text' }, authError) : null,
                      h(
                        'div',
                        { className: 'dy-sheet-actions' },
                        h('button', { type: 'button', onClick: () => setSheet(false) }, t('account.close')),
                        h('button', { type: 'button', onClick: () => setPasteMode(true) }, t('account.manual')),
                        h('button', { type: 'button', className: 'primary', onClick: startLogin }, t('account.auto')),
                      ),
                    ),
              ),
          ),
        )
        : null

      return h(
        'div',
        { className: 'dy-root' },
        h(
          'div',
          { className: 'dy-head' },
          h('span', { className: 'dy-brand', title: t('tab.title') }, h(Mark, { size: 16 })),
          h('span', { className: 'dy-spacer' }),
          h('button', {
            type: 'button',
            className: 'dy-refresh',
            title: t('feed.refresh'),
            'aria-label': t('feed.refresh'),
            onClick: refresh,
          }, h(Refresh, {})),
          accountButton,
        ),
        h(
          'div',
          { className: 'dy-stage', ref: stageRef, onTouchStart, onTouchEnd, onClick: onStageClick },
          body,
          item && !playing && !brokenIds.has(item.id)
            ? h('div', { className: 'dy-bigplay' }, h('span', null, h(Transport, { size: 26 })))
            : null,
          h(
            'div',
            { className: 'dy-rail', onClick: (event) => event.stopPropagation() },
            h('button', {
              type: 'button',
              title: t('feed.prev'),
              'aria-label': t('feed.prev'),
              disabled: !canPrev,
              onClick: () => go(-1),
            }, h(Chevron, { up: true })),
            h('button', {
              type: 'button',
              title: playing ? t('feed.pause') : t('feed.play'),
              'aria-label': playing ? t('feed.pause') : t('feed.play'),
              onClick: togglePlay,
            }, h(Transport, { playing })),
            h('button', {
              type: 'button',
              title: muted ? t('feed.unmute') : t('feed.mute'),
              'aria-label': muted ? t('feed.unmute') : t('feed.mute'),
              onClick: () => setMuted((value) => !value),
            }, h(Speaker, { muted })),
            h('button', {
              type: 'button',
              title: t('feed.next'),
              'aria-label': t('feed.next'),
              disabled: !canNext,
              onClick: () => go(1),
            }, h(Chevron, {})),
          ),
          item
            ? h(
              'div',
              {
                ref: barRef,
                className: scrubbing ? 'dy-progress scrubbing' : 'dy-progress',
                role: 'slider',
                'aria-label': t('feed.seek'),
                'aria-valuemin': 0,
                'aria-valuemax': 100,
                'aria-valuenow': Math.round(progress * 100),
              },
              h('i', { style: { width: `${progress * 100}%` } }),
              h('b', { style: { left: `${progress * 100}%` } }),
            )
            : null,
          probe
            ? h('div', { className: 'dy-probe' },
              h('div', null,
                `t=${probe.ct.toFixed(2)}/${Number.isFinite(probe.dur) ? probe.dur.toFixed(2) : probe.dur} `,
                `tgt=${probe.target === null ? '-' : Number(probe.target).toFixed(2)} `,
                `seek=${probe.ranges} buf=${probe.buffered}`),
              h('div', null,
                `p=${probe.paused ? 1 : 0} sk=${probe.seeking ? 1 : 0} rs=${probe.ready} ns=${probe.network} `,
                `sw=${probe.serviceWorker} v=${probe.videos} a=${probe.active}`),
              h('div', null, `uids=${probe.uids ?? '-'} ev=${probe.events ?? '-'}`),
              h('div', null, `src=…${probe.src}`),
              probe.wire
                ? h('div', null,
                  `wire: ${probe.wire.status} range=${probe.wire.range} `,
                  `cr=${probe.wire.contentRange} cl=${probe.wire.length}`)
                : h('div', null, 'wire: -'))
            : null,
          item ? h('div', { className: 'dy-time' }, formatTime(item.duration * progress), ' / ', formatTime(item.duration)) : null,
          notice === 'finished'
            ? h(
              'div',
              { className: 'dy-note' },
              h('span', { className: 'dy-note-text' }, t('feed.finished')),
            )
            : null,
        ),
        sheetView,
      )
    }

    /** Foot button beside Settings: one click from anywhere into the feed. */
    function FooterButton(props) {
      const t = useTranslate()
      const wide = props?.wide !== false
      return h(
        'button',
        {
          type: 'button',
          className: 'dy-foot-action',
          title: t('button.tooltip'),
          'aria-label': t('button.tooltip'),
          onClick: () => openFeed(pluginCtx.current),
        },
        h(Mark, { size: 16 }),
        wide ? h('span', { className: 'dy-label' }, t('button.label')) : null,
      )
    }

    /**
     * Ambient card in the composer dock. It only offers the feed while the
     * agent runs, and it stays out of the way when the feed is already on
     * screen or the dock is in a read-only state.
     */
    function DockPrompt(props) {
      const t = useTranslate()
      const { sessionId, useSessionStatus, shouldHide } = props ?? {}
      const status = useSessionStatus ? useSessionStatus((snapshot) => (sessionId ? snapshot.get(sessionId) : undefined)) : undefined
      const [dismissed, setDismissed] = React.useState(false)
      const [docked, setDocked] = React.useState(false)
      const wasRunning = React.useRef(false)
      const running = status?.running === true

      // Start and finish are announced here, where the session status is live:
      // a finishing run pauses the feed, and a new run clears the old notice.
      React.useEffect(() => {
        if (wasRunning.current && !running) {
          for (const player of feedPlayers) player.pause()
        }
        if (!wasRunning.current && running) {
          for (const player of feedPlayers) player.wake()
        }
        wasRunning.current = running
      }, [running])

      React.useEffect(() => {
        const read = () => {
          const root = document.querySelector('.dy-root')
          setDocked(Boolean(root && root.offsetParent !== null && root.getClientRects().length > 0))
        }
        read()
        const timer = setInterval(read, 800)
        return () => clearInterval(timer)
      }, [])

      if (pluginConfig.current.autoPrompt === false) return null
      if (typeof shouldHide === 'function' ? shouldHide() : shouldHide === true) return null
      if (dismissed || docked) return null
      if (!running) return null

      return h(
        'div',
        { className: 'dy-prompt', role: 'status' },
        h('span', { className: 'dy-prompt-title' }, t('prompt.title')),
        h('button', {
          type: 'button',
          className: 'dy-prompt-open',
          title: t('prompt.action'),
          'aria-label': t('prompt.action'),
          onClick: () => {
            openFeed(pluginCtx.current)
            setDismissed(true)
          },
        }, h(Mark, { size: 15 })),
        h('button', {
          type: 'button',
          className: 'dy-prompt-dismiss',
          'aria-label': t('prompt.dismiss'),
          title: t('prompt.dismiss'),
          onClick: () => setDismissed(true),
        }, '\u00d7'),
      )
    }

    return {
      inject: ['slots', 'locale', 'sidebarRight', 'sidebarRightTabs'],
      apply(ctx) {
        pluginCtx.current = ctx
        const locale = ctx.get('locale')
        localeRef.current = locale
        if (locale) {
          ctx.effect(() => locale.register(NS, 'zh', zh), 'douyin: zh dictionary')
          ctx.effect(() => locale.register(NS, 'en', en), 'douyin: en dictionary')
        }

        fetch(`${API}/config`)
          .then((response) => response.json())
          .then((body) => {
            if (body?.ok) pluginConfig.current = body
          })
          .catch(() => {})

        ctx.effect(() => {
          const tag = document.createElement('style')
          tag.dataset.douyin = 'feed'
          tag.textContent = CSS
          document.head.append(tag)
          return () => tag.remove()
        }, 'douyin: styles')

        const tabs = ctx.get('sidebarRightTabs')
        if (tabs?.register) {
          ctx.effect(
            () =>
              tabs.register({
                id: TAB_ID,
                kind: KIND,
                multiple: false,
                title: () => translate('tab.title'),
                guide: [
                  {
                    id: 'douyin',
                    order: 31,
                    title: () => translate('guide.title'),
                    description: () => translate('guide.description'),
                    icon: Mark,
                  },
                ],
              }),
            'douyin: tab type',
          )
        }

        ctx.slots.inject('sidebar.right.pane.tab', () =>
          ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TAB_ID }, PlayerBody),
        )
        ctx.slots.inject('sidebar.footer.action', () =>
          ctx.slots.register({ name: 'sidebar.footer.action', id: 'douyin', order: 11, label: () => translate('button.label') }, FooterButton),
        )
        ctx.slots.inject('conversation.input.dock', () =>
          ctx.slots.register({ name: 'conversation.input.dock', id: 'douyin-prompt', order: 31 }, DockPrompt),
        )
      },
    }
  },
})
