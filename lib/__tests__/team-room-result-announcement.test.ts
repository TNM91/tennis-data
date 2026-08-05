import { describe, expect, it } from 'vitest'
import {
  buildTeamRoomResultAnnouncement,
  buildTeamRoomScorecardFingerprint,
} from '../team-room-result-announcement'

const draft = {
  externalMatchId: '1011650664',
  homeTeam: 'Baseline Crew',
  awayTeam: 'SuperSmash Bros',
  matchDate: '2026-08-08',
  lineCount: 1,
  parserWarnings: [],
  rawTextPreview: '',
  sourceScreenshotCount: 1,
  provider: 'tennislink_export' as const,
  confidenceScore: 1,
  lines: [{
    lineLabel: '4.5 Doubles',
    homePlayers: ['Casey Court', 'Drew Deuce'],
    awayPlayers: ['Alex Ace', 'Blair Baseline'],
    score: '4-6, 6-3, 10-7',
    winner: 'away',
    confidenceScore: 1,
  }],
}

describe('Team Room result announcements', () => {
  it('creates a stable fingerprint and changes it when a correction changes', () => {
    const first = buildTeamRoomScorecardFingerprint(draft)
    expect(buildTeamRoomScorecardFingerprint({ ...draft })).toBe(first)
    expect(buildTeamRoomScorecardFingerprint({
      ...draft,
      lines: [{ ...draft.lines[0], score: '6-4, 6-3', winner: 'home' }],
    })).not.toBe(first)
  })

  it('keeps the result announcement short and team-oriented', () => {
    expect(buildTeamRoomResultAnnouncement({
      matchId: 'match-1',
      externalMatchId: '1011650664',
      teamName: 'SuperSmash Bros',
      opponentName: 'Baseline Crew',
      teamScore: '2',
      opponentScore: '1',
      score: '1-2',
      outcome: 'win',
      lines: [],
      unresolvedPlayerCount: 0,
    })).toBe('Final: SuperSmash Bros 2-1 Baseline Crew. Court results are ready.')
  })
})
