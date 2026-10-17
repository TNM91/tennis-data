// Read-only evidence audit. Run: node --env-file=.env.local scripts/audit-year-end-rating-evidence.mjs
import { mkdir, writeFile } from 'node:fs/promises'

const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
const base = 'https://pwxppfazbyourjrsutgx.supabase.co/rest/v1/'
async function query(path) {
  const response = await fetch(base + path, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error(`Audit query failed (${response.status}): ${await response.text()}`)
  return { rows: await response.json(), count: Number(response.headers.get('content-range')?.split('/')[1]) }
}

const startedAt = new Date().toISOString()
const cutoff = new Date(Date.now() - 7 * 86400000).toISOString()
const year = new Date().getUTCFullYear()
const freshness = {}
for (const [label, filter] of Object.entries({
  currentPages: `refresh_season=eq.${year}`,
  refreshedWithinSevenDays: `refresh_season=eq.${year}&current_refreshed_at=gte.${cutoff}`,
  overdueDone: `refresh_season=eq.${year}&status=eq.done&refresh_due_at=lt.${startedAt}`,
  overduePending: `refresh_season=eq.${year}&status=eq.pending&refresh_due_at=lt.${startedAt}`,
  currentReview: `refresh_season=eq.${year}&status=eq.review`,
  pendingAll: 'status=eq.pending',
})) freshness[label] = (await query(`tennisrecord_crawl_queue?select=id&${filter}&limit=1`)).count

const annual = new Map()
let cursor = '', observations = 0, nonAnnualComputer = 0, unlinked = 0
for (;;) {
  const { rows } = await query('tennisrecord_ntrp_observations?select=id,canonical_player_id,ntrp,ntrp_label,effective_date&order=id.asc&limit=1000' + (cursor ? `&id=gt.${cursor}` : ''))
  for (const row of rows) {
    observations++
    if (!row.canonical_player_id) { unlinked++; continue }
    if (!/\bC\b/i.test(row.ntrp_label ?? '')) continue
    if (!/^\d{4}-12-31$/.test(row.effective_date ?? '')) { nonAnnualComputer++; continue }
    const season = Number(row.effective_date.slice(0, 4))
    const player = annual.get(row.canonical_player_id) ?? new Map()
    const levels = player.get(season) ?? new Set()
    levels.add(Number(row.ntrp)); player.set(season, levels); annual.set(row.canonical_player_id, player)
  }
  if (rows.length < 1000) break
  cursor = rows.at(-1).id
}
const transitions = {}, annualCounts = {}
let conflictingPlayerYears = 0
for (const seasons of annual.values()) {
  for (const [season, levels] of seasons) {
    annualCounts[season] = (annualCounts[season] ?? 0) + 1
    if (levels.size !== 1) { conflictingPlayerYears++; continue }
    const previous = seasons.get(season - 1)
    if (previous?.size !== 1) continue
    const delta = [...levels][0] - [...previous][0]
    const bucket = transitions[season] ?? { up: 0, stay: 0, down: 0 }
    bucket[delta > 0 ? 'up' : delta < 0 ? 'down' : 'stay']++
    transitions[season] = bucket
  }
}
const report = {
  startedAt, completedAt: new Date().toISOString(), freshness,
  settings: (await query('tennisrecord_collector_settings?select=enabled,automation_state,current_refresh_enabled,rating_recalculated_at&id=eq.true')).rows,
  ratingEvidence: { observations, unlinked, annualComputerPlayers: annual.size, nonAnnualComputer, conflictingPlayerYears, annualCounts, transitions },
  tennisRecordEstimateRows: (await query('tennisrecord_staged_players?select=id&published_rating=not.is.null&limit=1')).count,
  limitations: [
    'Annual labels are source-reported computer designations with December 31 effective dates, not independently verified USTA outcomes.',
    'Transitions measure label availability, not forecast accuracy; no model was trained or production rating changed.',
    'Current TennisRecord estimates and TiQ ratings cannot establish historical forecast accuracy without cutoff-safe provenance.',
    'Counts were read while ingestion was active and do not form a transactional snapshot.',
  ],
}
await mkdir('artifacts/rating-evidence', { recursive: true })
const path = `artifacts/rating-evidence/audit-${startedAt.replace(/[:.]/g, '-')}.json`
await writeFile(path, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ path, ...report }, null, 2))
