import { describe, expect, it } from 'vitest'
import {
  buildCaptainPairLineupIntelligence,
  buildCaptainPlayerLineupIntelligence,
  summarizeCaptainPairRecord,
  summarizeCaptainPairScoreTendency,
  summarizeCaptainPositionTendency,
  summarizeCaptainScoreTendency,
} from '@/lib/captain-lineup-intelligence'

describe('captain lineup intelligence', () => {
  it('summarizes honest position and winning-set samples', () => {
    const intelligence = buildCaptainPlayerLineupIntelligence('maya', [
      { id: 'm1', line_number: '1', match_type: 'doubles', winner_side: 'A', score: '6-1 6-3' },
      { id: 'm2', line_number: '1', match_type: 'doubles', winner_side: 'B', score: '7-6 6-4' },
      { id: 'm3', line_number: '2', match_type: 'doubles', winner_side: 'A', score: '6-2 6-0' },
      { id: 'm4', line_number: '1', match_type: 'singles', winner_side: 'B', score: '6-4 7-5' },
    ], [
      { match_id: 'm1', player_id: 'maya', side: 'A' },
      { match_id: 'm2', player_id: 'maya', side: 'B' },
      { match_id: 'm3', player_id: 'maya', side: 'A' },
      { match_id: 'm4', player_id: 'maya', side: 'A' },
    ])

    expect(intelligence.startCount).toBe(4)
    expect(intelligence.scoredWinCount).toBe(3)
    expect(intelligence.scoredSetCount).toBe(6)
    expect(intelligence.positions).toEqual([
      { label: 'Doubles 1', starts: 2, percentage: 50 },
      { label: 'Doubles 2', starts: 1, percentage: 25 },
      { label: 'Singles 1', starts: 1, percentage: 25 },
    ])
    expect(intelligence.scoreOutcomes).toEqual([
      { label: '6–0 / 6–1', sets: 2, percentage: 33 },
      { label: '6–2 / 6–3', sets: 2, percentage: 33 },
      { label: '6–4 / 7–5', sets: 1, percentage: 17 },
      { label: '7–6', sets: 1, percentage: 17 },
    ])
    expect(summarizeCaptainPositionTendency(intelligence)).toBe('Doubles 1 · 50% of 4 starts')
    expect(summarizeCaptainScoreTendency(intelligence)).toBe('6–0 / 6–1 most common win set')
  })

  it('does not invent percentages when history is missing', () => {
    const intelligence = buildCaptainPlayerLineupIntelligence('new-player', [], [])
    expect(summarizeCaptainPositionTendency(intelligence)).toBe('No court history yet')
    expect(summarizeCaptainScoreTendency(intelligence)).toBe('No scored wins yet')
    expect(intelligence.scoreOutcomes.every((outcome) => outcome.percentage === 0)).toBe(true)
  })

  it('uses same-side doubles appearances for honest partnership history', () => {
    const intelligence = buildCaptainPairLineupIntelligence(['maya', 'zoe'], [
      { id: 'm1', line_number: '1', match_type: 'doubles', winner_side: 'A', score: '6-1 6-3' },
      { id: 'm2', line_number: '2', match_type: 'doubles', winner_side: 'B', score: '7-6 6-4' },
      { id: 'm3', line_number: '1', match_type: 'doubles', winner_side: 'B', score: '6-2 6-2' },
      { id: 'm4', line_number: '1', match_type: 'singles', winner_side: 'A', score: '6-0 6-0' },
    ], [
      { match_id: 'm1', player_id: 'maya', side: 'A' },
      { match_id: 'm1', player_id: 'zoe', side: 'A' },
      { match_id: 'm2', player_id: 'maya', side: 'B' },
      { match_id: 'm2', player_id: 'zoe', side: 'B' },
      { match_id: 'm3', player_id: 'maya', side: 'A' },
      { match_id: 'm3', player_id: 'zoe', side: 'A' },
      { match_id: 'm4', player_id: 'maya', side: 'A' },
      { match_id: 'm4', player_id: 'zoe', side: 'A' },
    ])

    expect(intelligence.startCount).toBe(3)
    expect(intelligence.winCount).toBe(2)
    expect(intelligence.lossCount).toBe(1)
    expect(intelligence.winPercentage).toBe(67)
    expect(intelligence.scoredSetCount).toBe(4)
    expect(summarizeCaptainPairRecord(intelligence)).toBe('2–1 together · 67% wins')
    expect(summarizeCaptainPairScoreTendency(intelligence)).toBe('6–0 / 6–1 most common winning set')
  })

  it('labels an untested partnership without manufacturing a record', () => {
    const intelligence = buildCaptainPairLineupIntelligence(['maya', 'zoe'], [], [])
    expect(intelligence.winPercentage).toBeNull()
    expect(summarizeCaptainPairRecord(intelligence)).toBe('New pairing · no shared starts')
    expect(summarizeCaptainPairScoreTendency(intelligence)).toBe('No scored wins together yet')
  })
})
