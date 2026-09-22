import type { DataAssistScorecardParsedDraft } from './data-assist-ocr'
import type { TeamRoomFinalResult } from './team-room-final-result'

export function buildTeamRoomScorecardFingerprint(draft: DataAssistScorecardParsedDraft) {
  return JSON.stringify({
    externalMatchId: clean(draft.externalMatchId),
    matchDate: clean(draft.matchDate),
    homeTeam: normalize(draft.homeTeam),
    awayTeam: normalize(draft.awayTeam),
    lines: draft.lines.map((line) => ({
      label: normalize(line.lineLabel),
      homePlayers: line.homePlayers.map(normalize),
      awayPlayers: line.awayPlayers.map(normalize),
      score: normalize(line.score),
      winner: normalize(line.winner),
    })),
  })
}

export function buildTeamRoomResultAnnouncement(result: TeamRoomFinalResult) {
  const score = result.teamScore && result.opponentScore
    ? `${result.teamScore}-${result.opponentScore}`
    : result.score || 'Final'
  return `Final: ${result.teamName} ${score} ${result.opponentName}. Court results are ready.`
}

function normalize(value: unknown) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
