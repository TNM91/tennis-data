import assert from 'node:assert/strict'

const base = process.env.PUBLIC_PLAYER_SMOKE_URL || 'http://localhost:3110'
const visibleHtml = (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
const playerIds = new Set()
for (const path of ['/players', '/explore/players']) {
  const response = await fetch(`${base}${path}`)
  assert.equal(response.status, 200, path)
  const html = visibleHtml(await response.text())
  assert.ok(html.includes('Players with public match evidence'), `${path}: missing public directory`)
  assert.ok(html.includes('Recorded score:'), `${path}: no server-rendered match facts`)
  for (const [, id] of html.matchAll(/data-public-player-id="([0-9a-f-]+)"/g)) playerIds.add(id)
}
assert.ok(playerIds.size >= 1, 'No evidenced player profiles are discoverable')

const samples = [...playerIds].slice(0, 2)
for (const id of samples) {
const response = await fetch(`${base}/players/${id}`)
assert.equal(response.status, 200)
const fullHtml = await response.text()
const html = visibleHtml(fullHtml)
assert.ok(html.includes(`data-public-player-id="${id}"`), 'Profile identity is absent from initial HTML')
assert.ok(html.includes('Public player match record'), 'No readable profile snapshot')
assert.ok((html.match(/Recorded score:/g) || []).length >= 3, 'Discovered profile lacks three scored public results')
assert.ok(html.includes('Against '), 'Profile lacks opponents')
assert.ok(html.includes('not a career total'), 'Sample is presented as a lifetime record')
assert.ok(fullHtml.includes(`href="https://www.tenaceiq.com/players/${id}"`), 'Profile canonical missing')
assert.ok(!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(fullHtml), 'Evidenced profile unexpectedly noindexed')
}

const missing = await fetch(`${base}/players/not-a-player-id`)
assert.ok(missing.status === 404 || (await missing.text()).includes('noindex'), 'Missing profile is indexable')

const sitemapResponse = await fetch(`${base}/sitemap.xml`)
assert.equal(sitemapResponse.status, 200)
const sitemap = await sitemapResponse.text()
for (const playerId of playerIds) assert.ok(sitemap.includes(`/players/${playerId}</loc>`), 'Evidenced profile absent from sitemap')
console.log(`Passed: ${playerIds.size} discoverable profiles, two directories with real server HTML, ${samples.length} scored profile snapshots, canonical/indexing checks, missing-profile protection, and sitemap alignment.`)
console.log(`Preview: ${base}/players/${samples[0]}`)
