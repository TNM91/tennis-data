import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { replayRatingNetwork, type NetworkCourt, type NetworkPrediction, type NetworkConfig } from '../lib/tiq-rating-network'
import { parseScoreMetrics } from '../lib/recalculateRatings'
import type { V2Match } from '../lib/tiq-rating-v2'

type Graph = { matches: V2Match[]; player: { id: string; name: string } }
type Manifest = { eligiblePriorLevels: Record<string, number>; quarantinedMatchIds: string[] }
type Comparison = { summary: { meanAbsoluteDifference: number }; compared: { playerId: string; name: string; estimateDate: string; tiq: number; tennisRecordRaw: number; tennisRecordPlusHalf: number }[] }
type LegacyPrediction = { id: string; prediction: number; actual: number }
const metrics = (rows: NetworkPrediction[]) => ({
  courts: rows.length,
  mae: rows.length ? rows.reduce((sum, row) => sum + Math.abs(row.expectedGameShare - row.actualGameShare), 0) / rows.length : null,
  mse: rows.length ? rows.reduce((sum, row) => sum + (row.expectedGameShare - row.actualGameShare) ** 2, 0) / rows.length : null,
  equalMAE: rows.length ? rows.reduce((sum, row) => sum + Math.abs(0.5 - row.actualGameShare), 0) / rows.length : null,
})
async function main() {
  const root = process.argv[2]
  if (!root) throw new Error('Usage: evaluate-tiq-network.ts <evidence-directory> [--exclude-score-conflicts]')
  const graph: Graph = JSON.parse(await readFile(`${root}/input.json`, 'utf8'))
  const protocol: { candidatePath: string; candidateSHA256: string } = JSON.parse(await readFile(`${root}/validation-protocol.json`, 'utf8'))
  const bytes = await readFile(protocol.candidatePath)
  if (createHash('sha256').update(bytes).digest('hex') !== protocol.candidateSHA256) throw new Error('Sealed baseline changed')
  const frozen: Manifest = JSON.parse(bytes.toString()), priors = new Map(Object.entries(frozen.eligiblePriorLevels))
  const held = new Set(frozen.quarantinedMatchIds), seen = new Set<string>(), courts: NetworkCourt[] = [], leagueNames = new Map<string, string>(), skipped: Record<string, number> = {}
  const scoreReview = process.argv.includes('--exclude-score-conflicts')
  if (scoreReview) {
    const audit: { conflicts: { id: string }[] } = JSON.parse(await readFile(`${root}/network-score-consistency.json`, 'utf8'))
    for (const court of audit.conflicts) held.add(court.id)
  }
  const skip = (reason: string) => { skipped[reason] = (skipped[reason] ?? 0) + 1 }
  for (const match of graph.matches) {
    if (seen.has(match.id)) { skip('duplicate'); continue }
    seen.add(match.id)
    if (held.has(match.id)) { skip('quarantined'); continue }
    if (!match.rating_eligible || match.match_date < '2026-01-01' || match.match_date > '2026-10-02' || !['usta', 'tiq_team', 'tiq_individual', 'tiq_tournament'].includes(match.match_source ?? '')) { skip('window_or_eligibility'); continue }
    const n = match.match_type === 'singles' ? 1 : match.match_type === 'doubles' ? 2 : 0, participants = match.participants
    if (!n || !['A', 'B'].includes(match.winner_side) || participants.length !== 2 * n || new Set(participants.map(p => p.playerId)).size !== 2 * n || ['A', 'B'].some(side => participants.filter(p => p.side === side).length !== n)) { skip('identity_or_format'); continue }
    if (/\b(default|walkover|retired|retirement|w\/o)\b/i.test(match.score)) { skip('incomplete_score'); continue }
    const scoreText = match.scoreOrientation === 'winner-first' && match.winner_side === 'B' && match.scoreEvidenceId ? match.score.replace(/\b(\d+)\s*-\s*(\d+)\b/g, '$2-$1') : match.score
    const score = parseScoreMetrics(scoreText, match.winner_side)
    if (!score.parsed || score.totalGames < 6) { skip('unparsed_score'); continue }
    courts.push({ id: match.id, date: match.match_date, format: match.match_type, participants, actualGameShare: score.totalGamesA / score.totalGames })
    leagueNames.set(match.id, match.league_name ?? '')
  }
  const replay = (config: Partial<NetworkConfig> = {}, cutoff = '2026-10-02', shifts?: Map<string, number>) => replayRatingNetwork({ startsOn: '2026-01-01', cutoff, priors, courts, config, priorStrengthShifts: shifts })
  const summary = (result: ReturnType<typeof replay>) => {
    const rows = result.predictions, train = rows.filter(p => p.date <= '2026-05-31'), validation = rows.filter(p => p.date > '2026-05-31' && p.date <= '2026-07-31'), later = rows.filter(p => p.date > '2026-07-31')
    return { config: result.config, usableCourts: rows.length, unanchoredCourts: result.skippedUnanchored.length, train: metrics(train), validation: metrics(validation), later: metrics(later), laterSingles: metrics(later.filter(p => p.format === 'singles')), laterDoubles: metrics(later.filter(p => p.format === 'doubles')), laterExpanded: metrics(later.filter(p => !p.allParticipantsHavePriors)), laterMissouriNamedLeagues: metrics(later.filter(p => /Missouri Valley Missouri\b|\bSTL\b/i.test(leagueNames.get(p.id) ?? ''))), anchorDistanceGroups: Object.fromEntries([0, 1, 2, 3].map(distance => [distance === 3 ? '3+' : String(distance), metrics(later.filter(p => distance === 3 ? p.maximumAnchorDistance >= 3 : p.maximumAnchorDistance === distance))])) }
  }
  const candidates = [0.0324, 0.09, 0.25].map(unknownVariance => replay({ unknownVariance }))
  const selected = [...candidates].sort((a, b) => (summary(a).validation.mse ?? Infinity) - (summary(b).validation.mse ?? Infinity))[0]
  const partnerCandidates = [1, 0.75, 0.5].map(repeatedPartnerWeight => replay({ unknownVariance: selected.config.unknownVariance, repeatedPartnerWeight }))
  const partnerSelected = [...partnerCandidates].sort((a, b) => (summary(a).validation.mse ?? Infinity) - (summary(b).validation.mse ?? Infinity))[0]
  const old: { tuned: LegacyPrediction[] } = JSON.parse(await readFile(`${root}/expanded-tuning/heldout-predictions.json`, 'utf8')), oldMap = new Map(old.tuned.map(p => [p.id, p]))
  const common = selected.predictions.filter(p => p.date > '2026-07-31' && oldMap.has(p.id))
  const strength = (result: ReturnType<typeof replay>, playerId: string) => {
    const singles = result.states.get(`${playerId}:singles`), doubles = result.states.get(`${playerId}:doubles`), count = (singles?.matches ?? 0) + (doubles?.matches ?? 0)
    return { singles: singles?.strength ?? null, doubles: doubles?.strength ?? null, courts: count, overall: count ? ((singles?.strength ?? 0) * (singles?.matches ?? 0) + (doubles?.strength ?? 0) * (doubles?.matches ?? 0)) / count : null }
  }
  const sensitivity = [-0.25, 0, 0.25].map(shift => ({ startingShift: shift, ending: strength(replay(selected.config, '2026-10-02', new Map([[graph.player.id, shift]])), graph.player.id) }))
  const targetCourts = courts.filter(court => court.participants.some(p => p.playerId === graph.player.id))
  const leaveOneOut = targetCourts.map(court => ({ id: court.id, date: court.date, ending: strength(replayRatingNetwork({ startsOn: '2026-01-01', cutoff: '2026-10-02', priors, courts: courts.filter(c => c.id !== court.id), config: selected.config }), graph.player.id) }))
  const suffix = scoreReview ? '-score-review' : ''
  const limitations = ['Exploratory analysis of a partial 2026 season; later period has already been inspected.', 'Starting labels are mostly secondary-source annual observations, not independently verified USTA labels.', 'Unknown strengths are network estimates, never official labels.', 'Variance and descriptive evidence flags are not calibrated confidence.', 'Anchor distance measures initialization ancestry, not current graph connectivity or individual doubles identifiability.', 'Missouri subgroup uses league names, not independently verified geography or district eligibility.', 'No annual movement probabilities or production rating writes.']
  const report = { generatedAt: new Date().toISOString(), productionWrites: 0, releaseEligible: false, parsedCourts: courts.length, skipped, selection: 'June–July game-share MSE; later results remain diagnostic', candidates: candidates.map(summary), partnerWeightCandidates: partnerCandidates.map(summary), selectedConfig: selected.config, partnerSelectedConfig: partnerSelected.config, sameCourtLaterComparison: { courts: common.length, existingMAE: common.reduce((sum, p) => sum + Math.abs(oldMap.get(p.id)!.prediction - p.actualGameShare), 0) / common.length, networkMAE: metrics(common).mae }, nathan: strength(selected, graph.player.id), nathanStartingPriorSensitivity: sensitivity, nathanLeaveOneCourtOut: leaveOneOut, limitations }
  const tr: Comparison = JSON.parse(await readFile(`${root}/tennisrecord-comparison.json`, 'utf8')), snapshots = new Map<string, ReturnType<typeof replay>>()
  const paired = tr.compared.map(player => {
    if (!snapshots.has(player.estimateDate)) snapshots.set(player.estimateDate, replay(selected.config, player.estimateDate))
    const result = strength(snapshots.get(player.estimateDate)!, player.playerId)
    return { name: player.name, playerId: player.playerId, estimateDate: player.estimateDate, existingTIQ: player.tiq, networkTIQ: result.overall, supportedCourts: result.courts, trRaw: player.tennisRecordRaw, trPlusHalf: player.tennisRecordPlusHalf, difference: result.overall === null ? null : result.overall - player.tennisRecordPlusHalf }
  }).filter(player => player.networkTIQ !== null)
  const trReport = { generatedAt: new Date().toISOString(), productionWrites: 0, players: paired.length, existingMeanAbsoluteDifference: tr.summary.meanAbsoluteDifference, networkMeanAbsoluteDifference: paired.reduce((sum, player) => sum + Math.abs(player.difference!), 0) / paired.length, networkMeanDifference: paired.reduce((sum, player) => sum + player.difference!, 0) / paired.length, rows: paired, limitations: limitations.concat(['TR +0.5 remains an unvalidated display convention; agreement does not establish accuracy.', 'Historical graph and lineup availability have not been independently frozen at measurement dates.']) }
  await writeFile(`${root}/network-tennisrecord-comparison${suffix}.json`, JSON.stringify(trReport, null, 2))
  await writeFile(`${root}/network-recovery-experiment${suffix}.json`, JSON.stringify(report, null, 2))
  if (process.argv.includes('--freeze')) {
    const frozenAt = new Date().toISOString()
    const states = Object.fromEntries([...selected.states].map(([id, state]) => [id, { ...state, partners: [...state.partners], opponents: [...state.opponents], playingDays: [...state.playingDays] }]))
    const candidate = { version: 'tiq-network-shadow-2026-10-02', frozenAt, cutoff: '2026-10-02', productionWrites: 0, releaseEligible: false, purpose: 'Playing-strength and game-share evaluation only', config: selected.config, inputSHA256: createHash('sha256').update(await readFile(`${root}/input.json`)).digest('hex'), baselineCandidateSHA256: protocol.candidateSHA256, eligiblePriorLevels: frozen.eligiblePriorLevels, quarantinedMatchIds: [...held], states, limitations }
    const candidatePath = `${root}/network-candidate-${frozenAt.replace(/[:.]/g, '-')}.json`
    await writeFile(candidatePath, JSON.stringify(candidate), { flag: 'wx' })
    const candidateSHA256 = createHash('sha256').update(await readFile(candidatePath)).digest('hex')
    await writeFile(`${root}/network-candidate-receipt-${frozenAt.replace(/[:.]/g, '-')}.json`, JSON.stringify({ candidatePath, candidateSHA256, frozenAt, config: selected.config, productionWrites: 0, releaseEligible: false }, null, 2), { flag: 'wx' })
    console.log(JSON.stringify({ candidatePath, candidateSHA256, frozenAt }))
  }
  console.log(JSON.stringify({ parsedCourts: courts.length, selected: summary(selected), partnerSelected: summary(partnerSelected), sameCourtLaterComparison: report.sameCourtLaterComparison, nathan: report.nathan, sensitivity, trGap: trReport.networkMeanAbsoluteDifference }, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 })

