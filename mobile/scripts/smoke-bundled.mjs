// Uses only the configured synthetic Free QA fixture; never print credentials or profile data.
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
const targets = await (await fetch('http://127.0.0.1:9223/json/list')).json()
const target = targets.find(t => t.type === 'page' && ['https://localhost/', 'https://localhost/#match'].includes(t.url))
assert.ok(target, 'Expected the bundled Android WebView')
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
let id = 0
const pending = new Map()
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data)
  const item = pending.get(message.id)
  if (item) {
    clearTimeout(item.timer)
    pending.delete(message.id)
    if (message.error) item.reject(new Error(message.error.message))
    else item.resolve(message.result)
  }
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const key = ++id
    pending.set(key, { resolve, reject, timer: setTimeout(() => reject(new Error('Inspector timeout')), 20000) })
    ws.send(JSON.stringify({ id: key, method, params }))
  })
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  assert.ok(!result.exceptionDetails, 'WebView operation failed')
  return result.result?.value
}
async function state(expected) {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    if (await evaluate(`document.querySelector('#app')?.dataset.state`) === expected) return
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  throw new Error(`Did not reach ${expected}`)
}
async function resultsState() {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    const value = await evaluate(`document.querySelector('#results-content')?.dataset.state`)
    if (['ready', 'empty', 'unlinked'].includes(value)) return value
    if (value === 'unavailable') throw new Error('Recent match API was unavailable')
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  throw new Error('Recent matches did not finish loading')
}
try {
  const phase = process.argv[2] || 'entry'
  if (phase === 'recovery-open') {
    await state('signed-out')
    await evaluate(`document.querySelector('#forgot-password').click()`)
    await state('recovery')
  } else if (phase === 'recovery-returned') {
    await state('signed-out')
    assert.ok(await evaluate(`!document.querySelector('#recovery-form') && !!document.querySelector('input[type=password]')`))
  } else if (phase === 'support-link') {
    await state('signed-out')
    await evaluate(`document.querySelector('[data-account-link=support]').click()`)
  } else if (phase === 'offline-entry') {
    await state('signed-out')
    await send('Network.enable')
    await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 })
    await send('Page.reload')
    await new Promise(resolve => setTimeout(resolve, 1500))
    await state('signed-out')
  } else if (phase === 'login') {
    await state('signed-out')
    const tier = process.argv[3] || 'FREE'
    assert.ok(['FREE', 'PLAYER', 'CAPTAIN'].includes(tier), 'Use a configured synthetic QA tier')
    const email = process.env[`TENACEIQ_QA_${tier}_EMAIL`]
    const password = process.env[`TENACEIQ_QA_${tier}_PASSWORD`]
    assert.ok(email && password, 'Missing synthetic QA fixture')
    await evaluate(`(()=>{document.querySelector('[name=email]').value=${JSON.stringify(email)};document.querySelector('[name=password]').value=${JSON.stringify(password)};document.querySelector('form').requestSubmit();return true})()`)
    await state('ready')
    console.log(JSON.stringify({ recentResults: await resultsState() }))
  } else if (phase === 'restore') {
    await state('ready')
    console.log(JSON.stringify({ recentResults: await resultsState() }))
  } else if (phase === 'details' || phase === 'details-retry' || phase === 'preview-details') {
    await state('ready')
    assert.equal(await resultsState(), 'ready')
    await evaluate(`document.querySelector('.match-open').focus(); document.querySelector('.match-open').scrollIntoView();`)
    const scrollBefore = await evaluate('window.scrollY')
    if (phase === 'details-retry') {
      await send('Network.enable')
      await send('Network.setBlockedURLs', {urls: ['*/rest/v1/match_players*']})
    }
    await evaluate(`document.querySelector('.match-open').click()`)
    const waitDetail = async expected => {
      const deadline = Date.now() + 30000
      while (await evaluate(`document.querySelector('#match-players')?.dataset.state`) !== expected) {
        if (Date.now() > deadline) throw new Error(`Expected detail ${expected}`)
        await new Promise(resolve => setTimeout(resolve, 250))
      }
    }
    if (phase === 'details-retry') {
      await waitDetail('unavailable')
      await send('Network.setBlockedURLs', {urls: []})
      await evaluate(`document.querySelector('#retry-detail').click()`)
    }
    await waitDetail('ready')
    assert.equal(await evaluate('location.hash'), '#match')
    assert.equal(await evaluate(`document.activeElement?.tagName`), 'H1')
    if (phase === 'preview-details') {
      // Replace every visible fixture field with sample copy before saving pixels.
      await evaluate(`(()=>{const detail=document.querySelector('#match-detail');const values=['Won','Sample Tennis League','6-4 6-3'];detail.querySelectorAll('dd').forEach((el,i)=>el.textContent=values[i]);detail.querySelector('p').textContent='Oct 23, 2026 · Doubles';detail.querySelectorAll('#match-players p').forEach((el,i)=>el.textContent=i===0?'Taylor Player & Casey Partner':'Alex Opponent & Jordan Opponent');return true})()`)
      const screenshot = await send('Page.captureScreenshot', {format: 'png'})
      await writeFile(new URL('../evidence/android-match-details-sample.png', import.meta.url), Buffer.from(screenshot.data, 'base64'))
    }
    await evaluate(`document.querySelector('#back-matches').click()`)
    const deadline = Date.now() + 5000
    while (await evaluate(`document.querySelector('#app').dataset.view === 'match'`)) {
      if (Date.now() > deadline) throw new Error('Back did not return to My Lab')
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.equal(await resultsState(), 'ready')
    assert.ok(await evaluate(`document.activeElement?.classList.contains('match-open')`), 'Focus restored to match')
    assert.ok(Math.abs(await evaluate('window.scrollY') - scrollBefore) < 5, 'List scroll restored')
  } else if (phase === 'open-detail') {
    await state('ready')
    assert.equal(await resultsState(), 'ready')
    await evaluate(`document.querySelector('.match-open').click()`)
    assert.equal(await evaluate('location.hash'), '#match')
  } else if (phase === 'detail-returned') {
    await state('ready')
    assert.ok(await evaluate(`!document.querySelector('#match-detail') && !document.querySelector('#app').dataset.view && location.hash === ''`), 'System Back returns to My Lab')
    assert.equal(await resultsState(), 'ready')
  } else if (phase === 'results-retry') {
    await state('ready')
    assert.equal(await resultsState(), 'ready', 'This phase requires a QA player with connected matches')
    await send('Network.enable')
    await send('Network.setBlockedURLs', { urls: ['*/rest/v1/matches*'] })
    await evaluate(`document.querySelector('#refresh').click()`)
    await state('ready')
    const deadline = Date.now() + 30000
    while (await evaluate(`document.querySelector('#results-content')?.dataset.state`) !== 'unavailable') {
      if (Date.now() > deadline) throw new Error('Expected independent match failure')
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    assert.ok(await evaluate(`!!document.querySelector('#logout')`), 'Profile controls remain usable')
    await send('Network.setBlockedURLs', { urls: [] })
    await evaluate(`document.querySelector('#retry-results').click()`)
    assert.equal(await resultsState(), 'ready')
  } else if (phase === 'offline') {
    await state('ready')
    await send('Network.enable')
    await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 })
    await evaluate(`document.querySelector('#refresh').click()`)
    await state('unavailable')
    await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
    // The online event automatically refreshes; no second click during loading.
    await state('ready')
  } else if (phase === 'logout') {
    await state('ready')
    await evaluate(`document.querySelector('#logout').click()`)
    await state('signed-out')
  } else {
    await state('signed-out')
    const result = await send('Page.captureScreenshot', { format: 'png' })
    await writeFile(new URL('../evidence/android-bundled-sign-in.png', import.meta.url), Buffer.from(result.data, 'base64'))
  }
  console.log(JSON.stringify({ phase, passed: true, origin: 'https://localhost', localServerTunnelRequired: false }))
} finally {
  await send('Network.setBlockedURLs', { urls: [] }).catch(() => {})
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }).catch(() => {})
  ws.close()
  for (const item of pending.values()) clearTimeout(item.timer)
}
