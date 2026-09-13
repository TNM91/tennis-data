import type { CaptainScorecardInput } from './captain-scorecard'

export type CaptainPredictionSnapshot = {
  id: string
  created_at?: string | null
  scenario_name?: string | null
  projected_team_win_pct: number | null
  projected_score_for: number | null
  projected_score_against: number | null
  confidence_score?: number | null
  confidence_tier?: string | null
  slots_json: unknown
  opponent_slots_json: unknown
  line_projections_json: unknown
}

export type CaptainCalibrationCourt = {
  label: string
  projectedWinPct: number | null
  actualOutcome: 'won' | 'lost'
  predictionCorrect: boolean | null
  teamPlayersMatched: number
  teamPlayersTotal: number
  opponentPlayersMatched: number
  opponentPlayersTotal: number
}

export type CaptainCalibrationSignal = {
  id: 'ratings' | 'court-history' | 'pair-fit' | 'opponent-placement' | 'lineup-change'
  label: string
  direction: 'trust' | 'watch' | 'learn'
  detail: string
}

export type CaptainLineupCalibration = {
  snapshotId: string
  snapshotCreatedAt: string | null
  scenarioName: string
  projectedTeamWinPct: number | null
  projectedScoreFor: number | null
  projectedScoreAgainst: number | null
  actualScoreFor: number
  actualScoreAgainst: number
  actualOutcome: 'won' | 'lost' | 'split'
  teamPredictionCorrect: boolean | null
  exactScoreCorrect: boolean | null
  courtPredictionAccuracy: number | null
  brierScore: number | null
  lineupAdherence: number
  opponentPlacementAccuracy: number
  courts: CaptainCalibrationCourt[]
  signals: CaptainCalibrationSignal[]
  headline: string
  summary: string
}

type SnapshotSlot = {
  label: string
  players: string[]
}

type SnapshotLineProjection = {
  label: string
  projection: number | null
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function key(value: unknown) {
  return clean(value).toLocaleLowerCase()
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeProbability(value: unknown) {
  const parsed = numberOrNull(value)
  if (parsed === null) return null
  const normalized = parsed > 1 ? parsed / 100 : parsed
  return Math.max(0, Math.min(1, normalized))
}

function normalizeSlots(value: unknown): SnapshotSlot[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object') return []
    const item = entry as Record<string, unknown>
    const rawPlayers = Array.isArray(item.players) ? item.players : []
    const players = rawPlayers.flatMap((player) => {
      if (!player || typeof player !== 'object') return []
      const name = clean((player as Record<string, unknown>).playerName)
      return name ? [name] : []
    })
    return [{ label: clean(item.label) || `Court ${index + 1}`, players }]
  })
}

function normalizeLineProjections(value: unknown): SnapshotLineProjection[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object') return []
    const item = entry as Record<string, unknown>
    return [{
      label: clean(item.label) || `Court ${index + 1}`,
      projection: normalizeProbability(item.projection),
    }]
  })
}

function findByLabelOrIndex<T extends { label: string }>(items: T[], label: string, index: number) {
  return items.find((item) => key(item.label) === key(label)) ?? items[index] ?? null
}

function countNameMatches(actual: string[], projected: string[]) {
  const projectedKeys = new Set(projected.map(key).filter(Boolean))
  return actual.map(key).filter((name) => name && projectedKeys.has(name)).length
}

function rounded(value: number, places = 3) {
  const multiplier = 10 ** places
  return Math.round(value * multiplier) / multiplier
}

