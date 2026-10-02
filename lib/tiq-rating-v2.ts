import { expectedGameShare, parseScoreMetrics, type MatchRow } from './recalculateRatings'

export const TIQ_V2_VERSION = 'tiq-band-v2-shadow-1'
export const TIQ_V2_CONFIG = Object.freeze({ priorVariance: 0.0324, observationVariance: 0.09, processVariance: 0.0004, response: 0.35, minimumGames: 6 })
type Format = 'singles' | 'doubles'
type Track = 'playing' | 'usta'
type Estimate = { strength: number; variance: number; matches: number }
export type V2Prior = { playerId: string; level: number; season: number; source: string; independentlyVerified: boolean }
export type V2Match = MatchRow & { participants: { playerId: string; side: 'A' | 'B' }[]; ustaEligible: boolean; eligibilityPolicy: string; scoreOrientation?: 'side-a' | 'winner-first'; scoreEvidenceId?: string }
type State = { prior: V2Prior; playing: Record<Format, Estimate>; usta: Record<Format, Estimate> }
const bounded = (n: number) => Math.max(1.5, Math.min(7, n))
const priorEstimate = (level: number): Estimate => ({ strength: bounded(level + 0.25), variance: TIQ_V2_CONFIG.priorVariance, matches: 0 })

/** Band classification uses full precision; formatting must never imply a false crossing. */
export function tiqV2Band(strength: number) {
  if (!Number.isFinite(strength) || strength < 1.5 || strength > 7) throw new Error('Invalid v2 strength')
  return Math.floor(strength * 2) / 2
}
export function formatTiqV2Strength(strength: number) {
  const band = tiqV2Band(strength)
  // Round within the actual band; e.g. 4.999 cannot display as a crossed 5.00.
  return (band === 7 ? 7 : Math.min(Number(strength.toFixed(2)), band + 0.49)).toFixed(2)
}
function overall(formats: Record<Format, Estimate>, level: number) {
  const count = formats.singles.matches + formats.doubles.matches
  if (!count) return { strength: bounded(level + 0.25), matches: 0 }
  return { strength: (formats.singles.strength * formats.singles.matches + formats.doubles.strength * formats.doubles.matches) / count, matches: count }
}
export type V2Explanation = {
  matchId: string; date: string; format: Format; track: Track; source: string | null; eligibilityPolicy: string;
  participants: { playerId: string; side: 'A' | 'B'; preMatchStrength: number }[];
  actualGameShare: number; expectedGameShare: number; before: number; after: number; adjustment: number; evidenceGain: number;
  originalScore: string; processedScore: string; scoreEvidenceId: string | null;
}

