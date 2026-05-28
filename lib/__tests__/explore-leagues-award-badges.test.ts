import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('explore leagues award badges', () => {
  it('surfaces league award winners as linked badges without nesting card anchors', () => {
    const source = readFileSync(join(process.cwd(), 'app/explore/leagues/page.tsx'), 'utf8')

    expect(source).toContain('loadRecentTiqAwards')
    expect(source).toContain('awardsByLeagueId')
    expect(source).toContain('LeagueAwardBadges')
    expect(source).toContain('leagueAwardPillStyle')
    expect(source).toContain('/awards/')
    expect(source).toContain('<article key={league.key} style={cardStyle}>')
    expect(source).not.toContain('<Link key={league.key} href={buildExploreLeagueHref(league)} style={cardStyle}>')
  })
})
