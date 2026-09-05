import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { isSyntheticTennisRecordObservation, tennisRecordResultCorrection } from '../tennisrecord/result-integrity'
import { classifyExistingMatchSource, reconcileMatchObservations } from '../tennisrecord/reconcile'

const match = { id: 'match', source: 'tennisrecord', score: '6-7 4-2 1-0', winner_side: 'A' }
const source = { source: 'tennisrecord', score_text: match.score, winner_side: 'B' }
describe('source result integrity', () => {
  it('repairs an authoritative winner without guessing from a 1-0 marker', () => {
    expect(tennisRecordResultCorrection(match, source)).toEqual({ score: match.score, winner_side: 'B' })
    expect(tennisRecordResultCorrection({ ...match, winner_side: 'B' }, source)).toBeNull()
  })
  it('preserves local and independently verified results', () => {
    for (const authority of ['admin_verified', 'captain_upload', 'player_upload', 'tenaceiq']) {
      expect(tennisRecordResultCorrection({ ...match, source: authority }, source)).toBeNull()
      expect(tennisRecordResultCorrection(match, { ...source, source: authority })).toBeNull()
    }
    expect(tennisRecordResultCorrection(match, { ...source, winner_side: null })).toBeNull()
  })
  it('does not undo an already reviewed court-side score orientation', () => {
    expect(tennisRecordResultCorrection({ ...match, score: '1-6 2-6', winner_side: 'B' }, { ...source, score_text: '6-1 6-2' })).toBeNull()
    expect(tennisRecordResultCorrection({ ...match, score: '7-6 2-4 0-1' }, source)).toEqual({ score: '7-6 2-4 0-1', winner_side: 'B' })
  })
  it('removes only proven synthetic observations for this source-owned match', () => {
    const observation = { source: 'tenaceiq', source_record_id: 'match', raw: { source: 'tennisrecord' } }
    expect(isSyntheticTennisRecordObservation(observation, match)).toBe(true)
    expect(isSyntheticTennisRecordObservation({ ...observation, raw: {} }, match)).toBe(false)
    expect(isSyntheticTennisRecordObservation({ ...observation, source_record_id: 'other' }, match)).toBe(false)
    expect(isSyntheticTennisRecordObservation(observation, { ...match, source: 'admin_verified' })).toBe(false)
    expect(classifyExistingMatchSource('tennisrecord')).toBe('tennisrecord')
  })
  it('flags conflicting winners even when scores and players match', () => {
    const observations = [
      { id: 'old', source: 'tennisrecord' as const, observedAt: '2026-01-01', scoreText: match.score, winnerSide: 'A' as const },
      { id: 'new', source: 'tennisrecord' as const, observedAt: '2026-09-05', scoreText: match.score, winnerSide: 'B' as const },
    ]
    expect(reconcileMatchObservations(observations).conflicts.map(o => o.id)).toEqual(['old'])
  })
  it('queues ratings before applying guarded source corrections', () => {
    const code = readFileSync('lib/tennisrecord/service.ts', 'utf8')
    expect(code).toContain('...(correction ? { rating_processed_at: null } : {})')
    expect(code.indexOf('...(correction ?')).toBeLessThan(code.indexOf("update(correction).eq('id', existing.id)"))
    expect(code).toContain("repaired.data?.length !== 1")
  })
})
