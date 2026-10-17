import { describe, expect, it } from 'vitest'
import { buildTenAceMemberRead } from '../player-tenace-read'

describe('buildTenAceMemberRead', () => {
  it('turns a stable rating and even record into a focused member read', () => {
    const read = buildTenAceMemberRead({
      currentRating: 4.41,
      ratingDelta: -0.01,
      wins: 4,
      losses: 4,
      confidence: 'High',
      recentPattern: 'Mixed results',
      courtMix: 'Mostly doubles',
    })

    expect(read.headline).toBe('Your level is steady. Focus is the edge.')
    expect(read.evidence).toEqual(['TIQ -0.01', '4-4 recent', 'High'])
    expect(read.nextTest).toContain('next two matches')
  })

  it('uses the active focus as the next test when one exists', () => {
    const read = buildTenAceMemberRead({
      currentRating: 4.45,
      ratingDelta: 0.04,
      wins: 5,
      losses: 2,
      confidence: 'High',
      recentPattern: 'Winning form',
      courtMix: 'Balanced singles and doubles',
      activeFocus: 'Attack short returns',
    })

    expect(read.headline).toBe('Your level and results are moving together.')
    expect(read.nextTest).toContain('Attack short returns')
  })

  it('finds a short winning turn hidden inside an even record', () => {
    const read = buildTenAceMemberRead({
      currentRating: 4.41,
      ratingDelta: -0.01,
      wins: 4,
      losses: 4,
      confidence: 'High',
      recentPattern: 'W · W · L · L · W',
      courtMix: '2 singles · 6 doubles',
      recentMatches: [
        { result: 'W', matchType: 'Doubles' },
        { result: 'W', matchType: 'Doubles' },
        { result: 'L', matchType: 'Doubles' },
        { result: 'L', matchType: 'Singles' },
      ],
    })

    expect(read.headline).toBe('2 straight wins. Your rating is still catching up.')
    expect(read.summary).toContain('overall record hides a short lift')
    expect(read.evidence).toContain('2 straight wins')
    expect(read.nextTest).toContain('one repeatable pattern')
    expect(read.reflectionPrompt).toContain('4-4 / 4.41 baseline')
  })

  it('surfaces a meaningful format edge when both formats have enough evidence', () => {
    const read = buildTenAceMemberRead({
      currentRating: 4.2,
      ratingDelta: 0.01,
      wins: 4,
      losses: 3,
      confidence: 'Medium',
      recentPattern: 'Mixed',
      courtMix: '3 singles · 4 doubles',
      recentMatches: [
        { result: 'W', matchType: 'Singles' },
        { result: 'L', matchType: 'Doubles' },
        { result: 'W', matchType: 'Singles' },
        { result: 'L', matchType: 'Doubles' },
        { result: 'W', matchType: 'Singles' },
        { result: 'W', matchType: 'Doubles' },
      ],
    })

    expect(read.headline).toBe('Singles is your clearest edge right now.')
    expect(read.evidence).toContain('Singles 3-0')
    expect(read.nextTest).toContain('next doubles result')
  })

  it('gives a useful first step before a player has connected data', () => {
    const read = buildTenAceMemberRead({
      currentRating: null,
      ratingDelta: null,
      wins: 0,
      losses: 0,
      confidence: 'Early',
      recentPattern: 'No pattern yet',
      courtMix: 'tennis',
    })

    expect(read.headline).toBe('Your first useful read starts with one result.')
    expect(read.evidence).toContain('First result needed')
    expect(read.reflectionPrompt).toContain('first result')
  })
})
