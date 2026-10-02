import { expectedGameShare, parseScoreMetrics, processDoublesMatch, processSinglesMatch, type MatchRow, type WorkingPlayer } from './recalculateRatings'

export type Movement = 'down' | 'stay' | 'up'
export type AnnualLabel = { playerId: string; season: number; level: number; designation: string; sourceUrl: string; capturedAt: string }
export type ForecastMatch = MatchRow & { participants: { playerId: string; side: 'A' | 'B' }[]; sectionEligible: boolean }
export type ForecastVariant = 'existing' | 'band-center'
export type Forecast = { playerId: string; baseline: number; rating: number; matches: number; probabilities: Record<Movement, number> }

/** Conflicts are evidence for review, never a majority vote or "latest wins". */
export function annualLabelIndex(labels: AnnualLabel[]) {
  const groups = new Map<string, AnnualLabel[]>()
  for (const label of labels) {
    if (label.designation !== 'computer' || !Number.isFinite(label.level) || label.level < 1.5 || label.level > 7 || !Number.isInteger(label.level * 2)) continue
    const key = `${label.playerId}:${label.season}`
    groups.set(key, [...(groups.get(key) ?? []), label])
  }
  const valid = new Map<string, AnnualLabel>()
  const conflicts: { playerId: string; season: number; levels: number[]; sources: string[] }[] = []
  for (const [key, rows] of groups) {
    const levels = [...new Set(rows.map(row => row.level))]
    if (levels.length > 1) conflicts.push({ playerId: rows[0].playerId, season: rows[0].season, levels, sources: [...new Set(rows.map(row => row.sourceUrl))] })
    else valid.set(key, rows.reduce((first, row) => row.capturedAt < first.capturedAt ? row : first))
  }
  return { valid, conflicts }
}

export function ratingMovementProbabilities(rating: number, baseline: number, spread = 0.12) {
  if (!Number.isFinite(spread) || spread <= 0) throw new Error('Positive forecast spread required')
  const cdf = (boundary: number) => 1 / (1 + Math.exp((rating - boundary) / spread))
  const down = cdf(baseline - 0.5), up = 1 - cdf(baseline)
  return { down, stay: 1 - down - up, up }
}

export function replayYearEndForecast(input: {
  season: number; startsOn: string; cutoff: string; labels: AnnualLabel[]; matches: ForecastMatch[];
  variant: ForecastVariant; k?: number; spread?: number; minimumMatches?: number;
}) {
  const { valid, conflicts } = annualLabelIndex(input.labels)
  const players = new Map<string, WorkingPlayer>()
  for (const label of valid.values()) {
    // Starting level is the previous annual outcome, never this year's ending label.
    if (label.season !== input.season - 1) continue
    const base = label.level, initial = input.variant === 'band-center' ? base - 0.25 : base
    players.set(label.playerId, {
      id: label.playerId, name: label.playerId, hasVerifiedBaseline: true, baselineSource: 'verified',
      singlesBase: base, doublesBase: base, overallBase: base,
      singlesDynamic: initial, doublesDynamic: initial, overallDynamic: initial,
      singlesUstaDynamic: initial, doublesUstaDynamic: initial, overallUstaDynamic: initial,
      singlesMatchesProcessed: 0, doublesMatchesProcessed: 0, overallMatchesProcessed: 0, matchesProcessed: 0, lastMatchDate: null,
    })
  }
  const skipped: Record<string, number> = {}
  const skip = (reason: string) => { skipped[reason] = (skipped[reason] ?? 0) + 1 }
  const seen = new Set<string>()
  for (const match of [...input.matches].sort((a, b) => a.match_date.localeCompare(b.match_date) || a.id.localeCompare(b.id))) {
    if (seen.has(match.id)) continue
    seen.add(match.id)
    if (match.match_date < input.startsOn || match.match_date > input.cutoff) { skip('outside_cutoff'); continue }
    if (!match.sectionEligible || match.rating_eligible === false || match.match_source !== 'usta') { skip('eligibility_unconfirmed'); continue }
    if (/\b(?:default|walkover|retired|retirement|w\/o)\b/i.test(match.score)) { skip('special_score'); continue }
    const score = parseScoreMetrics(match.score, match.winner_side)
    if (!score.parsed || score.totalGames < 6) { skip('invalid_score'); continue }
    const sides = (['A', 'B'] as const).map(side => match.participants.filter(p => p.side === side).map(p => players.get(p.playerId)))
    const expected = match.match_type === 'singles' ? 1 : 2
    if (sides.some(side => side.length !== expected || side.some(p => !p)) || new Set(match.participants.map(p => p.playerId)).size !== expected * 2) { skip('missing_prior_or_participants'); continue }
    const [a, b] = sides as [WorkingPlayer[], WorkingPlayer[]]
    if (input.variant === 'existing') {
      if (expected === 1) processSinglesMatch(match, a[0], b[0], [], 1)
      else processDoublesMatch(match, a, b, [], 1)
    } else {
      const avg = (team: WorkingPlayer[]) => team.reduce((sum, p) => sum + p.overallDynamic, 0) / team.length
      const residual = score.totalGamesA / score.totalGames - expectedGameShare(avg(a), avg(b))
      // Score evidence moves both directions symmetrically; no annual-level floor.
      const delta = (input.k ?? 0.18) * residual
      for (const [team, change] of [[a, delta], [b, -delta]] as const) for (const player of team) {
        player.overallDynamic = Math.max(1.5, Math.min(7, player.overallDynamic + change))
        player.matchesProcessed++
      }
    }
  }
  const forecasts: Forecast[] = [...players.values()].filter(p => p.matchesProcessed >= (input.minimumMatches ?? 3)).map(p => ({
    playerId: p.id, baseline: p.overallBase, rating: p.overallDynamic, matches: p.matchesProcessed,
    probabilities: ratingMovementProbabilities(input.variant === 'existing' ? p.overallDynamic - 0.25 : p.overallDynamic, p.overallBase, input.spread),
  }))
  return { forecasts, skipped, conflicts, variant: input.variant }
}

export function evaluateMovement(rows: { probabilities: Record<Movement, number>; actual: Movement }[]) {
  const classes: Movement[] = ['down', 'stay', 'up']
  const confusion = Object.fromEntries(classes.map(c => [c, { down: 0, stay: 0, up: 0 }])) as Record<Movement, Record<Movement, number>>
  let correct = 0, brier = 0
  for (const row of rows) {
    const predicted = classes.reduce((best, c) => row.probabilities[c] > row.probabilities[best] ? c : best, 'stay')
    confusion[row.actual][predicted]++
    correct += Number(predicted === row.actual)
    brier += classes.reduce((sum, c) => sum + (row.probabilities[c] - Number(row.actual === c)) ** 2, 0)
  }
  const byClass = Object.fromEntries(classes.map(c => {
    const tp = confusion[c][c], predicted = classes.reduce((n, actual) => n + confusion[actual][c], 0), actual = classes.reduce((n, p) => n + confusion[c][p], 0)
    return [c, { support: actual, precision: predicted ? tp / predicted : 0, recall: actual ? tp / actual : 0, f1: actual + predicted ? 2 * tp / (actual + predicted) : 0 }]
  })) as Record<Movement, { support: number; precision: number; recall: number; f1: number }>
  return { count: rows.length, accuracy: rows.length ? correct / rows.length : null, brier: rows.length ? brier / rows.length : null, macroF1: rows.length ? classes.reduce((sum, c) => sum + byClass[c].f1, 0) / 3 : null, confusion, byClass }
}
