// Repair only scorecard URLs backed by a fresh completed history row.
import { mkdir, writeFile } from 'node:fs/promises'
const name = process.argv.find(a => a.startsWith('--player='))?.slice(9)
const year = process.argv.find(a => a.startsWith('--year='))?.slice(7)
if (!name || !/^20\d{2}$/.test(year || '')) throw new Error('Supply --player=Full Name and --year=YYYY')
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY required')
const apply = process.argv.includes('--apply'), base = 'https://pwxppfazbyourjrsutgx.supabase.co'
async function query(table, params, method = 'GET', body) {
  const url = new URL(`${base}/rest/v1/${table}`); url.search = new URLSearchParams(params)
  const r = await fetch(url, { method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation,resolution=ignore-duplicates' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) })
  if (!r.ok) throw new Error(`Query failed (${r.status}): ${await r.text()}`)
  return r.json()
}
async function html(page) {
  if (page.raw_html) return page.raw_html
  if (!page.raw_html_storage_path) throw new Error('Retained HTML required')
  const r = await fetch(`${base}/storage/v1/object/authenticated/tennisrecord-source-pages/${page.raw_html_storage_path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30000) })
  if (!r.ok) throw new Error('Retained source download failed')
  return r.text()
}
const historyUrl = 'https://www.tennisrecord.com/adult/matchhistory.aspx?' + new URLSearchParams({ playername: name, year })
const [history] = await query('tennisrecord_source_pages', { select: '*', source_url: `eq.${historyUrl}`, order: 'captured_at.desc', limit: '1' })
if (!history || Date.now() - Date.parse(history.captured_at) > 86400000 || history.blocked || history.http_status !== 200) throw new Error('Successful source history captured in the preceding day required')
const raw = await html(history), text = value => value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
if (!text(raw).includes(name)) throw new Error('Requested history owner is absent')
const candidates = new Map()
for (const tr of raw.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
  const visible = text(tr[1])
  const date = visible.match(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/)
  const games = [...visible.matchAll(/\b(\d+)\s*-\s*(\d+)\b/g)].reduce((sum, m) => sum + Number(m[1]) + Number(m[2]), 0)
  if (!date || !/\b[WL]\b/.test(visible) || games < 6) continue
  const playedOn = `${date[3]}-${date[1]}-${date[2]}`
  if (playedOn > new Date().toISOString().slice(0, 10)) continue
  for (const link of tr[1].matchAll(/href\s*=\s*(["'])(.*?)\1/gi)) {
    const url = new URL(link[2].replace(/&amp;/g, '&'), historyUrl)
    if (url.hostname === 'www.tennisrecord.com' && url.pathname === '/adult/matchresults.aspx') candidates.set(url.toString(), playedOn)
  }
}
const [campaign] = await query('tennisrecord_campaigns', { select: 'id', slug: 'eq.us-2025-current' })
if (!campaign) throw new Error('National campaign required')
const plans = []
for (const [url, playedOn] of candidates) {
  const [row] = await query('tennisrecord_crawl_queue', { select: '*', source_url: `eq.${url}` })
  if (!row) { plans.push({ url, playedOn, row: null, action: 'enqueue_missing_scorecard' }); continue }
  if (row.status !== 'review' || row.failure_reason !== 'No complete TennisRecord court results were parsed; page evidence was retained for review.') continue
  const [prior] = await query('tennisrecord_source_pages', { select: '*', source_url: `eq.${url}`, order: 'captured_at.desc', limit: '1' })
  if (!prior || prior.blocked || prior.http_status !== 200 || prior.captured_at.slice(0, 10) >= playedOn) continue
  const scheduled = text(await html(prior)).match(/Scheduled\s+Date\s*:\s*(\d{2})\/(\d{2})\/(20\d{2})/i)
  if (!scheduled || `${scheduled[3]}-${scheduled[1]}-${scheduled[2]}` !== playedOn) continue
  plans.push({ url, playedOn, row, priorPageId: prior.id, action: 'retry_pre_result_capture' })
}
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) || 'artifacts/rating-evidence'
await mkdir(out, { recursive: true })
const path = `${out}/history-discovery-repair-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
await writeFile(path, JSON.stringify({ name, year, apply, historyPageId: history.id, historyCapturedAt: history.captured_at, plans }, null, 2))
const results = []
for (const plan of plans) {
  if (apply) {
    const values = { status: 'pending', refresh_season: new Date().getUTCFullYear(), refresh_due_at: new Date().toISOString(), completed_at: null }
    const saved = plan.row
      ? await query('tennisrecord_crawl_queue', { id: `eq.${plan.row.id}`, status: 'eq.review', failure_reason: `eq.${plan.row.failure_reason}` }, 'PATCH', { ...values, failure_reason: 'Fresh completed history evidence supersedes the pre-result capture; fetch the full scorecard before reconciliation.' })
      : await query('tennisrecord_crawl_queue', {}, 'POST', { source_url: plan.url, page_kind: 'match', campaign_id: campaign.id, ...values })
    results.push({ url: plan.url, action: saved.length ? plan.action : 'changed_concurrently' })
  } else results.push({ url: plan.url, action: plan.action })
}
console.log(JSON.stringify({ apply, backupPath: path, results }, null, 2))
