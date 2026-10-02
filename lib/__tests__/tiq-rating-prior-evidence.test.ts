import { describe, expect, it } from 'vitest'
import { recoverCapturedComputerPrior } from '../tiq-rating-prior-evidence'
const base = { playerId: 'p', name: 'David Cabrera', profileUrl: 'https://www.tennisrecord.com/adult/profile.aspx?playername=David%20Cabrera&s=2', sourcePageId: 'source', capturedAt: '2026-08-24T00:00:00Z', season: 2025 }
const html = '<h1>Player Stats</h1><h2>David Cabrera</h2><div>(Saint Charles, MO) Male 4.5 C 12/31/2025 Estimated Dynamic Rating 4.2519 8/23/2026</div>'
describe('captured historical computer-level evidence', () => {
  it('recovers the explicit dated official-level label without importing the proprietary estimate', () => {
    expect(recoverCapturedComputerPrior({ ...base, html })).toMatchObject({ level: 4.5, season: 2025, independentlyVerified: false, sourcePageId: 'source' })
  })
  it('rejects another owner, undated/current-year labels, self ratings and another host', () => {
    expect(recoverCapturedComputerPrior({ ...base, html, name: 'Someone Else' })).toBeNull()
    expect(recoverCapturedComputerPrior({ ...base, html: html.replace('12/31/2025', '') })).toBeNull()
    expect(recoverCapturedComputerPrior({ ...base, html, season: 2024 })).toBeNull()
    expect(recoverCapturedComputerPrior({ ...base, html: html.replace('4.5 C', '4.5 S') })).toBeNull()
    expect(recoverCapturedComputerPrior({ ...base, html, profileUrl: 'https://evil.example/adult/profile.aspx' })).toBeNull()
  })
})
