import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { replayRatingNetwork, type NetworkCourt } from '../lib/tiq-rating-network'
import { parseScoreMetrics } from '../lib/recalculateRatings'
import { tiqV2Band, type V2Match, type V2Prior } from '../lib/tiq-rating-v2'
type AnnualObservation = { canonical_player_id: string; ntrp: number; effective_date: string; designation: string }
async function main() {
  const inputPath = process.argv[2], out = process.argv[3]
  if (!inputPath || !out) throw new Error('Usage: evaluate-tiq-network-season.ts <frozen-input.json> <output.json>')
  const bytes = await readFile(inputPath)
  const graph: { season: number; priors: V2Prior[]; matches: V2Match[] } = JSON.parse(bytes.toString())
  const groups = new Map<string, Set<number>>()
  for (const prior of graph.priors) {
    if (prior.season !== graph.season - 1) continue
    const levels = groups.get(prior.playerId) ?? new Set<number>(); levels.add(prior.level); groups.set(prior.playerId, levels)
  }
  const priors = new Map([...groups].filter(([, values]) => values.size === 1).map(([id, values]) => [id, [...values][0]]))
  const signatures = new Map<string, string[]>(), seen = new Set<string>(), prepared: NetworkCourt[] = []
  for (const match of graph.matches) {
    if (seen.has(match.id) || !match.rating_eligible || !['usta', 'tiq_team', 'tiq_individual', 'tiq_tournament'].includes(match.match_source ?? '')) continue
    seen.add(match.id)
    const count = match.match_type === 'singles' ? 1 : match.match_type === 'doubles' ? 2 : 0
    if (!count || !['A', 'B'].includes(match.winner_side) || match.participants.length !== count * 2 || new Set(match.participants.map(p => p.playerId)).size !== count * 2 || ['A', 'B'].some(side => match.participants.filter(p => p.side === side).length !== count) || /\b(default|walkover|retired|retirement|w\/o)\b/i.test(match.score)) continue
    const text = match.scoreOrientation === 'winner-first' && match.winner_side === 'B' && match.scoreEvidenceId ? match.score.replace(/\b(\d+)\s*-\s*(\d+)\b/g, '$2-$1') : match.score
    const score = parseScoreMetrics(text, match.winner_side)
    if (!score.parsed || score.totalGames < 6) continue
    const signature = `${match.match_date}:${match.match_type}:${match.participants.map(p => p.playerId).sort().join(',')}:${text.replace(/\s|;/g, '')}`
    signatures.set(signature, [...(signatures.get(signature) ?? []), match.id])
    prepared.push({ id: match.id, date: match.match_date, format: match.match_type, participants: match.participants, actualGameShare: score.totalGamesA / score.totalGames })
  }
  const ambiguous = new Set([...signatures.values()].filter(ids => ids.length > 1).flat())
  const courts = prepared.filter(court => !ambiguous.has(court.id)), cutoff = `${graph.season}-10-31`
  // Reuse the 2026-selected network configuration without tuning it on this season.
  const network = replayRatingNetwork({ startsOn: `${graph.season}-01-01`, cutoff, priors, courts })
  const metrics = (rows: typeof network.predictions) => ({ courts: rows.length, networkMAE: rows.length ? rows.reduce((sum, p) => sum + Math.abs(p.expectedGameShare - p.actualGameShare), 0) / rows.length : null, equalMAE: rows.length ? rows.reduce((sum, p) => sum + Math.abs(0.5 - p.actualGameShare), 0) / rows.length : null })
  await writeFile(out.replace(/\.json$/, '-prepared-courts.json'), JSON.stringify({ season: graph.season, cutoff, priors: Object.fromEntries(priors), courts }))
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY, observations: AnnualObservation[] = []
  if (!key) throw new Error('Service key required for read-only secondary annual outcome audit')
  for (let offset = 0; ; offset += 1000) {
    const url = new URL('https://pwxppfazbyourjrsutgx.supabase.co/rest/v1/tennisrecord_ntrp_observations')
    url.search = new URLSearchParams({ select: 'canonical_player_id,ntrp,effective_date,designation', designation: 'eq.computer', effective_date: `eq.${graph.season}-12-31`, canonical_player_id: 'not.is.null', order: 'id', limit: '1000', offset: String(offset) }).toString()
    const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error(`Annual outcome audit failed: ${response.status}`)
    const rows: AnnualObservation[] = await response.json(); observations.push(...rows)
    if (rows.length < 1000) break
  }
  const endingGroups = new Map<string, Set<number>>()
  for (const observation of observations) {
    const values = endingGroups.get(observation.canonical_player_id) ?? new Set<number>(); values.add(Number(observation.ntrp)); endingGroups.set(observation.canonical_player_id, values)
  }
  const cohort = [...priors].flatMap(([playerId, startingLevel]) => {
    const ending = endingGroups.get(playerId), singles = network.states.get(`${playerId}:singles`), doubles = network.states.get(`${playerId}:doubles`), count = (singles?.matches ?? 0) + (doubles?.matches ?? 0)
    if (!ending || ending.size !== 1 || count < 3) return []
    const strength = ((singles?.strength ?? 0) * (singles?.matches ?? 0) + (doubles?.strength ?? 0) * (doubles?.matches ?? 0)) / count, endingLevel = [...ending][0]
    return [{ playerId, startingLevel, endingLevel, courts: count, strength, predictedBand: tiqV2Band(strength), actualMovement: Math.sign(endingLevel - startingLevel), predictedMovement: Math.sign(tiqV2Band(strength) - startingLevel) }]
  })
  const movement = (direction: number) => {
    const actual = cohort.filter(p => p.actualMovement === direction).length, predicted = cohort.filter(p => p.predictedMovement === direction).length, correct = cohort.filter(p => p.actualMovement === direction && p.predictedMovement === direction).length
    return { actual, predicted, correct, precision: predicted ? correct / predicted : null, recall: actual ? correct / actual : null }
  }
  const report = { generatedAt: new Date().toISOString(), inputSHA256: createHash('sha256').update(bytes).digest('hex'), productionWrites: 0, releaseEligible: false, season: graph.season, cutoff, config: network.config, datedPriorPlayers: priors.size, conflictingPriorPlayers: [...groups.values()].filter(values => values.size > 1).length, loadedCourtRows: graph.matches.length, parsedCourts: courts.length, quarantinedAmbiguousCourtRows: ambiguous.size, usableCourts: network.predictions.length, unanchoredCourts: network.skippedUnanchored.length, gameShare: metrics(network.predictions), formatGroups: { singles: metrics(network.predictions.filter(p => p.format === 'singles')), doubles: metrics(network.predictions.filter(p => p.format === 'doubles')) }, anchorDistanceGroups: Object.fromEntries([0, 1, 2, 3].map(distance => [distance === 3 ? '3+' : String(distance), metrics(network.predictions.filter(p => distance === 3 ? p.maximumAnchorDistance >= 3 : p.maximumAnchorDistance === distance))])), laterGameShare: metrics(network.predictions.filter(p => p.date >= `${graph.season}-08-01`)), secondaryAnnualLabelCohort: { players: cohort.length, classificationAccuracy: cohort.length ? cohort.filter(p => p.predictedMovement === p.actualMovement).length / cohort.length : null, noMovementBaselineAccuracy: cohort.length ? cohort.filter(p => p.actualMovement === 0).length / cohort.length : null, bumps: movement(1), stays: movement(0), drops: movement(-1) }, cohort, limitations: ['Historical cross-season stress test, not an independently timestamped prospective forecast.', 'Configuration selected on 2026 data; reused unchanged on 2025.', 'Annual labels are copied from TennisRecord and are not independently verified official USTA outcomes.', 'October calendar cutoff and all reviewed playing-strength sources do not establish USTA championship-year eligibility.', 'Minimum three courts is a descriptive cohort rule, not calibrated confidence.', 'Annual band crossing is a diagnostic hypothesis, not a validated forecasting rule.', 'Rows may still have unknown provenance issues or incomplete source history.'] }
  await writeFile(out, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ ...report, cohort: undefined }, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
