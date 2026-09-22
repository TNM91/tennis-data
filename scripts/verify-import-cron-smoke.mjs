// Run against a LOCAL production build with CRON_SECRET=local-current-refresh-smoke
// and TENNISRECORD_COLLECTOR_ENABLED=false. Never performs real ingestion.
import assert from 'node:assert/strict'
const origin = new URL(process.env.TIQ_SMOKE_URL || 'http://127.0.0.1:3028')
assert.ok(['127.0.0.1', 'localhost'].includes(origin.hostname), 'Local server only')
for (const path of ['/api/cron/tennisrecord-automation', '/api/cron/tennisrecord-ratings']) {
  for (const headers of [{}, { authorization: 'Bearer wrong-local-key' }]) {
    const response = await fetch(new URL(path, origin), { headers })
    assert.equal(response.status, 401, path + ' must reject unauthorized requests')
  }
  const paused = await fetch(new URL(path, origin), { headers: { authorization: 'Bearer local-current-refresh-smoke' } })
  assert.equal(paused.status, 200)
  assert.equal((await paused.json()).summary.status, 'disabled', path + ' must honor the pause switch before database work')
  const post = await fetch(new URL(path, origin), { method: 'POST' })
  assert.equal(post.status, 405)
  console.log('PASS ' + path + ': unauthorized, invalid token, paused and method guards')
}
