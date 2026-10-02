import { describe, expect, it } from 'vitest'
import { validateTennisRecordAnnualPair, tennisRecordAnnualIdentity, type AnnualRatingLabel } from '../tiq-annual-rating-pairs'
const start: AnnualRatingLabel = { playerId: 'a', level: 4, designation: 'computer', effectiveDate: '2024-12-31', sourceUrl: 'https://www.tennisrecord.com/adult/profile.aspx?playername=Alan%20Lum&s=2' }
const end: AnnualRatingLabel = { ...start, level: 4.5, effectiveDate: '2025-12-31' }
describe('annual rating source identities', () => {
  it('admits consecutive computer labels on the same source identity as secondary evidence', () => {
    expect(validateTennisRecordAnnualPair(start, end)).toMatchObject({ admitted: true, independentlyVerified: false })
  })
  it('rejects same-name profiles with different disambiguation parameters despite a shared canonical ID', () => {
    expect(validateTennisRecordAnnualPair(start, { ...end, sourceUrl: end.sourceUrl.replace('s=2', 's=5') })).toMatchObject({ admitted: false, reasons: ['different_source_profiles_require_identity_review'] })
    expect(validateTennisRecordAnnualPair(start, { ...end, sourceUrl: end.sourceUrl.replace('&s=2', '') }).admitted).toBe(false)
  })
  it('normalizes encoding and parameter order without discarding identity parameters', () => {
    expect(tennisRecordAnnualIdentity('https://tennisrecord.com/adult/profile.aspx?s=2&playername=ALAN+LUM')).toBe(tennisRecordAnnualIdentity(start.sourceUrl))
  })
  it('rejects malformed dates, noncomputer labels and unsupported source pages', () => {
    expect(validateTennisRecordAnnualPair(start, { ...end, effectiveDate: '2025-09-30' }).admitted).toBe(false)
    expect(validateTennisRecordAnnualPair(start, { ...end, designation: 'self' }).admitted).toBe(false)
    expect(validateTennisRecordAnnualPair(start, { ...end, sourceUrl: 'https://example.com/profile' }).admitted).toBe(false)
  })
})
