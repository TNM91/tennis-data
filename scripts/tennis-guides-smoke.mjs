import assert from 'node:assert/strict'

const base = process.env.TENNIS_GUIDES_SMOKE_URL || 'http://localhost:3100'
const guides = [
  ['read-your-tennis-rating', 'Worked example: a close loss can beat expectation'],
  ['read-doubles-results', 'Worked example: equal records, different evidence'],
  ['matchup-confidence', 'Worked example: the same gap, different uncertainty'],
]

for (const [slug, heading] of guides) {
  const path = `/resources/guides/${slug}`
  const response = await fetch(`${base}${path}`)
  assert.equal(response.status, 200, path)
  const html = await response.text()
  // Ignore scripts so serialized React payloads cannot masquerade as visible HTML.
  const visibleHtml = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  assert.ok(visibleHtml.includes(heading), `${path}: example missing from server HTML`)
  assert.ok(visibleHtml.includes('hypothetical players and results'), `${path}: missing example disclosure`)
  assert.ok(visibleHtml.includes('href="/methodology"'), `${path}: missing methodology`)
  assert.ok(html.includes(`href="https://www.tenaceiq.com${path}"`), `${path}: missing canonical`)
  assert.ok(!visibleHtml.includes('adsbygoogle'), `${path}: unexpected ad placement`)
}

for (const path of ['/', '/explore', '/resources']) {
  const response = await fetch(`${base}${path}`)
  assert.equal(response.status, 200, path)
  const html = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  for (const [slug] of guides) assert.ok(html.includes(`href="/resources/guides/${slug}"`), `${path}: guide link missing`)
}

assert.equal((await fetch(`${base}/resources/guides/no-such-guide`)).status, 404)
const sitemapResponse = await fetch(`${base}/sitemap.xml`)
assert.equal(sitemapResponse.status, 200)
const sitemap = await sitemapResponse.text()
for (const [slug] of guides) assert.ok(sitemap.includes(`/resources/guides/${slug}</loc>`), `${slug}: absent from sitemap`)
console.log('Passed: three complete server-rendered guides, canonical URLs, disclosures, methodology links, three discovery routes, unknown-slug 404, and sitemap entries.')
