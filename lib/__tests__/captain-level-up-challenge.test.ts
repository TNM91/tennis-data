import { describe, expect, it } from 'vitest'
import {
  appendLevelUpChallengeHref,
  buildCaptainLevelUpChallenge,
  CAPTAIN_LEVEL_UP_CHALLENGES,
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
})
