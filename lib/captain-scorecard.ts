import { createHash } from 'node:crypto'
import type { ScorecardImportRow } from './ingestion/importEngine'
import type { DataAssistScorecardParsedDraft } from './data-assist-ocr'
import { canonicalTennisRecordFingerprint, normalizeTennisIdentity } from './tennisrecord/reconcile'

export type CaptainScorecardLineInput = {
  courtNumber: number
  label?: string | null
  matchType: 'singles' | 'doubles'
  teamPlayers: string[]
  opponentPlayers: string[]
  outcome: 'team' | 'opponent'
  score: string
}

export type CaptainScorecardInput = {
  teamName: string
  opponentTeam: string
  matchDate: string
  matchTime?: string | null
  facility?: string | null
  leagueName?: string | null
  flight?: string | null
  dataAssistBatchId?: string | null
  dataAssistDraftId?: string | null
  lines: CaptainScorecardLineInput[]
}

export type CaptainScorecardObservation = {
  fingerprint: string
  scoreText: string
  winnerSide: 'A' | 'B'
  participants: Array<{ name: string; side: 'A' | 'B'; seat: number }>
}

export type CaptainScorecardRecap = {
  outcome: 'won' | 'lost' | 'split'
  teamCourts: number
  opponentCourts: number
  lines: Array<{
    courtNumber: number
    label: string
    matchType: 'singles' | 'doubles'
    teamPlayers: string[]
    opponentPlayers: string[]
    outcome: 'team' | 'opponent'
    score: string
  }>
}

export type CaptainScorecardRatingChange = {
  playerId: string
  playerName: string
  side: 'team' | 'opponent'
  matchType: 'singles' | 'doubles'
  before: number | null
  after: number | null
  delta: number | null
}

export type CaptainScorecardSavedRecap = CaptainScorecardRecap & {
  ratingChanges: CaptainScorecardRatingChange[]
  sourceConflictCount: number
}

function cleanText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function cleanNames(values: string[]) {
  return values.map(cleanText).filter(Boolean)
}

export function validateCaptainScorecardInput(input: CaptainScorecardInput): string | null {
  if (!cleanText(input.teamName)) return 'Choose your team before saving the result.'
  if (!cleanText(input.opponentTeam)) return 'Add the opposing team before saving the result.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanText(input.matchDate))) return 'Add the match date before saving the result.'
  if (!input.lines.length) return 'Add at least one completed court.'
  const dataAssistBatchId = cleanText(input.dataAssistBatchId)
  const dataAssistDraftId = cleanText(input.dataAssistDraftId)
  if (Boolean(dataAssistBatchId) !== Boolean(dataAssistDraftId)) return 'The scorecard photo reference is incomplete. Reopen the photo read and try again.'

  const seenCourts = new Set<number>()
  for (const line of input.lines) {
    if (!Number.isInteger(line.courtNumber) || line.courtNumber < 1) return 'Each court needs a valid court number.'
    if (seenCourts.has(line.courtNumber)) return 'Each court can only be entered once.'
    seenCourts.add(line.courtNumber)
    if (line.matchType !== 'singles' && line.matchType !== 'doubles') return 'Choose singles or doubles for every court.'
    const neededPlayers = line.matchType === 'doubles' ? 2 : 1
    if (cleanNames(line.teamPlayers).length !== neededPlayers) return `Court ${line.courtNumber} needs ${neededPlayers === 1 ? 'one team player' : 'two team players'}.`
    if (cleanNames(line.opponentPlayers).length !== neededPlayers) return `Court ${line.courtNumber} needs ${neededPlayers === 1 ? 'one opponent' : 'two opponents'}.`
    if (line.outcome !== 'team' && line.outcome !== 'opponent') return `Choose who won court ${line.courtNumber}.`
    if (!cleanText(line.score)) return `Add the final score for court ${line.courtNumber}.`
  }
  return null
}

export function buildCaptainScorecardExternalMatchId(input: Pick<CaptainScorecardInput, 'teamName' | 'opponentTeam' | 'matchDate' | 'leagueName' | 'flight'>) {
  const stable = [
    cleanText(input.matchDate),
    normalizeTennisIdentity(input.teamName),
    normalizeTennisIdentity(input.opponentTeam),
    normalizeTennisIdentity(input.leagueName),
    normalizeTennisIdentity(input.flight),
  ].join('::')
  return `captain-scorecard:${createHash('sha256').update(stable).digest('hex')}`
}

export function buildCaptainScorecardObservations(input: CaptainScorecardInput): CaptainScorecardObservation[] {
  return input.lines.map((line) => {
    const teamPlayers = cleanNames(line.teamPlayers)
    const opponentPlayers = cleanNames(line.opponentPlayers)
    const participants = [
      ...teamPlayers.map((name, index) => ({ name, side: 'A' as const, seat: index + 1 })),
      ...opponentPlayers.map((name, index) => ({ name, side: 'B' as const, seat: index + 1 })),
    ]
    const fingerprintParticipants = participants.map((participant) => ({
      ...participant,
      sourcePlayerKey: `captain:${participant.side}:${participant.seat}:${normalizeTennisIdentity(participant.name)}`,
    }))
    return {
      fingerprint: canonicalTennisRecordFingerprint({
        playedOn: cleanText(input.matchDate),
        leagueName: cleanText(input.leagueName),
        flight: cleanText(input.flight),
        homeTeam: cleanText(input.teamName),
        awayTeam: cleanText(input.opponentTeam),
        discipline: line.matchType,
        courtNumber: line.courtNumber,
        participants: fingerprintParticipants,
      }),
      scoreText: cleanText(line.score),
      winnerSide: line.outcome === 'team' ? 'A' : 'B',
      participants,
    }
  })
}

