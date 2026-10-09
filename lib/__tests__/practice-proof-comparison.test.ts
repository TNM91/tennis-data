import { describe, expect, it } from 'vitest'
import { getPreviousPracticeProof } from '../practice-proof-comparison'
const current = { id: 'now', cardId: 'split-step-rhythm', focusId: 'movement', workType: 'court', context: 'alone', drillTitle: 'Split-Step Rhythm', rating: 3, completedAt: '2026-10-09T15:00:00Z' }
const earlier = { ...current, id: 'earlier', rating: 0, completedAt: '2026-10-08T15:00:00Z' }
describe('same-drill proof comparison', () => {
  it('selects the latest earlier same-setup rep and keeps a zero score', () => {
    expect(getPreviousPracticeProof(current, [current, { ...earlier, id: 'older', completedAt: '2026-10-07T15:00:00Z' }, earlier])).toEqual(earlier)
  })
  it('does not mix drills, focuses, work types, setups, invalid scores, or future records', () => {
    const excluded = [{ ...earlier, cardId: 'other' }, { ...earlier, focusId: 'serve' }, { ...earlier, workType: 'physical' }, { ...earlier, context: 'partner' }, { ...earlier, rating: 6 }, { ...earlier, rating: NaN }, { ...earlier, completedAt: 'invalid' }, { ...earlier, completedAt: '2026-10-10T15:00:00Z' }]
    expect(getPreviousPracticeProof(current, excluded)).toBeNull()
  })
  it('compares legacy records only when both lack a card ID and their titles match', () => {
    const legacy = { ...current, cardId: undefined }
    expect(getPreviousPracticeProof(legacy, [earlier])).toBeNull()
    expect(getPreviousPracticeProof(legacy, [{ ...earlier, cardId: undefined }])?.rating).toBe(0)
    expect(getPreviousPracticeProof({ ...legacy, completedAt: 'invalid' }, [earlier])).toBeNull()
  })
})
