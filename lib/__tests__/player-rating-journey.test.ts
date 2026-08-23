import { describe, expect, it } from 'vitest'
import { buildPlayerRatingJourneyRead } from '@/lib/player-rating-journey'

describe('buildPlayerRatingJourneyRead', () => {
  it('summarizes a meaningful positive checkpoint trend without calling it an official prediction', () => {
    const read = buildPlayerRatingJourneyRead({
      decidedMatches: 9,
      snapshots: [
        { id: 'one', snapshotDate: '2026-01-01', dynamicRating: 3.98, delta: 0.01 },
        { id: 'two', snapshotDate: '2026-02-01', dynamicRating: 4.01, delta: 0.03 },
        { id: 'three', snapshotDate: '2026-03-01', dynamicRating: 4.05, delta: 0.04 },
      ],
    })

    expect(read.evidenceLabel).toBe('Strong evidence')
    expect(read.movementLabel).toBe('Recent lift')
    expect(read.movementNote).toContain('+0.07')
    expect(read.latestDeltaLabel).toBe('+0.04 latest adjustment')
    expect(read.snapshotPoints).toHaveLength(3)
    expect(read.explainer).toContain('not an official rating')
  })

  it('keeps sparse evidence conservative and does not invent a rating trend', () => {
    const read = buildPlayerRatingJourneyRead({
      decidedMatches: 1,
      snapshots: [{ id: 'one', snapshotDate: '2026-01-01', dynamicRating: 4, delta: null }],
    })

    expect(read.evidenceLabel).toBe('Early evidence')
    expect(read.movementLabel).toBe('Starting read')
    expect(read.hasSnapshotTrend).toBe(false)
    expect(read.latestDeltaLabel).toBe('No per-match adjustment yet')
  })

  it('calls small checkpoint changes a stable range', () => {
    const read = buildPlayerRatingJourneyRead({
      decidedMatches: 5,
      snapshots: [
        { id: 'one', snapshotDate: '2026-01-01', dynamicRating: 4, delta: 0 },
        { id: 'two', snapshotDate: '2026-01-08', dynamicRating: 4.01, delta: 0.01 },
      ],
    })

    expect(read.movementLabel).toBe('Stable range')
    expect(read.movementNote).toContain('0.01')
  })
})
