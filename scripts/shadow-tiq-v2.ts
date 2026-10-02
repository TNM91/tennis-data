import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { replayTiqV2, formatTiqV2Strength, tiqV2Band, type V2Match, type V2Prior } from '../lib/tiq-rating-v2'
import { yearEndDiagnosticEligibility } from '../lib/year-end-eligibility'
import { parseScoreMetrics, processSinglesMatch, processDoublesMatch, type WorkingPlayer, type RatingSnapshotInsert } from '../lib/recalculateRatings'

async function main() {
  const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3)
  const name = arg('player'), season = Number(arg('season')), cutoff = arg('cutoff')
  if (!name || !Number.isInteger(season) || !cutoff || !/^\d{4}-\d{2}-\d{2}$/.test(cutoff) || Number(cutoff.slice(0, 4)) !== season) throw new Error('Supply --player=Full Name --season=YYYY --cutoff=YYYY-MM-DD')
  type FrozenInput = { season: number; cutoff: string; capturedAt: string; player: { id: string; name: string; overall_rating: number | null; overall_dynamic_rating: number | null; singles_dynamic_rating: number | null; doubles_dynamic_rating: number | null }; priors: V2Prior[]; matches: V2Match[]; names: { id: string; name: string }[]; orientedScores: number }
  const inputPath = arg('input')
  const frozen = inputPath ? JSON.parse(await readFile(inputPath, 'utf8')) as FrozenInput : null
  if (frozen && (frozen.season !== season || frozen.cutoff !== cutoff || frozen.player.name !== name || !Array.isArray(frozen.priors) || !Array.isArray(frozen.matches))) throw new Error('Frozen input identity/window mismatch')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key && !frozen) throw new Error('SUPABASE_SERVICE_ROLE_KEY required')
  const db = createClient('https://pwxppfazbyourjrsutgx.supabase.co', key || 'offline-unused', { auth: { persistSession: false, autoRefreshToken: false } })
  const target = frozen ? { data: [frozen.player], error: null } : await db.from('players').select('id,name,overall_rating,overall_dynamic_rating,singles_dynamic_rating,doubles_dynamic_rating').eq('name', name)
  if (target.error) throw target.error
  if (target.data.length !== 1) throw new Error('Exactly one canonical player required; identity needs review')
  const player = target.data[0], priors: V2Prior[] = [...(frozen?.priors ?? [])]
  if (!frozen) for (let cursor: string | null = null; ;) {
    let query = db.from('tennisrecord_ntrp_observations').select('id,canonical_player_id,ntrp,source_url,effective_date').eq('designation', 'computer').eq('effective_date', `${season - 1}-12-31`).not('canonical_player_id', 'is', null).order('id').limit(1000)
    if (cursor) query = query.gt('id', cursor)
    const page = await query
    if (page.error) throw page.error
    for (const row of page.data) priors.push({ playerId: row.canonical_player_id!, level: Number(row.ntrp), season: season - 1, source: row.source_url, independentlyVerified: false })
    if (page.data.length < 1000) break
    cursor = page.data.at(-1)!.id
  }
  const manifest = arg('official-labels')
  if (manifest) {
    const supplied = JSON.parse(await readFile(manifest, 'utf8')) as { playerId: string; season: number; level: number; designation: string; sourceUrl: string; verified: boolean }[]
    if (!Array.isArray(supplied) || supplied.some(p => !p.verified || p.designation !== 'computer' || p.season !== season - 1 || !p.playerId || !/^https:\/\//.test(p.sourceUrl) || !Number.isFinite(p.level) || !Number.isInteger(p.level * 2) || p.level < 1.5 || p.level > 7)) throw new Error('Invalid independently verified prior manifest')
    const overrides = new Set(supplied.map(p => p.playerId))
    const retained = priors.filter(p => !overrides.has(p.playerId))
    priors.splice(0, priors.length, ...retained, ...supplied.map(p => ({ playerId: p.playerId, level: p.level, season: p.season, source: p.sourceUrl, independentlyVerified: true })))
  }
  const matches: V2Match[] = [...(frozen?.matches ?? [])]
  // Load the whole canonical window, not only the target's matches: opponents evolve chronologically too.
  if (!frozen) for (let cursor: string | null = null; ;) {
    let query = db.from('matches').select('id,match_date,match_type,score,winner_side,match_source,rating_eligible,league_name,created_at,source,external_match_id,match_players(player_id,side)').eq('rating_eligible', true).gte('match_date', `${season}-01-01`).lte('match_date', cutoff).order('id').limit(500)
    if (cursor) query = query.gt('id', cursor)
    const page = await query
    if (page.error) throw page.error
    for (const row of page.data) {
      const eligibility = yearEndDiagnosticEligibility(row.league_name || '', season)
      matches.push({ ...row, participants: row.match_players.map(p => ({ playerId: p.player_id, side: p.side })), ustaEligible: eligibility.eligible, eligibilityPolicy: eligibility.policy } as V2Match)
    }
    if (page.data.length < 500) break
    cursor = page.data.at(-1)!.id
    if (matches.length % 5000 === 0) console.log(JSON.stringify({ loadedMatches: matches.length }))
  }
  // Preserve reviewed court-side scores. Only exact, conflict-free winning source evidence may orient a raw winner-first result.
  const toOrient = matches.filter(m => (m as V2Match & { source?: string }).source === 'tennisrecord' && m.external_match_id?.startsWith('tennisrecord:') && m.winner_side === 'B' && !parseScoreMetrics(m.score, m.winner_side).parsed)
  const byId = new Map(toOrient.map(m => [m.id, m]))
  let orientedScores = frozen?.orientedScores ?? 0
  if (!frozen) for (let index = 0; index < toOrient.length; index += 100) {
    const aliases = await db.from('tennisrecord_canonical_matches').select('canonical_match_id,winning_observation_id').in('canonical_match_id', toOrient.slice(index, index + 100).map(m => m.id)).eq('winning_source', 'tennisrecord').eq('has_conflict', false)
    if (aliases.error) throw aliases.error
    const observationIds = [...new Set(aliases.data.map(a => a.winning_observation_id).filter(Boolean))]
    if (!observationIds.length) continue
    const observations = await db.from('tennisrecord_match_observations').select('id,source,score_text,winner_side').in('id', observationIds)
    if (observations.error) throw observations.error
    const byObservation = new Map(observations.data.map(o => [o.id, o]))
    for (const alias of aliases.data) {
      const match = byId.get(alias.canonical_match_id), observation = byObservation.get(alias.winning_observation_id)
      if (!match || match.scoreOrientation === 'winner-first' || !observation || observation.source !== 'tennisrecord' || observation.score_text !== match.score || observation.winner_side !== match.winner_side) continue
      if (!parseScoreMetrics(match.score.replace(/\b(\d+)\s*-\s*(\d+)\b/g, '$2-$1'), match.winner_side).parsed) continue
      match.scoreOrientation = 'winner-first'; match.scoreEvidenceId = observation.id; orientedScores++
    }
  }
  const replay = replayTiqV2({ season, startsOn: `${season}-01-01`, cutoff, priors, matches, explainPlayerId: player.id })
  const candidate = replay.players.find(p => p.playerId === player.id) ?? null
  // Compare v1 on precisely the same accepted playing-strength evidence and starting annual labels.
  // These are v1's native values; no unvalidated +0.5 conversion is applied.
  const legacy = new Map<string, WorkingPlayer>(replay.players.map(p => {
    const base = p.prior.level
    return [p.playerId, { id: p.playerId, name: p.playerId, hasVerifiedBaseline: true, baselineSource: 'verified', singlesBase: base, doublesBase: base, overallBase: base, singlesDynamic: base, doublesDynamic: base, overallDynamic: base, singlesUstaDynamic: base, doublesUstaDynamic: base, overallUstaDynamic: base, singlesMatchesProcessed: 0, doublesMatchesProcessed: 0, overallMatchesProcessed: 0, matchesProcessed: 0, lastMatchDate: null }]
  }))
  const accepted = new Set(replay.processedMatchIds), legacyTargetSnapshots: RatingSnapshotInsert[] = []
  for (const match of [...matches].sort((a, b) => a.match_date.localeCompare(b.match_date) || a.id.localeCompare(b.id))) {
    if (!accepted.has(match.id)) continue
    const oriented = match.scoreOrientation === 'winner-first' && match.winner_side === 'B' && match.scoreEvidenceId ? { ...match, score: match.score.replace(/\b(\d+)\s*-\s*(\d+)\b/g, '$2-$1') } : match
    const sides = (['A', 'B'] as const).map(side => match.participants.filter(p => p.side === side).map(p => legacy.get(p.playerId)!))
    const snapshots: RatingSnapshotInsert[] = []
    if (match.match_type === 'singles') processSinglesMatch(oriented, sides[0][0], sides[1][0], snapshots, 1)
    else processDoublesMatch(oriented, sides[0], sides[1], snapshots, 1)
    legacyTargetSnapshots.push(...snapshots.filter(s => s.player_id === player.id && s.track === 'tiq'))
  }
  const legacyTarget = legacy.get(player.id)
  const targetMatches = matches.filter(m => m.participants.some(p => p.playerId === player.id))
  const targetCourts = targetMatches.filter(m => (m.match_type === 'singles' && m.participants.length === 2) || (m.match_type === 'doubles' && m.participants.length === 4))
  const ids = [...new Set(targetCourts.flatMap(m => m.participants.map(p => p.playerId)))]
  const names: { id: string; name: string }[] = [...(frozen?.names ?? [])]
  if (!frozen) for (let i = 0; i < ids.length; i += 100) {
    const rows = await db.from('players').select('id,name').in('id', ids.slice(i, i + 100))
    if (rows.error) throw rows.error
    names.push(...rows.data)
  }
  const missingTargetPriors = names.filter(p => !replay.players.some(state => state.playerId === p.id))
  const evidenceHash = createHash('sha256').update(JSON.stringify({ priors, matches })).digest('hex')
  const report = {
    generatedAt: new Date().toISOString(), inputCapturedAt: frozen?.capturedAt ?? new Date().toISOString(), frozenInput: Boolean(frozen), season, cutoff, version: replay.version, config: replay.config, evidenceHash,
    productionWrites: 0, releaseEligible: false, annualProbabilities: null,
    baselineRows: priors.length, independentlyVerifiedPriors: priors.filter(p => p.independentlyVerified).length,
    canonicalMatchesLoaded: matches.length, targetCourtsLoaded: targetCourts.length, targetNonCourtEvents: targetMatches.length - targetCourts.length, orientedScores, processedMatches: replay.processedMatches, skipped: replay.skipped, conflictingPriors: replay.conflictingPriors.length,
    player, candidate, legacySameEvidence: legacyTarget ? { singles: legacyTarget.singlesDynamic, doubles: legacyTarget.doublesDynamic, overall: legacyTarget.overallDynamic, matches: legacyTarget.matchesProcessed, scale: 'v1-native' } : null,
    legacyTargetSnapshots, proposedDisplay: candidate ? { overall: formatTiqV2Strength(candidate.playing.overall.strength), band: tiqV2Band(candidate.playing.overall.strength), singles: formatTiqV2Strength(candidate.playing.singles.strength), doubles: formatTiqV2Strength(candidate.playing.doubles.strength) } : null,
    names, missingTargetPriors, explanations: replay.explanations, targetExclusions: replay.targetExclusions,
    limitations: ['Experimental response/variance parameters are not trained or independently validated.', 'Source-reported prior labels are not independently verified USTA outcomes.', 'Calendar-window reconstruction is retrospective, not a verified championship-year forecast.', 'All available canonical matches are replayed, but missing imports, conflicting priors and excluded scores leave the network incomplete.', 'Overall is weighted by processed format match counts; its behavior requires validation.', 'No confidence category or bump probability is inferred from the model variance.'],
  }
  const out = arg('out') || 'artifacts/rating-evidence'
  await mkdir(out, { recursive: true })
  const path = `${out}/tiq-v2-${player.id}-${cutoff}.json`
  await writeFile(`${out}/tiq-v2-input-${season}-${cutoff}.json`, JSON.stringify({ season, cutoff, capturedAt: report.inputCapturedAt, player, priors, matches, names, orientedScores }))
  await writeFile(path, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ path, player, candidate, proposedDisplay: report.proposedDisplay, canonicalMatchesLoaded: matches.length, processedMatches: replay.processedMatches, skipped: replay.skipped, targetExclusions: replay.targetExclusions, missingTargetPriors, releaseEligible: false }, null, 2))
}
main().catch(error => { console.error(error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? JSON.stringify({ message: error.message, code: 'code' in error ? error.code : null }) : String(error)); process.exitCode = 1 })