export function buildCaptainLineupCalibration(
  snapshot: CaptainPredictionSnapshot,
  input: CaptainScorecardInput,
): CaptainLineupCalibration {
  const teamSlots = normalizeSlots(snapshot.slots_json)
  const opponentSlots = normalizeSlots(snapshot.opponent_slots_json)
  const projections = normalizeLineProjections(snapshot.line_projections_json)
  const actualScoreFor = input.lines.filter((line) => line.outcome === 'team').length
  const actualScoreAgainst = input.lines.length - actualScoreFor
  const actualOutcome = actualScoreFor === actualScoreAgainst ? 'split' : actualScoreFor > actualScoreAgainst ? 'won' : 'lost'
  const projectedTeamWinPct = normalizeProbability(snapshot.projected_team_win_pct)
  const projectedOutcome = projectedTeamWinPct === null ? null : projectedTeamWinPct >= 0.5 ? 'won' : 'lost'
  const teamPredictionCorrect = actualOutcome === 'split' || !projectedOutcome ? null : projectedOutcome === actualOutcome
  const exactScoreCorrect = snapshot.projected_score_for === null || snapshot.projected_score_against === null
    ? null
    : snapshot.projected_score_for === actualScoreFor && snapshot.projected_score_against === actualScoreAgainst

  let totalTeamPlayers = 0
  let matchedTeamPlayers = 0
  let totalOpponentPlayers = 0
  let matchedOpponentPlayers = 0
  const brierValues: number[] = []
  const courts = input.lines.map((line, index): CaptainCalibrationCourt => {
    const label = clean(line.label) || `${line.matchType === 'doubles' ? 'Doubles' : 'Singles'} ${line.courtNumber}`
    const projectedTeamSlot = findByLabelOrIndex(teamSlots, label, index)
    const projectedOpponentSlot = findByLabelOrIndex(opponentSlots, label, index)
    const lineProjection = findByLabelOrIndex(projections, label, index)
    const projectedWinPct = lineProjection?.projection ?? null
    const actualValue = line.outcome === 'team' ? 1 : 0
    if (projectedWinPct !== null) brierValues.push((projectedWinPct - actualValue) ** 2)

    const teamPlayers = line.teamPlayers.map(clean).filter(Boolean)
    const opponentPlayers = line.opponentPlayers.map(clean).filter(Boolean)
    const teamPlayersMatched = countNameMatches(teamPlayers, projectedTeamSlot?.players ?? [])
    const opponentPlayersMatched = countNameMatches(opponentPlayers, projectedOpponentSlot?.players ?? [])
    totalTeamPlayers += teamPlayers.length
    matchedTeamPlayers += teamPlayersMatched
    totalOpponentPlayers += opponentPlayers.length
    matchedOpponentPlayers += opponentPlayersMatched

    return {
      label,
      projectedWinPct,
      actualOutcome: line.outcome === 'team' ? 'won' : 'lost',
      predictionCorrect: projectedWinPct === null ? null : (projectedWinPct >= 0.5) === (line.outcome === 'team'),
      teamPlayersMatched,
      teamPlayersTotal: teamPlayers.length,
      opponentPlayersMatched,
      opponentPlayersTotal: opponentPlayers.length,
    }
  })

  const scoredCourts = courts.filter((court) => court.predictionCorrect !== null)
  const correctCourts = scoredCourts.filter((court) => court.predictionCorrect).length
  const courtPredictionAccuracy = scoredCourts.length ? rounded(correctCourts / scoredCourts.length) : null
  const brierScore = brierValues.length ? rounded(brierValues.reduce((sum, value) => sum + value, 0) / brierValues.length) : null
  const lineupAdherence = totalTeamPlayers ? rounded(matchedTeamPlayers / totalTeamPlayers) : 0
  const opponentPlacementAccuracy = totalOpponentPlayers ? rounded(matchedOpponentPlayers / totalOpponentPlayers) : 0

  const signals: CaptainCalibrationSignal[] = []
  if (lineupAdherence < 0.75) {
    signals.push({ id: 'lineup-change', label: 'Lineup changes', direction: 'watch', detail: 'The played lineup differed materially from the saved recommendation, so this result is weaker evidence about the builder itself.' })
  } else if (lineupAdherence === 1) {
    signals.push({ id: 'lineup-change', label: 'Lineup execution', direction: 'trust', detail: 'The recommended lineup reached the court unchanged, giving TiQ a clean prediction test.' })
  }
  if (opponentPlacementAccuracy < 0.5) {
    signals.push({ id: 'opponent-placement', label: 'Opponent placement', direction: 'learn', detail: 'The opponent stacked courts differently than projected. Future reads should give this team’s placement patterns more weight.' })
  } else if (totalOpponentPlayers) {
    signals.push({ id: 'opponent-placement', label: 'Opponent placement', direction: 'trust', detail: 'The opponent court projection closely matched who actually played.' })
  }
  const confidentMisses = courts.filter((court) => court.predictionCorrect === false && court.projectedWinPct !== null && Math.abs(court.projectedWinPct - 0.5) >= 0.15)
  if (confidentMisses.length) {
    signals.push({ id: 'ratings', label: 'Ratings signal', direction: 'learn', detail: `${confidentMisses.map((court) => court.label).join(', ')} beat a confident projection. Rating and recent-form inputs need review before gaining more weight.` })
  } else if (scoredCourts.length && correctCourts === scoredCourts.length) {
    signals.push({ id: 'ratings', label: 'Ratings signal', direction: 'trust', detail: 'Every court direction matched the result, supporting the current rating and court-history blend.' })
  } else {
    signals.push({ id: 'court-history', label: 'Court history', direction: 'watch', detail: 'The mixed court result should add evidence, but not trigger a weight change by itself.' })
  }
  if (input.lines.some((line) => line.matchType === 'doubles')) {
    signals.push({ id: 'pair-fit', label: 'Pair chemistry', direction: 'watch', detail: 'This scorecard adds another shared start for the doubles pairs. Pair fit should move only after repeated results, not one match.' })
  }

  const headline = teamPredictionCorrect === true
    ? exactScoreCorrect ? 'TiQ called the match and the score.' : 'TiQ called the match direction.'
    : teamPredictionCorrect === false
      ? 'This result gives TiQ a useful correction.'
      : 'This result adds calibration evidence.'
  const summary = `${correctCourts}/${scoredCourts.length || input.lines.length} court directions matched${lineupAdherence < 1 ? ` · ${Math.round(lineupAdherence * 100)}% of the recommended lineup played` : ' · the recommended lineup played as saved'}.`

  return {
    snapshotId: snapshot.id,
    snapshotCreatedAt: snapshot.created_at ?? null,
    scenarioName: clean(snapshot.scenario_name) || 'Saved lineup',
    projectedTeamWinPct,
    projectedScoreFor: snapshot.projected_score_for,
    projectedScoreAgainst: snapshot.projected_score_against,
    actualScoreFor,
    actualScoreAgainst,
    actualOutcome,
    teamPredictionCorrect,
    exactScoreCorrect,
    courtPredictionAccuracy,
    brierScore,
    lineupAdherence,
    opponentPlacementAccuracy,
    courts,
    signals,
    headline,
    summary,
  }
}

