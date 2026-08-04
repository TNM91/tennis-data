import { describe, expect, it } from 'vitest'
import { buildCaptainLevelUpChallenge } from '../captain-level-up-challenge'
import {
  appendCaptainWeekChallengeToMessage,
  buildCaptainWeekChallengeHistoryHref,
  selectCaptainWeekChallenge,
  type CaptainWeekChallengeHistoryItem,
} from '../captain-week-challenge'

function historyItem(
  challengeId: string,
  status: CaptainWeekChallengeHistoryItem['status'],
  scheduledForDate = '',
): CaptainWeekChallengeHistoryItem {
  return {
    messageId: `${challengeId}-message`,
    challengeId,
    title: challengeId,
    focus: '',
    status,
    scheduledForDate,
    launchedAt: '2026-08-01T12:00:00.000Z',
    closedAt: '',
    completedCount: 0,
    connectedCount: 8,
  }
}

describe('Captain week challenge continuity', () => {
  it('prefers the challenge scheduled for the selected match over an active challenge', () => {
    const selected = selectCaptainWeekChallenge([
      historyItem('rhythm-builder', 'active'),
      historyItem('doubles-readiness', 'scheduled', '2026-08-12'),
    ], '2026-08-12T18:00:00.000Z')

    expect(selected?.challengeId).toBe('doubles-readiness')
  })

  it('falls back to the active challenge and ignores other weeks and ended work', () => {
    const selected = selectCaptainWeekChallenge([
      historyItem('match-day-routine', 'scheduled', '2026-08-19'),
      historyItem('consistency-builder', 'closed'),
      historyItem('point-start-routine', 'cancelled'),
      historyItem('rhythm-builder', 'active'),
    ], '2026-08-12')

    expect(selected?.challengeId).toBe('rhythm-builder')
  })

  it('keeps the team goal concise and adds it only once', () => {
    const challenge = buildCaptainLevelUpChallenge('doubles-readiness')
    const message = appendCaptainWeekChallengeToMessage('Can you play Wednesday?', challenge)

    expect(message).toContain('Team goal: Doubles Readiness - Partner first move, poach timing, and 30-30 doubles clarity.')
    expect(appendCaptainWeekChallengeToMessage(message, challenge)).toBe(message)
  })

  it('builds the scoped history request without dropping team context', () => {
    expect(buildCaptainWeekChallengeHistoryHref({
      teamName: 'TIQ Aces',
      leagueName: 'Tri-Level',
      flight: '3.5 / 4.0 / 4.5',
    })).toBe('/api/team-rooms?team=TIQ+Aces&league=Tri-Level&flight=3.5+%2F+4.0+%2F+4.5&levelUpHistory=1')
  })
})
