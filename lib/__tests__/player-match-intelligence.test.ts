import { describe, expect, it } from 'vitest'
import { buildMatchIntelligenceRead } from '@/lib/player-match-intelligence'

describe('buildMatchIntelligenceRead', () => {
  it('turns connected results into a compact, score-independent pattern read', () => {
    const read = buildMatchIntelligenceRead({
      matches: [
        { date: '2026-08-20', matchType: 'Singles', result: 'W', opponent: 'Ava Lane' },
        { date: '2026-08-13', matchType: 'Doubles', result: 'W', opponent: 'Mia Chen' },
        { date: '2026-08-06', matchType: 'Doubles', result: 'L', opponent: 'Rae Kim' },
        { date: '2026-07-30', matchType: 'Singles', result: 'W', opponent: 'Jules Park' },
      ],
      activeFocus: 'Attack second serves',
      activeFocusNote: 'Track return depth for two matches.',
    })

    expect(read.record).toBe('3-1')
    expect(read.pattern).toBe('W · W · L · W')
    expect(read.patternLabel).toBe('Positive form')
    expect(read.confidenceLabel).toBe('Growing evidence')
    expect(read.courtMixLabel).toBe('2 singles · 2 doubles')
    expect(read.focusTitle).toBe('Attack second serves')
    expect(read.focusNote).toBe('Track return depth for two matches.')
  })

  it('keeps a small or incomplete record appropriately cautious', () => {
    const read = buildMatchIntelligenceRead({
      matches: [{ date: '2026-08-20', matchType: 'Singles', result: 'L', opponent: 'Jordan Lee' }],
    })

    expect(read.patternLabel).toBe('Early pattern')
    expect(read.confidenceLabel).toBe('Early evidence')
    expect(read.focusTitle).toBe('Review the loss vs Jordan Lee')
    expect(read.focusNote).toContain('repeat pattern')
  })

  it('does not make a rating claim when no scored match is connected', () => {
    const read = buildMatchIntelligenceRead({
      matches: [{ date: null, matchType: null, result: '-', opponent: '' }],
    })

    expect(read.record).toBe('New')
    expect(read.evidenceNote).toBe('TIQ starts the read once a scored match connects.')
  })
})
