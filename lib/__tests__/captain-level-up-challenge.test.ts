import { describe, expect, it } from 'vitest'
import {
  appendLevelUpChallengeHref,
  buildCaptainLevelUpCardHref,
  buildCaptainLevelUpChallenge,
  CAPTAIN_LEVEL_UP_CHALLENGES,
  getCaptainLevelUpAggregateCompletionLabel,
  getCaptainLevelUpCardDetails,
  getCaptainLevelUpCompletedPlayerIds,
  selectActiveCaptainLevelUpChallenge,
} from '../captain-level-up-challenge'

describe('Captain Level Up challenge handoff', () => {
  it('supports every Captain challenge pack and keeps requested cards first', () => {
    expect(CAPTAIN_LEVEL_UP_CHALLENGES.map((challenge) => challenge.id)).toEqual([
      'rhythm-builder',
      'consistency-builder',
      'point-start-routine',
      'match-day-routine',
      'doubles-readiness',
    ])

    const challenge = buildCaptainLevelUpChallenge('doubles-readiness', 'custom-volley-card')
    expect(challenge?.title).toBe('Doubles Readiness')
    expect(challenge?.cardIds[0]).toBe('custom-volley-card')
    expect(buildCaptainLevelUpChallenge('unknown')).toBeNull()
  })

  it('passes the challenge to the selected Captain tool without dropping scope or anchors', () => {
    expect(appendLevelUpChallengeHref(
      '/captain/practice?team=TIQ&league=Tri-Level#practice',
      'doubles-readiness',
      'poach-timing-shadow',
    )).toBe('/captain/practice?team=TIQ&league=Tri-Level&levelUpChallenge=doubles-readiness&card=poach-timing-shadow#practice')
  })

  it('opens every shared card in the live Level Up flow', () => {
    const challenge = buildCaptainLevelUpChallenge('doubles-readiness')
    expect(challenge).not.toBeNull()
    expect(getCaptainLevelUpCardDetails(challenge!).map((card) => card.id)).toEqual(challenge?.cardIds)
    expect(buildCaptainLevelUpCardHref('poach-timing-shadow')).toBe(
      '/level-up/relentless-competitor-4-0?card=poach-timing-shadow#level-up-flow',
    )
  })

  it('counts a connected player only after every challenge card is complete', () => {
    const challenge = buildCaptainLevelUpChallenge('doubles-readiness')!
    const completed = getCaptainLevelUpCompletedPlayerIds(challenge, [
      { playerUserId: 'player-1', focusId: 'partner-first-move-call', drillTitle: 'Partner First-Move Call' },
      { playerUserId: 'player-1', focusId: 'poach-timing-shadow', drillTitle: 'Poach Timing Shadow' },
      { playerUserId: 'player-1', focusId: 'doubles-30-30-game', drillTitle: 'Doubles 30-30 Game' },
      { playerUserId: 'player-2', focusId: 'doubles-first-move', drillTitle: 'Partner First-Move Call' },
    ])
    expect(completed).toEqual(['player-1'])
  })

  it('uses honest connected-team labels instead of placeholder roster counts', () => {
    expect(getCaptainLevelUpAggregateCompletionLabel(null)).toBe('Checking connected team progress...')
    expect(getCaptainLevelUpAggregateCompletionLabel({
      launched: false,
      completedCount: 0,
      connectedCount: 3,
      launchedAt: '',
      messageId: '',
    })).toBe('3 connected teammates can join')
    expect(getCaptainLevelUpAggregateCompletionLabel({
      launched: true,
      completedCount: 2,
      connectedCount: 3,
      launchedAt: '2026-08-04T12:00:00.000Z',
      messageId: 'message-1',
    })).toBe('2 of 3 connected teammates completed')
  })

  it('pins the newest open challenge and leaves ended challenges in history', () => {
    expect(selectActiveCaptainLevelUpChallenge([
      { id: 'older-open', createdAt: '2026-08-01T12:00:00.000Z' },
      { id: 'newer-closed', createdAt: '2026-08-03T12:00:00.000Z', status: 'closed' },
      { id: 'newest-open', createdAt: '2026-08-02T12:00:00.000Z', status: 'active' },
    ])).toBe('newest-open')
    expect(selectActiveCaptainLevelUpChallenge([
      { id: 'closed', createdAt: '2026-08-03T12:00:00.000Z', status: 'closed' },
    ])).toBe('')
  })
})