export function summarizeCaptainCalibrations(calibrations: CaptainLineupCalibration[]) {
  const outcomeReads = calibrations.filter((item) => item.teamPredictionCorrect !== null)
  const correctOutcomeReads = outcomeReads.filter((item) => item.teamPredictionCorrect).length
  const courtReads = calibrations.flatMap((item) => item.courts).filter((court) => court.predictionCorrect !== null)
  const correctCourtReads = courtReads.filter((court) => court.predictionCorrect).length
  const brierValues = calibrations.map((item) => item.brierScore).filter((value): value is number => value !== null)
  const adherenceValues = calibrations.map((item) => item.lineupAdherence)
  return {
    matches: calibrations.length,
    matchAccuracy: outcomeReads.length ? rounded(correctOutcomeReads / outcomeReads.length) : null,
    courtAccuracy: courtReads.length ? rounded(correctCourtReads / courtReads.length) : null,
    averageBrierScore: brierValues.length ? rounded(brierValues.reduce((sum, value) => sum + value, 0) / brierValues.length) : null,
    averageLineupAdherence: adherenceValues.length ? rounded(adherenceValues.reduce((sum, value) => sum + value, 0) / adherenceValues.length) : null,
    exactScores: calibrations.filter((item) => item.exactScoreCorrect === true).length,
  }
}

export function isCaptainLineupCalibration(value: unknown): value is CaptainLineupCalibration {
  if (!value || typeof value !== 'object') return false
  const calibration = value as Partial<CaptainLineupCalibration>
  return (
    typeof calibration.snapshotId === 'string'
    && typeof calibration.actualScoreFor === 'number'
    && typeof calibration.actualScoreAgainst === 'number'
    && Array.isArray(calibration.courts)
    && Array.isArray(calibration.signals)
    && typeof calibration.headline === 'string'
    && typeof calibration.summary === 'string'
  )
}
