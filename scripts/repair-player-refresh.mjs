// Bounded, reversible queue repair. Does not bypass review holds or fetch source pages.
import { mkdir, writeFile } from 'node:fs/promises'
const name = process.argv.find(arg => arg.startsWith('--player='))?.slice(9)
if (!name) throw new Error('Supply --player=Full Name')
const apply = process.argv.includes('--apply')
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY required')
const base = 'https://pwxppfazbyourjrsutgx.supabase.co/rest/v1/'
async function request(table, params, method = 'GET', body) {
  const url = new URL(base + table); url.search = new URLSearchParams(params)
  const response = await fetch(url, { method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation,resolution=ignore-duplicates' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`Queue request failed (${response.status}): ${await response.text()}`)
  return await response.json()
}
const [player] = await request('tennisrecord_staged_players', { select: 'id,name,source_url,state', name: `eq.${name}` })
if (!player || player.name !== name) throw new Error('Exact staged player required')
const profile = new URL(player.source_url)
if (!['www.tennisrecord.com', 'tennisrecord.com'].includes(profile.hostname) || profile.pathname !== '/adult/profile.aspx') throw new Error('Verified source profile required')
const now = new Date(), year = now.getUTCFullYear()
const seasons = now.getUTCMonth() >= 7 ? [year, year + 1] : [year]
const urls = [profile.toString(), ...seasons.map(season => {
  const url = new URL(profile); url.pathname = '/adult/matchhistory.aspx'; url.searchParams.set('year', String(season)); return url.toString()
})]
const [campaign] = await request('tennisrecord_campaigns', { select: 'id', slug: 'eq.us-2025-current' })
if (!campaign) throw new Error('National campaign context required')
const before = []
for (const url of urls) before.push({ url, rows: await request('tennisrecord_crawl_queue', { select: '*', source_url: `eq.${url}` }) })
const out = process.argv.find(arg => arg.startsWith('--out='))?.slice(6) || 'artifacts/rating-evidence'
await mkdir(out, { recursive: true })
const backupPath = `${out}/player-refresh-${now.toISOString().replace(/[:.]/g, '-')}.json`
await writeFile(backupPath, JSON.stringify({ name, apply, before }, null, 2))
const results = []
for (const { url, rows } of before) {
  const row = rows[0]
  if (row && !['done', 'pending'].includes(row.status)) { results.push({ url, action: 'preserved_hold_or_active', status: row.status }); continue }
  if (apply) {
    const values = { refresh_season: year, refresh_due_at: now.toISOString(), ...(row?.status === 'done' ? { status: 'pending', completed_at: null } : {}) }
    const saved = row
      ? await request('tennisrecord_crawl_queue', { id: `eq.${row.id}`, status: `eq.${row.status}` }, 'PATCH', values)
      : await request('tennisrecord_crawl_queue', {}, 'POST', { source_url: url, page_kind: url === urls[0] ? 'player' : 'history', campaign_id: campaign.id, status: 'pending', ...values })
    results.push({ url, action: saved.length ? 'queued' : 'changed_concurrently', status: saved[0]?.status })
  } else results.push({ url, action: row ? 'would_schedule' : 'would_enqueue' })
}
console.log(JSON.stringify({ name, apply, backupPath, results }, null, 2))
