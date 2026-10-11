import assert from 'node:assert/strict'
const base = process.env.PUBLIC_COMPETITION_SMOKE_URL || 'http://localhost:3120'
const bodyHtml = (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
const decodeHtml = (value) => value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#x27;', "'")
let rankingRows = 0
for (const path of ['/rankings', '/explore/rankings']) {
  const response = await fetch(`${base}${path}`)
  assert.equal(response.status, 200, path)
  const html = bodyHtml(await response.text())
  assert.ok(html.includes('Public overall TiQ snapshot'), `${path}: snapshot missing`)
  rankingRows = (html.match(/data-public-ranked-player=/g) || []).length
  assert.ok(rankingRows > 0, `${path}: no scored ranking profiles in HTML`)
  assert.ok(html.includes('not an official USTA ranking'), `${path}: missing scope distinction`)
  assert.ok(html.includes('Latest recorded score:'), `${path}: score evidence missing`)
  assert.ok(/\d\.XX/.test(html), `${path}: public signal missing`)
}
const teamLinks = new Set()
for (const path of ['/teams', '/explore/teams']) {
  const response = await fetch(`${base}${path}`)
  assert.equal(response.status, 200, path)
  const html = bodyHtml(await response.text())
  assert.ok(html.includes('Teams with scored public court evidence'), `${path}: team evidence missing`)
  assert.ok(html.includes('Court results are not team-tie standings'), `${path}: missing court/tie distinction`)
  for (const match of html.matchAll(/<h3><a[^>]*href="(\/teams\/[^"#]+)"/g)) teamLinks.add(decodeHtml(match[1]))
}
assert.ok(teamLinks.size > 0, 'No evidenced team profile links')
const samples = [...teamLinks].slice(0, 2)
const slash = [...teamLinks].find((href) => href.includes('~2F'))
if (slash && !samples.includes(slash)) samples.push(slash)
for (const path of samples) {
  const response = await fetch(`${base}${path}`)
  assert.equal(response.status, 200, path)
  const fullHtml = await response.text()
  const html = bodyHtml(fullHtml)
  assert.ok(html.includes('Public team court record'), `${path}: profile snapshot missing`)
  assert.ok((html.match(/Recorded court score:/g) || []).length >= 3, `${path}: insufficient scored court evidence`)
  assert.ok(html.includes('not a team-tie record'), `${path}: sample scope missing`)
  assert.ok(fullHtml.includes(`href="https://www.tenaceiq.com${path}"`), `${path}: canonical mismatch`)
  assert.ok(!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(fullHtml), `${path}: evidenced profile noindexed`)
}
const sitemapResponse = await fetch(`${base}/sitemap.xml`)
assert.equal(sitemapResponse.status, 200)
const sitemap = await sitemapResponse.text()
for (const path of teamLinks) assert.ok(sitemap.includes(`https://www.tenaceiq.com${path}</loc>`), `${path}: absent from sitemap`)
console.log(`Passed: ${rankingRows} ranking profiles, ${teamLinks.size} team profiles, four public directory routes, ${samples.length} scored team snapshots, canonical/indexing checks, and sitemap entries.`)
console.log(`Preview: ${base}${samples[0]}`)
