import { describe, expect, it } from 'vitest'
import { buildPlayerTrophyBadges } from '../player-trophy-badges'

describe('player trophy badges', () => {
  it('only awards badges from verified honors and real match evidence', () => {
    const badges = buildPlayerTrophyBadges({ verifiedHonors: 1, reviewedMatches: 25, longestWinStreak: 3 })
    expect(badges.filter((badge) => badge.earned).map((badge) => badge.key)).toEqual([
      'verified-honor', 'match-builder', 'streak-keeper', 'court-regular',
    ])
  })

  it('shows a concrete next threshold without manufacturing an achievement', () => {
    const badges = buildPlayerTrophyBadges({ verifiedHonors: 0, reviewedMatches: 8, longestWinStreak: 2 })
    expect(badges.every((badge) => !badge.earned)).toBe(true)
    expect(badges.find((badge) => badge.key === 'match-builder')).toMatchObject({ progressLabel: '8/10 matches' })
  })
})