/** Pure chronological shadow replay. No DB writes, annual floors, future-relative weighting or forecast probabilities. */
export function replayTiqV2(input: { season: number; startsOn: string; cutoff: string; priors: V2Prior[]; matches: V2Match[]; explainPlayerId?: string }) {
  const grouped = new Map<string, V2Prior[]>()
  for (const prior of input.priors) {
    if (prior.season !== input.season - 1 || !Number.isFinite(prior.level) || prior.level < 1.5 || prior.level > 7 || !Number.isInteger(prior.level * 2)) continue
    grouped.set(prior.playerId, [...(grouped.get(prior.playerId) ?? []), prior])
  }
  const states = new Map<string, State>(), conflictingPriors: string[] = []
  for (const [id, priors] of grouped) {
    if (new Set(priors.map(p => p.level)).size !== 1) { conflictingPriors.push(id); continue }
    const prior = priors.find(p => p.independentlyVerified) ?? priors[0]
    states.set(id, { prior, playing: { singles: priorEstimate(prior.level), doubles: priorEstimate(prior.level) }, usta: { singles: priorEstimate(prior.level), doubles: priorEstimate(prior.level) } })
  }
  const skipped: Record<string, number> = {}, targetExclusions: { matchId: string; reason: string }[] = [], explanations: V2Explanation[] = [], seen = new Set<string>()
  let processedMatches = 0
  const processedMatchIds: string[] = []
  const skip = (match: V2Match, reason: string) => {
    skipped[reason] = (skipped[reason] ?? 0) + 1
    if (match.participants.some(p => p.playerId === input.explainPlayerId)) targetExclusions.push({ matchId: match.id, reason })
  }
  for (const match of [...input.matches].sort((a, b) => a.match_date.localeCompare(b.match_date) || a.id.localeCompare(b.id))) {
    if (seen.has(match.id)) { skip(match, 'duplicate'); continue }
    seen.add(match.id)
    if (match.match_date < input.startsOn || match.match_date > input.cutoff) { skip(match, 'outside_window'); continue }
    if (match.rating_eligible !== true || !['usta', 'tiq_team', 'tiq_individual', 'tiq_tournament'].includes(match.match_source ?? '')) { skip(match, 'unreviewed_or_unknown_source'); continue }
    if (!['singles', 'doubles'].includes(match.match_type) || !['A', 'B'].includes(match.winner_side)) { skip(match, 'invalid_format_or_winner'); continue }
    if (/\b(?:default|walkover|retired|retirement|w\/o)\b/i.test(match.score)) { skip(match, 'incomplete_score'); continue }
    const processedScore = match.scoreOrientation === 'winner-first' && match.winner_side === 'B' && match.scoreEvidenceId
      ? match.score.replace(/\b(\d+)\s*-\s*(\d+)\b/g, '$2-$1') : match.score
    const score = parseScoreMetrics(processedScore, match.winner_side)
    if (!score.parsed || score.totalGames < TIQ_V2_CONFIG.minimumGames) { skip(match, 'invalid_score'); continue }
    const expectedCount = match.match_type === 'singles' ? 1 : 2
    const sides = (['A', 'B'] as const).map(side => match.participants.filter(p => p.side === side))
    if (sides.some(side => side.length !== expectedCount) || match.participants.length !== expectedCount * 2 || new Set(match.participants.map(p => p.playerId)).size !== expectedCount * 2) { skip(match, 'invalid_participants'); continue }
    if (match.participants.some(p => !states.has(p.playerId))) { skip(match, 'missing_or_conflicting_prior'); continue }
    for (const track of ['playing', 'usta'] as const) {
      if (track === 'usta' && (match.match_source !== 'usta' || !match.ustaEligible)) continue
      const pre = match.participants.map(p => ({ ...p, preMatchStrength: states.get(p.playerId)![track][match.match_type].strength }))
      const average = (side: 'A' | 'B') => pre.filter(p => p.side === side).reduce((sum, p) => sum + p.preMatchStrength, 0) / expectedCount
      const expectedA = expectedGameShare(average('A'), average('B')), actualA = score.totalGamesA / score.totalGames
      // All updates use the same pre-match state; no winner-first mutation bias.
      for (const participant of pre) {
        const estimate = states.get(participant.playerId)![track][match.match_type]
        const variance = estimate.variance + TIQ_V2_CONFIG.processVariance
        const gain = variance / (variance + TIQ_V2_CONFIG.observationVariance)
        const actual = participant.side === 'A' ? actualA : 1 - actualA, expected = participant.side === 'A' ? expectedA : 1 - expectedA
        const before = estimate.strength
        estimate.strength = bounded(before + TIQ_V2_CONFIG.response * gain * (actual - expected))
        estimate.variance = Math.max(0.0001, (1 - gain) * variance)
        estimate.matches++
        if (participant.playerId === input.explainPlayerId) explanations.push({ matchId: match.id, date: match.match_date, format: match.match_type, track, source: match.match_source ?? null, eligibilityPolicy: match.eligibilityPolicy, participants: pre, actualGameShare: actual, expectedGameShare: expected, before, after: estimate.strength, adjustment: estimate.strength - before, evidenceGain: gain, originalScore: match.score, processedScore, scoreEvidenceId: match.scoreEvidenceId ?? null })
      }
    }
    processedMatches++
    processedMatchIds.push(match.id)
  }
  const players = [...states].map(([playerId, state]) => ({ playerId, prior: state.prior, playing: { ...state.playing, overall: overall(state.playing, state.prior.level) }, usta: { ...state.usta, overall: overall(state.usta, state.prior.level) } }))
  return { version: TIQ_V2_VERSION, config: TIQ_V2_CONFIG, releaseEligible: false, probabilities: null, processedMatches, processedMatchIds, skipped, conflictingPriors, players, explanations, targetExclusions }
}
