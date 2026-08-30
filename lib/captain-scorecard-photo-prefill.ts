import type { DataAssistScorecardParsedDraft } from './data-assist-ocr'

export type CaptainScorecardPhotoPrefillCourt = {
  courtNumber: number
  matchType: 'singles' | 'doubles'
  teamPlayers: string[]
  opponentPlayers: string[]
  outcome: 'team' | 'opponent'
  score: string
}

export type CaptainScorecardPhotoPrefill = {
  version: 1
  dataAssistBatchId: string
  dataAssistDraftId: string
  teamName: string
  opponentTeam: string
  matchDate: string
  courts: CaptainScorecardPhotoPrefillCourt[]
}

const STORAGE_PREFIX = 'tenaceiq.captain.scorecard-photo.'

function clean(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function identity(value: string | null | undefined) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function inferMatchType(line: DataAssistScorecardParsedDraft['lines'][number]) {
  if (/single/i.test(line.lineLabel)) return 'singles' as const
  if (/double/i.test(line.lineLabel)) return 'doubles' as const
  return line.homePlayers.filter(Boolean).length <= 1 && line.awayPlayers.filter(Boolean).length <= 1
    ? 'singles' as const
    : 'doubles' as const
}

function getCourtNumber(label: string, fallback: number, used: Set<number>) {
  const parsed = Number.parseInt(label.match(/\d+/)?.[0] || '', 10)
  let courtNumber = Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
  while (used.has(courtNumber)) courtNumber += 1
  used.add(courtNumber)
  return courtNumber
}

export function captainScorecardPhotoPrefillStorageKey(batchId: string) {
  return `${STORAGE_PREFIX}${clean(batchId)}`
}

export function buildCaptainScorecardPhotoPrefill(input: {
  teamName: string
  dataAssistBatchId: string
  dataAssistDraftId: string
  parsedDraft: DataAssistScorecardParsedDraft
}): CaptainScorecardPhotoPrefill | null {
  const teamName = clean(input.teamName)
  const dataAssistBatchId = clean(input.dataAssistBatchId)
  const dataAssistDraftId = clean(input.dataAssistDraftId)
  if (!teamName || !dataAssistBatchId || !dataAssistDraftId || !input.parsedDraft.lines.length) return null

  const teamIdentity = identity(teamName)
  const homeMatchesTeam = teamIdentity && identity(input.parsedDraft.homeTeam) === teamIdentity
  const awayMatchesTeam = teamIdentity && identity(input.parsedDraft.awayTeam) === teamIdentity
  const teamIsHome = homeMatchesTeam || !awayMatchesTeam
  const opponentTeam = clean(teamIsHome ? input.parsedDraft.awayTeam : input.parsedDraft.homeTeam)
  const usedCourtNumbers = new Set<number>()
  const courts = input.parsedDraft.lines.map((line, index) => {
    const matchType = inferMatchType(line)
    const teamPlayers = (teamIsHome ? line.homePlayers : line.awayPlayers).map(clean).filter(Boolean)
    const opponentPlayers = (teamIsHome ? line.awayPlayers : line.homePlayers).map(clean).filter(Boolean)
    const winnerIsTeam = teamIsHome ? line.winner === 'home' : line.winner === 'away'
    return {
      courtNumber: getCourtNumber(line.lineLabel, index + 1, usedCourtNumbers),
      matchType,
      teamPlayers: matchType === 'singles' ? [teamPlayers[0] || ''] : [teamPlayers[0] || '', teamPlayers[1] || ''],
      opponentPlayers: matchType === 'singles' ? [opponentPlayers[0] || ''] : [opponentPlayers[0] || '', opponentPlayers[1] || ''],
      outcome: winnerIsTeam ? 'team' as const : 'opponent' as const,
      score: clean(line.score),
    }
  })

  return {
    version: 1,
    dataAssistBatchId,
    dataAssistDraftId,
    teamName,
    opponentTeam,
    matchDate: clean(input.parsedDraft.matchDate),
    courts,
  }
}

export function isCaptainScorecardPhotoPrefill(value: unknown): value is CaptainScorecardPhotoPrefill {
  if (!value || typeof value !== 'object') return false
  const prefill = value as Partial<CaptainScorecardPhotoPrefill>
  return prefill.version === 1
    && Boolean(clean(prefill.dataAssistBatchId))
    && Boolean(clean(prefill.dataAssistDraftId))
    && Boolean(clean(prefill.teamName))
    && Array.isArray(prefill.courts)
    && prefill.courts.every((court) => (
      court
      && Number.isInteger(court.courtNumber)
      && (court.matchType === 'singles' || court.matchType === 'doubles')
      && Array.isArray(court.teamPlayers)
      && Array.isArray(court.opponentPlayers)
      && (court.outcome === 'team' || court.outcome === 'opponent')
      && typeof court.score === 'string'
    ))
}
