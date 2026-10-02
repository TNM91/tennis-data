// Read-only, fully paginated Missouri freshness report. Never equate metadata touches with source captures.
import { mkdir, writeFile } from 'node:fs/promises'
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY required')
const base = 'https://pwxppfazbyourjrsutgx.supabase.co/rest/v1/'
async function query(table, params) {
  const url = new URL(table, base); url.search = new URLSearchParams(params)
  const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`${table}: ${response.status}`)
  return response.json()
}
async function all(table, params) {
  const rows = []
  for (let offset = 0; ; offset += 500) {
    const page = await query(table, { ...params, order: 'id', offset: String(offset), limit: '500' })
    rows.push(...page)
    if (page.length < 500) return rows
  }
}
const now = new Date(), cutoff = now.getTime() - 7 * 86400000, season = now.getUTCFullYear()
const [settings] = await query('tennisrecord_collector_settings', { select: 'enabled,current_refresh_enabled,automation_state,max_requests_per_run,min_request_interval_ms', id: 'eq.true' })
const [campaign] = await query('tennisrecord_campaigns', { select: 'id', slug: 'eq.missouri-2025-current' })
if (!campaign) throw new Error('Missouri campaign missing')
const players = await all('tennisrecord_staged_players', { select: 'id,source_url,name', state: 'eq.MO' })
const queue = await all('tennisrecord_crawl_queue', { select: 'id,source_url,page_kind,status,current_refreshed_at,refresh_season,refresh_due_at', campaign_id: `eq.${campaign.id}` })
const byUrl = new Map(queue.map(row => [row.source_url, row])), coverage = { players: players.length, missingProfiles: 0, freshProfiles: 0, staleProfiles: 0, heldProfiles: 0, activeHistoriesExpected: 0, missingActiveHistories: 0 }
const gaps = [], years = now.getUTCMonth() >= 7 ? [season, season + 1] : [season]
for (const player of players) {
  const row = byUrl.get(player.source_url)
  if (!row) coverage.missingProfiles++
  else if (['review', 'blocked', 'error'].includes(row.status)) coverage.heldProfiles++
  else if (Date.parse(row.current_refreshed_at) >= cutoff) coverage.freshProfiles++
  else coverage.staleProfiles++
  if (!row || Date.parse(row.current_refreshed_at) < cutoff || !row.current_refreshed_at) gaps.push({ playerId: player.id, name: player.name, sourceUrl: player.source_url, status: row?.status ?? 'missing', currentRefreshedAt: row?.current_refreshed_at ?? null })
  try {
    const url = new URL(player.source_url)
    if (!['www.tennisrecord.com', 'tennisrecord.com'].includes(url.hostname) || url.pathname !== '/adult/profile.aspx') continue
    for (const year of years) {
      const history = new URL(url); history.pathname = '/adult/matchhistory.aspx'; history.searchParams.set('year', year)
      coverage.activeHistoriesExpected++
      if (!byUrl.has(history.toString())) coverage.missingActiveHistories++
    }
  } catch { /* Invalid source is exposed in missing/stale profile coverage. */ }
}
const pages = {}
for (const row of queue.filter(row => row.refresh_season === season)) {
  const group = pages[row.page_kind] ??= { total: 0, fresh: 0, pending: 0, held: 0, overdue: 0, oldestOverdueAt: null }
  group.total++
  if (Date.parse(row.current_refreshed_at) >= cutoff) group.fresh++
  if (row.status === 'pending') group.pending++
  if (['review', 'blocked', 'error'].includes(row.status)) group.held++
  if (['pending', 'done'].includes(row.status) && Date.parse(row.refresh_due_at) < now.getTime()) {
    group.overdue++
    if (!group.oldestOverdueAt || row.refresh_due_at < group.oldestOverdueAt) group.oldestOverdueAt = row.refresh_due_at
  }
}
const report = { generatedAt: now.toISOString(), targetDays: 7, scope: 'Missouri campaign and known MO profiles; held evidence remains held', settings, coverage, pages, gaps, limitations: ['current_refreshed_at is successful collector processing, not the source estimate measurement date.', 'Queue coverage is campaign-specific; cross-campaign aliases need review before repair.', 'Weekly scheduling does not guarantee source publication or complete statewide discovery.'] }
const out = process.argv.find(arg => arg.startsWith('--out='))?.slice(6) || 'artifacts/rating-evidence'
await mkdir(out, { recursive: true })
const path = `${out}/missouri-freshness-${now.toISOString().replace(/[:.]/g, '-')}.json`
await writeFile(path, JSON.stringify(report, null, 2))
console.log(JSON.stringify({ path, settings, coverage, pages }, null, 2))
