import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { annualLabelIndex, evaluateMovement, ratingMovementProbabilities, replayYearEndForecast, type AnnualLabel, type ForecastMatch, type Movement } from '../lib/year-end-forecast'

async function main() {
  const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3)
  const season = Number(arg('season')), startsOn = arg('starts-on'), cutoff = arg('cutoff')
  if (!Number.isInteger(season) || !startsOn || !cutoff || !/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(cutoff) || startsOn > cutoff) throw new Error('Supply --season=YYYY --starts-on=YYYY-MM-DD --cutoff=YYYY-MM-DD. Partial windows are diagnostics, not full-season validation.')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY required')
  const db = createClient('https://pwxppfazbyourjrsutgx.supabase.co', key, { auth: { persistSession: false, autoRefreshToken: false } })
  type Observation = { id: string; canonical_player_id: string | null; ntrp: number; designation: string; effective_date: string | null; source_url: string; first_seen_at: string }
  const observations: Observation[] = []
  let cursor: string | null = null
  for (;;) {
    let query = db.from('tennisrecord_ntrp_observations').select('id,canonical_player_id,ntrp,designation,effective_date,source_url,first_seen_at').eq('designation', 'computer').gte('effective_date', `${season - 1}-01-01`).lte('effective_date', `${season}-12-31`).order('id').limit(1000)
    if (cursor) query = query.gt('id', cursor)
    const { data, error } = await query
    if (error) throw error
    observations.push(...data)
    if (data.length < 1000) break
    cursor = data.at(-1)!.id
  }
  const labels: AnnualLabel[] = observations.filter(row => row.canonical_player_id && row.effective_date?.endsWith('-12-31')).map(row => ({ playerId: row.canonical_player_id!, season: Number(row.effective_date!.slice(0, 4)), level: Number(row.ntrp), designation: row.designation, sourceUrl: row.source_url, capturedAt: row.first_seen_at }))
  let officialLabels = 0
  const officialPath = arg('official-labels')
  if (officialPath) {
    const supplied: Array<AnnualLabel & { verified: boolean }> = JSON.parse(await readFile(officialPath, 'utf8'))
    for (const row of supplied) {
      const source = new URL(row.sourceUrl)
      if (!row.verified || !(source.hostname === 'usta.com' || source.hostname.endsWith('.usta.com')) || !row.playerId || !Number.isInteger(row.season) || !Number.isInteger(row.level * 2) || row.level < 1.5 || row.level > 7 || row.designation !== 'computer' || !row.capturedAt) throw new Error('Official manifest requires verified annual computer labels, canonical identity, capture date and primary USTA source.')
    }
    const overrides = new Set(supplied.map(row => `${row.playerId}:${row.season}`))
    const retained = labels.filter(row => !overrides.has(`${row.playerId}:${row.season}`))
    labels.splice(0, labels.length, ...retained, ...supplied)
    officialLabels = supplied.length
  }
  const { valid, conflicts } = annualLabelIndex(labels)
  const priorPlayers = [...new Set([...valid.values()].filter(row => row.season === season - 1).map(row => row.playerId))]
  const paired = [...valid.values()].filter(row => row.season === season && valid.has(`${row.playerId}:${season - 1}`))
  const matchIds = new Set<string>()
  for (let index = 0; index < priorPlayers.length; index += 100) for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('match_players').select('match_id').in('player_id', priorPlayers.slice(index, index + 100)).order('match_id').range(offset, offset + 999)
    if (error) throw error
    data.forEach(row => matchIds.add(row.match_id))
    if (data.length < 1000) break
  }
  const matches: ForecastMatch[] = []
  const ids = [...matchIds]
  for (let index = 0; index < ids.length; index += 100) {
    const { data, error } = await db.from('matches').select('id,match_date,match_type,score,winner_side,match_source,rating_eligible,league_name,flight,match_players(player_id,side)').in('id', ids.slice(index, index + 100)).eq('rating_eligible', true).eq('match_source', 'usta').gte('match_date', startsOn).lte('match_date', cutoff)
    if (error) throw error
    for (const row of data) {
      const sectionEligible = /\badult\b/i.test(row.league_name || '') && !/\b(?:mixed|tri[-\s]?level|combo|tournament)\b/i.test(row.league_name || '')
      if (!['singles', 'doubles'].includes(row.match_type) || !['A', 'B'].includes(row.winner_side)) continue
      matches.push({ ...row, participants: row.match_players.map(p => ({ playerId: p.player_id, side: p.side })), sectionEligible } as ForecastMatch)
    }
  }
  const actual = new Map(paired.map(label => {
    const delta = label.level - valid.get(`${label.playerId}:${season - 1}`)!.level
    return [label.playerId, delta > 0 ? 'up' : delta < 0 ? 'down' : 'stay'] as [string, Movement]
  }))
  const input = { season, startsOn, cutoff, labels, matches }
  const existing = replayYearEndForecast({ ...input, variant: 'existing' })
  const candidate = replayYearEndForecast({ ...input, variant: 'band-center' })
  const existingMap = new Map(existing.forecasts.map(row => [row.playerId, row]))
  const cohort = candidate.forecasts.filter(row => actual.has(row.playerId) && existingMap.has(row.playerId))
  const evaluate = (model: 'existing' | 'candidate' | 'stay') => evaluateMovement(cohort.map(row => ({ actual: actual.get(row.playerId)!, probabilities: model === 'stay' ? { down: 0, stay: 1, up: 0 } : model === 'candidate' ? row.probabilities : existingMap.get(row.playerId)!.probabilities })))
  // Page every archived estimate, then select the latest per player on the same cutoff.
  const sourceByPlayer = new Map<string, Record<Movement, number>>()
  let archiveAvailable = true
  for (let offset = 0; ; offset += 1000) {
    const archived = await db.from('tennisrecord_estimate_observations').select('id,canonical_player_id,estimate,estimate_date,captured_at,projected_level').lte('captured_at', cutoff + 'T23:59:59Z').gte('captured_at', startsOn).order('captured_at', { ascending: false }).order('id').range(offset, offset + 999)
    if (archived.error) {
      if (!['42P01', 'PGRST205'].includes(archived.error.code)) throw archived.error
      archiveAvailable = false; break
    }
    for (const row of archived.data) {
      if (!row.canonical_player_id || sourceByPlayer.has(row.canonical_player_id) || !row.estimate_date || row.estimate_date > cutoff || row.estimate_date < startsOn) continue
      const baseline = valid.get(`${row.canonical_player_id}:${season - 1}`)?.level
      if (!baseline) continue
      const delta = row.projected_level === null ? null : Number(row.projected_level) - baseline
      sourceByPlayer.set(row.canonical_player_id, delta === null ? ratingMovementProbabilities(Number(row.estimate), baseline) : { down: Number(delta < 0), stay: Number(delta === 0), up: Number(delta > 0) })
    }
    if (archived.data.length < 1000) break
  }
  const threeWay = cohort.filter(row => sourceByPlayer.has(row.playerId))
  const report = {
    createdAt: new Date().toISOString(), season, startsOn, cutoff, pairedLabels: paired.length, usableMatchedPlayers: cohort.length,
    matchesLoaded: matches.length, priorPlayers: priorPlayers.length, conflictingPlayerYears: conflicts.length, officialLabels,
    existing: evaluate('existing'), candidate: evaluate('candidate'), noMovement: evaluate('stay'), skipped: candidate.skipped,
    tennisRecord: { archiveAvailable, matchedPlayers: threeWay.length,
      source: evaluateMovement(threeWay.map(row => ({ actual: actual.get(row.playerId)!, probabilities: sourceByPlayer.get(row.playerId)! }))),
      candidate: evaluateMovement(threeWay.map(row => ({ actual: actual.get(row.playerId)!, probabilities: row.probabilities }))),
      existing: evaluateMovement(threeWay.map(row => ({ actual: actual.get(row.playerId)!, probabilities: existingMap.get(row.playerId)!.probabilities }))),
    },
    releaseEligible: false,
    limitations: [
      'Source-reported labels require independent USTA verification; official manifests explicitly override lower-authority labels.',
      'Retrospective event-time reconstruction uses facts recovered later and is not contemporaneous forecast accuracy.',
      'Missing opponent priors exclude matches and can bias the remaining cohort.',
      'Existing engine excludes future recency and inactivity; both probability mappings and candidate parameters are experimental.',
      'TennisRecord estimates must be captured before cutoff; current metadata is never substituted for historical data.',
      'Section eligibility, verified championship boundaries, multiple training/validation seasons, geographic holdouts and confidence intervals are release prerequisites.',
    ],
  }
  const out = arg('out') || 'artifacts/rating-evidence'
  await mkdir(out, { recursive: true })
  await writeFile(`${out}/backtest-${season}.json`, JSON.stringify(report, null, 2) + '\n')
  await writeFile(`${out}/conflicts-${season}.json`, JSON.stringify(conflicts, null, 2) + '\n')
  await writeFile(`${out}/reconstruction-${season}.json`, JSON.stringify({ labels, matches, forecasts: { existing: existing.forecasts, candidate: candidate.forecasts } }, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
