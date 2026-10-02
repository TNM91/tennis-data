import { describe, expect, it } from 'vitest'
import { summarizeRatingEvidence, type RatingEvidenceCourt } from '../tiq-rating-evidence-quality'
const court = (id: string, date: string, partnerId = 'partner'): RatingEvidenceCourt => ({ id, date, partnerId, format: 'doubles', opponentIds: ['a', 'b'] })
const summarize = (courts: RatingEvidenceCourt[], missingOfficialCourts = 0) => summarizeRatingEvidence({ cutoff: '2026-10-02', format: 'doubles', courts, missingOfficialCourts, priorVerified: true })
describe('rating evidence quality', () => {
  it('excludes future courts and duplicate observations', () => {
    const result = summarize([court('1', '2026-09-01'), court('1', '2026-09-01'), court('2', '2026-11-01')])
    expect(result.courts).toBe(1)
    expect(result.distinctPartners).toBe(1)
  })
  it('does not treat repeated partnerships or same-day volume as diverse evidence', () => {
    const result = summarize(['1', '2', '3', '4'].map(id => court(id, '2026-09-01')))
    expect(result.reasons).toEqual(['few_playing_days', 'limited_partner_variety'])
  })
  it('keeps incomplete official history provisional despite extensive evidence', () => {
    const result = summarize([court('1', '2026-09-01'), court('2', '2026-09-02', 'other'), court('3', '2026-09-03')], 1)
    expect(result.reasons).toEqual(['missing_official_results'])
    expect(result.movementForecastAvailable).toBe(false)
    expect(result.confidenceCalibrated).toBe(false)
  })
  it('reports richer evidence without inventing forecast confidence', () => {
    const result = summarize([court('1', '2026-09-01'), court('2', '2026-09-02', 'other'), court('3', '2026-09-03')])
    expect(result.provisional).toBe(false)
    expect(result.confidenceCalibrated).toBe(false)
  })
  it('rejects impossible dates and invalid missing-result counts', () => {
    expect(() => summarize([court('1', '2026-02-30')])).toThrow()
    expect(() => summarize([], -1)).toThrow()
  })
})

it('flags distant network anchors as provisional despite diverse match evidence', () => {
  const result = summarizeRatingEvidence({ cutoff: '2026-10-02', format: 'doubles', courts: [court('1', '2026-09-01'), court('2', '2026-09-02', 'other'), court('3', '2026-09-03')], missingOfficialCourts: 0, priorVerified: true, anchorDistance: 3 })
  expect(result.reasons).toEqual(['distant_rating_anchor'])
  expect(result.provisional).toBe(true)
})
