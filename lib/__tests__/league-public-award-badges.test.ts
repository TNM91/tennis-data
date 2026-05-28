import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('public TIQ league award badges', () => {
  it('shows league award badges from standings to trophy cases or certificates', () => {
    const source = readFileSync(join(process.cwd(), 'app/explore/leagues/tiq/[league]/page.tsx'), 'utf8')

    expect(source).toContain('loadRecentTiqAwards')
    expect(source).toContain('leagueAwardsByPlayerKey')
    expect(source).toContain('LeagueStandingAwardBadges')
    expect(source).toContain('leagueAwardBadgeStyle')
    expect(source).toContain('leagueAwardCaseLinkStyle')
    expect(source).toContain('Trophy case')
    expect(source).toContain('#profile-trophy-case')
    expect(source).toContain('/awards/')
  })
})
