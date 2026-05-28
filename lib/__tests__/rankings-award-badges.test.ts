import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('rankings award badges', () => {
  it('shows linked award badges in rankings rows and compact cards', () => {
    const source = readFileSync(join(process.cwd(), 'app/rankings/page.tsx'), 'utf8')

    expect(source).toContain('loadRecentTiqAwards')
    expect(source).toContain('awardsByPlayerId')
    expect(source).toContain('RankingAwardBadges')
    expect(source).toContain('rankingAwardBadgeStyle')
    expect(source).toContain('rankingAwardCaseLinkStyle')
    expect(source).toContain('/awards/')
    expect(source).toContain('#profile-trophy-case')
    expect(source).toContain('Trophy case')
    expect(source).toContain("award.sourceType === 'league' ? 'League' : 'Tournament'")
  })
})