export function buildCaptainScorecardRecap(input: CaptainScorecardInput): CaptainScorecardRecap {
  const teamCourts = input.lines.filter((line) => line.outcome === 'team').length
  const opponentCourts = input.lines.filter((line) => line.outcome === 'opponent').length
  return {
    outcome: teamCourts === opponentCourts ? 'split' : teamCourts > opponentCourts ? 'won' : 'lost',
    teamCourts,
    opponentCourts,
    lines: input.lines.map((line) => ({
      courtNumber: line.courtNumber,
      label: cleanText(line.label) || `${line.matchType === 'doubles' ? 'Doubles' : 'Singles'} ${line.courtNumber}`,
      matchType: line.matchType,
      teamPlayers: cleanNames(line.teamPlayers),
      opponentPlayers: cleanNames(line.opponentPlayers),
      outcome: line.outcome,
      score: cleanText(line.score),
    })),
  }
}

export function isCaptainScorecardSavedRecap(value: unknown): value is CaptainScorecardSavedRecap {
  if (!value || typeof value !== 'object') return false
  const recap = value as Partial<CaptainScorecardSavedRecap>
  return (
    (recap.outcome === 'won' || recap.outcome === 'lost' || recap.outcome === 'split')
    && typeof recap.teamCourts === 'number'
    && typeof recap.opponentCourts === 'number'
    && Array.isArray(recap.lines)
    && Array.isArray(recap.ratingChanges)
    && typeof recap.sourceConflictCount === 'number'
  )
}

export function buildCaptainScorecardImportRow(
  input: CaptainScorecardInput,
  externalMatchId = buildCaptainScorecardExternalMatchId(input),
): ScorecardImportRow {
  return {
    externalMatchId,
    matchDate: cleanText(input.matchDate),
    matchTime: cleanText(input.matchTime) || null,
    homeTeam: cleanText(input.teamName),
    awayTeam: cleanText(input.opponentTeam),
    facility: cleanText(input.facility) || null,
    leagueName: cleanText(input.leagueName) || null,
    flight: cleanText(input.flight) || null,
    source: 'captain_scorecard',
    totalTeamScore: {
      home: input.lines.filter((line) => line.outcome === 'team').length,
      away: input.lines.filter((line) => line.outcome === 'opponent').length,
    },
    captureEngine: {
      version: 'captain-scorecard-v1',
      captureQuality: 1,
      diagnostics: [],
    },
    needsReview: false,
    reviewStatus: 'clean',
    reviewed_by: 'Captain scorecard',
    reviewed_at: new Date().toISOString(),
    raw_capture_json: {
      source: 'captain_scorecard',
      enteredAt: new Date().toISOString(),
      input,
    },
    lines: input.lines.map((line) => ({
      lineNumber: line.courtNumber,
      matchType: line.matchType,
      sideAPlayers: cleanNames(line.teamPlayers),
      sideBPlayers: cleanNames(line.opponentPlayers),
      winnerSide: line.outcome === 'team' ? 'A' : 'B',
      score: cleanText(line.score),
      rawScoreText: cleanText(line.score),
      captureConfidence: 1,
      winnerSource: 'winner_column',
      scoreEventType: /(?:^|\s)(?:1[-–]0|10[-–]\d+)(?:\s|$)/.test(cleanText(line.score))
        ? 'third_set_match_tiebreak'
        : 'standard',
      parseNotes: [],
      evidenceClass: 'locked',
      isLocked: true,
    })),
  }
}

/**
 * The Team Chat result announcer accepts the same normalized match shape used
 * by reviewed scorecard imports. A captain-entered scorecard is already
 * verified, so build that shape directly instead of waiting for a later
 * source pass to announce the completed match.
 */
export function buildCaptainScorecardTeamRoomDraft(
  input: CaptainScorecardInput,
  externalMatchId = buildCaptainScorecardExternalMatchId(input),
): DataAssistScorecardParsedDraft {
  return {
    externalMatchId,
    leagueName: cleanText(input.leagueName),
    homeTeam: cleanText(input.teamName),
    awayTeam: cleanText(input.opponentTeam),
    matchDate: cleanText(input.matchDate),
    lineCount: input.lines.length,
    parserWarnings: [],
    lines: input.lines.map((line) => ({
      lineLabel: cleanText(line.label) || `${line.matchType === 'doubles' ? 'Doubles' : 'Singles'} ${line.courtNumber}`,
      homePlayers: cleanNames(line.teamPlayers),
      awayPlayers: cleanNames(line.opponentPlayers),
      score: cleanText(line.score),
      winner: line.outcome === 'team' ? 'home' : 'away',
      winnerSource: 'winner_column',
      confidenceScore: 1,
      scoreEventType: /(?:^|\s)(?:1[-–]0|10[-–]\d+)(?:\s|$)/.test(cleanText(line.score))
        ? 'third_set_match_tiebreak'
        : 'standard',
      parseNotes: [],
    })),
    rawTextPreview: 'Verified captain scorecard',
    sourceScreenshotCount: 0,
    provider: 'manual_review',
    confidenceScore: 1,
  }
}

export function hasHigherPriorityCaptainScorecardConflict(input: {
  source: string
  scoreText?: string | null | undefined
  score_text?: string | null | undefined
}, observation: CaptainScorecardObservation) {
  return input.source === 'admin_verified' && cleanText(input.scoreText ?? input.score_text) !== observation.scoreText
}
