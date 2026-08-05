import { describe, expect, it } from 'vitest'
import { buildCaptainLevelUpChallenge } from '../captain-level-up-challenge'
import {
  appendCaptainWeekChallengeRecapToMessage,
  appendCaptainWeekChallengeToMessage,
  buildCaptainWeekChallengeHistoryHref,
  recommendCaptainWeekChallengeFollowUp,
  selectCaptainCompletedWeekChallenge,
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

  it('finds the completed challenge tied to the selected match week', () => {
    const scheduled = historyItem('doubles-readiness', 'closed', '2026-08-12')
    scheduled.completedCount = 7
    const spanning = historyItem('rhythm-builder', 'closed')
    spanning.launchedAt = '2026-08-10T12:00:00.000Z'
    spanning.closedAt = '2026-08-13T12:00:00.000Z'

    expect(selectCaptainCompletedWeekChallenge([spanning, scheduled], '2026-08-12')?.challengeId)
      .toBe('doubles-readiness')
    expect(selectCaptainCompletedWeekChallenge([spanning], '2026-08-12')?.challengeId)
      .toBe('rhythm-builder')
    expect(selectCaptainCompletedWeekChallenge([spanning], '2026-08-20')).toBeNull()
  })

  it('advances a well-completed challenge and repeats one that needs more reach', () => {
    const completed = historyItem('doubles-readiness', 'closed', '2026-08-12')
    completed.completedCount = 7
    completed.connectedCount = 8
    expect(recommendCaptainWeekChallengeFollowUp(completed)).toMatchObject({
      challenge: { id: 'point-start-routine' },
      repeatsCurrent: false,
    })

    completed.completedCount = 3
    expect(recommendCaptainWeekChallengeFollowUp(completed)).toMatchObject({
      challenge: { id: 'doubles-readiness' },
      repeatsCurrent: true,
    })
  })

  it('keeps the team goal concise and adds it only once', () => {
    const challenge = buildCaptainLevelUpChallenge('doubles-readiness')
    const message = appendCaptainWeekChallengeToMessage('Can you play Wednesday?', challenge)

    expect(message).toContain('Team goal: Doubles Readiness - Partner first move, poach timing, and 30-30 doubles clarity.')
    expect(appendCaptainWeekChallengeToMessage(message, challenge)).toBe(message)
  })

  it('adds the aggregate result and next challenge to the post-match note once', () => {
    const challenge = buildCaptainLevelUpChallenge('doubles-readiness')!
    const history = historyItem('doubles-readiness', 'closed', '2026-08-12')
    history.completedCount = 7
    const completed = { challenge, history, teamRoomHref: '/team-room?message=done' }
    const followUp = recommendCaptainWeekChallengeFollowUp(history)
    const message = appendCaptainWeekChallengeRecapToMessage('Great match today.', completed, followUp)

    expect(message).toContain('Team challenge: Doubles Readiness - 7 of 8 connected teammates completed it.')
    expect(message).toContain('Next up: Point-Start Routine.')
    expect(appendCaptainWeekChallengeRecapToMessage(message, completed, followUp)).toBe(message)
  })

  it('builds the scoped history request without dropping team context', () => {
    expect(buildCaptainWeekChallengeHistoryHref({
      teamName: 'TIQ Aces',
      leagueName: 'Tri-Level',
      flight: '3.5 / 4.0 / 4.5',
    })).toBe('/api/team-rooms?team=TIQ+Aces&league=Tri-Level&flight=3.5+%2F+4.0+%2F+4.5&levelUpHistory=1')
  })
})
