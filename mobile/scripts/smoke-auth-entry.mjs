import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createDeviceConfig } from './prepare-device.mjs'

// Exercise the real app links in an already-running, signed-out debug WebView.
// This never enters credentials or submits the sign-in form.
const config = JSON.parse(readFileSync(new URL('../capacitor.config.json', import.meta.url), 'utf8'))
const origin = createDeviceConfig(config.server?.url).server.url
const targets = await (await fetch('http://127.0.0.1:9223/json/list', { signal: AbortSignal.timeout(10000) })).json()
const target = targets.find(item => item.type === 'page' && new URL(item.url).origin === origin)
if (!target) throw new Error('No matching prototype WebView. Forward its debug socket to local port 9223 first.')
const endpoint = new URL(target.webSocketDebuggerUrl)
if (endpoint.hostname !== '127.0.0.1' || endpoint.port !== '9223' || endpoint.protocol !== 'ws:') {
  throw new Error('Expected the local ADB-forwarded WebView inspector.')
}
const socket = new WebSocket(endpoint)
const pending = new Map()
let nextId = 0
function send(method, params = {}) {
  const id = ++nextId
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)) }, 20000)
    pending.set(id, { resolve, reject, timer })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data)
  const request = pending.get(message.id)
  if (!request) return
  clearTimeout(request.timer)
  pending.delete(message.id)
  if (message.error) request.reject(new Error(message.error.message))
  else request.resolve(message.result)
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error('The WebView evaluation failed')
  return result.result?.value
}
async function waitFor(expression, label, timeout = 45000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error(`Timed out waiting for ${label}`)
}
async function click(selector) {
  const point = await evaluate(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(el => el.getClientRects().length);
    if (!el) return null;
    el.scrollIntoView({block:'center'});
    const r = el.getBoundingClientRect();
    return {x:r.x+r.width/2,y:r.y+r.height/2};
  })()`)
  if (!point) throw new Error(`Visible control not found: ${selector}`)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 })
}

try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Inspector connection timed out')), 10000)
    socket.onopen = () => { clearTimeout(timer); resolve() }
    socket.onerror = () => { clearTimeout(timer); reject(new Error('Inspector connection failed')) }
  })
  await send('Page.enable')
  await send('Page.navigate', { url: `${origin}/` })
  await waitFor(`location.pathname === '/' && document.readyState === 'complete' && !!document.querySelector('button[aria-label="Open menu"]')`, 'the home menu')
  const access = await evaluate(`fetch('/api/auth/access', {cache:'no-store'}).then(r=>({status:r.status,json:(r.headers.get('content-type')||'').includes('application/json')}))`)
  if (access.status !== 401 || !access.json) throw new Error('Expected a signed-out JSON 401 response')
  await click('button[aria-label="Open menu"]')
  try {
    await waitFor(`!!document.querySelector('button[aria-label="Close menu"]')`, 'the open menu', 5000)
  } catch (error) {
    // A cold SSR page can display a button before React attaches its handler.
    // Retry once only if the menu is still closed; never toggle an open menu.
    if (!await evaluate(`!!document.querySelector('button[aria-label="Open menu"]')`)) throw error
    await click('button[aria-label="Open menu"]')
  }
  await waitFor(`[...document.querySelectorAll('a[href^="/login"]')].some(el=>el.getClientRects().length)`, 'the visible Sign in link')
  await click('a[href^="/login"]')
  await waitFor(`location.pathname === '/login' && !!document.querySelector('input[type="email"]') && !!document.querySelector('input[type="password"]')`, 'the sign-in form')
  // Catch delayed redirects instead of accepting a transient loading frame.
  await new Promise(resolve => setTimeout(resolve, 3000))
  if (!await evaluate(`location.pathname === '/login' && !!document.querySelector('input[type="email"]') && !!document.querySelector('input[type="password"]')`)) {
    throw new Error('The sign-in form did not remain visible')
  }
  const screenshot = await send('Page.captureScreenshot', { format: 'png' })
  const evidenceDir = new URL('../evidence/', import.meta.url)
  mkdirSync(evidenceDir, { recursive: true })
  writeFileSync(new URL('android-sign-in.png', evidenceDir), Buffer.from(screenshot.data, 'base64'))
  console.log('PASS: home → menu → Sign in; email/password form remained visible. Signed-out API returned JSON 401. No credentials entered.')
} finally {
  socket.close()
  for (const request of pending.values()) clearTimeout(request.timer)
}
