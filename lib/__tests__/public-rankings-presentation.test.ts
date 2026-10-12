import { describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ candidates: [] as Array<{ id: string; name: string; location: null; overall_dynamic_rating: number }>, evidence: [] as unknown[] }))
vi.mock('../public-player-evidence-server', () => ({
  createPublicEvidenceClient: () => {
    const query = { select: () => query, gte: () => query, lte: () => query, order: () => query, limit: async () => ({ data: mocks.candidates, error: null }) }
    return { from: () => query }
  },
  getPublicPlayerEvidenceForIds: async () => mocks.evidence,
}))
import { getPublicRankingsEvidence } from '../public-competition-evidence-server'

describe('public ranking output', () => {
  it('returns free two-decimal ratings and scored evidence', async () => {
    mocks.candidates = [{ id: 'leader', name: 'Alex', location: null, overall_dynamic_rating: 4.237 }, { id: 'sparse', name: 'Blair', location: null, overall_dynamic_rating: 4.126 }]
    mocks.evidence = [{ player: { id: 'leader', name: 'Alex', location: null }, results: [{ id: '1' }, { id: '2' }, { id: '3' }] }, { player: { id: 'sparse', name: 'Blair', location: null }, results: [{ id: '4' }] }]
    const rows = await getPublicRankingsEvidence()
    expect(rows).toHaveLength(1)
    expect(rows[0].publicRead).toBe('4.24')
    expect(rows[0].results).toHaveLength(3)
    expect(JSON.stringify(rows)).not.toContain('4.237')
    expect(JSON.stringify(rows)).not.toContain('overall_dynamic_rating')
  })
})
