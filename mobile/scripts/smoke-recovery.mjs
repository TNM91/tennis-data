// Intercept every recovery request: no live reset emails or password changes.
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
const targets = await (await fetch('http://127.0.0.1:9223/json/list')).json()
const target = targets.find(t => t.type === 'page' && t.url === 'https://localhost/')
assert.ok(target, 'Expected the signed-out bundled WebView')
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
let id = 0
let mode = 'success'
let requests = 0
let interceptError
const pending = new Map()
const headers = [
  {name: 'Content-Type', value: 'application/json'},
  {name: 'Access-Control-Allow-Origin', value: '*'},
  {name: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS'},
  {name: 'Access-Control-Allow-Headers', value: 'apikey, authorization, content-type, x-client-info, x-supabase-api-version'},
]
ws.onmessage = ({data}) => {
  const message = JSON.parse(data)
  const item = pending.get(message.id)
  if (item) { clearTimeout(item.timer); pending.delete(message.id); if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result) }
  if (message.method === 'Fetch.requestPaused') {
    void (async () => {
      const {requestId, request} = message.params
      try {
        if (request.method === 'OPTIONS') {
          await send('Fetch.fulfillRequest', {requestId, responseCode: 204, responseHeaders: headers})
          return
        }
        assert.equal(request.method, 'POST')
        const url = new URL(request.url)
        assert.equal(url.origin, 'https://pwxppfazbyourjrsutgx.supabase.co')
        assert.equal(url.pathname, '/auth/v1/recover')
        assert.equal(url.searchParams.get('redirect_to'), 'https://www.tenaceiq.com/reset-password')
        assert.equal(JSON.parse(request.postData).email, 'mobile-recovery@example.invalid')
        requests++
        await new Promise(resolve => setTimeout(resolve, mode === 'late' ? 800 : 100))
        if (mode === 'offline') await send('Fetch.failRequest', {requestId, errorReason: 'InternetDisconnected'})
        else await send('Fetch.fulfillRequest', {requestId, responseCode: mode === 'rate-limit' ? 429 : 200, responseHeaders: headers,
          body: Buffer.from(JSON.stringify(mode === 'rate-limit' ? {msg: 'Too many requests', code: 'over_email_send_rate_limit'} : {})).toString('base64')})
      } catch (error) { interceptError = error; await send('Fetch.failRequest', {requestId, errorReason: 'Aborted'}).catch(() => {}) }
    })()
  }
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const key = ++id
    pending.set(key, {resolve, reject, timer: setTimeout(() => reject(new Error('Inspector timeout')), 20000)})
    ws.send(JSON.stringify({id: key, method, params}))
  })
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true})
  assert.ok(!result.exceptionDetails, 'WebView operation failed')
  return result.result?.value
}
async function until(expression) {
  const deadline = Date.now() + 15000
  while (!await evaluate(expression)) {
    if (interceptError) throw interceptError
    if (Date.now() > deadline) throw new Error('Recovery state did not resolve')
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}
try {
  await until(`document.querySelector('#app')?.dataset.state === 'signed-out'`)
  await send('Fetch.enable', {patterns: [{urlPattern: 'https://pwxppfazbyourjrsutgx.supabase.co/auth/v1/recover*', requestStage: 'Request'}]})
  for (const scenario of ['success', 'rate-limit', 'offline', 'late']) {
    mode = scenario
    const before = requests
    await evaluate(`document.querySelector('#forgot-password').click()`)
    await until(`document.querySelector('#app')?.dataset.state === 'recovery'`)
    if (scenario === 'success') {
      const screenshot = await send('Page.captureScreenshot', {format: 'png'})
      await writeFile(new URL('../evidence/android-password-recovery.png', import.meta.url), Buffer.from(screenshot.data, 'base64'))
    }
    await evaluate(`(()=>{document.querySelector('[name=email]').value='mobile-recovery@example.invalid';document.querySelector('#recovery-form').requestSubmit();document.querySelector('#recovery-form').requestSubmit();return true})()`)
    if (scenario === 'late') {
      await new Promise(resolve => setTimeout(resolve, 200))
      await evaluate(`document.querySelector('#back-login').click()`)
      await new Promise(resolve => setTimeout(resolve, 1000))
      assert.ok(await evaluate(`document.querySelector('#app').dataset.state === 'signed-out' && !document.querySelector('#recovery-status')`))
    } else {
      await until(scenario === 'success'
        ? `document.querySelector('#recovery-status')?.textContent.includes('If an account')`
        : `!!document.querySelector('#recovery-error')?.textContent`)
      assert.equal(await evaluate(`document.querySelector('#send-reset').disabled`), scenario !== 'offline')
      await evaluate(`document.querySelector('#back-login').click()`)
    }
    assert.equal(requests - before, 1, 'Duplicate submissions must not send duplicate requests')
    if (interceptError) throw interceptError
    console.log(JSON.stringify({scenario, passed: true, liveEmailSent: false}))
  }
} finally {
  await send('Fetch.disable').catch(() => {})
  ws.close()
  for (const item of pending.values()) clearTimeout(item.timer)
}
