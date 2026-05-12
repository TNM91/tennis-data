import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const exploreSource = readFileSync(join(process.cwd(), 'app/explore/page.tsx'), 'utf8')
const rankingsSource = readFileSync(join(process.cwd(), 'app/rankings/page.tsx'), 'utf8')
const playersSource = readFileSync(join(process.cwd(), 'app/players/page.tsx'), 'utf8')
const teamsSource = readFileSync(join(process.cwd(), 'app/teams/page.tsx'), 'utf8')

describe('Explore responsive surfaces', () => {
  it('keeps Explore action cards protected from narrow mobile overflow', () => {
    expect(exploreSource).toContain('const actionBody: CSSProperties')
    expect(exploreSource).toContain('const actionFooterRow: CSSProperties')
    expect(exploreSource).toContain("overflowWrap: 'anywhere'")
    expect(exploreSource).toContain("flexWrap: 'wrap'")
    expect(exploreSource).toContain('minWidth: 0')
  })

  it('keeps rankings compact cards single-column friendly on mobile', () => {
    expect(rankingsSource).toContain('dynamicLeaderboardActionGrid')
    expect(rankingsSource).toContain("gridTemplateColumns: isSmallMobile ? '1fr'")
    expect(rankingsSource).toContain('const compactRankingCardStyle: CSSProperties')
    expect(rankingsSource).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 112px), 1fr))'")
    expect(rankingsSource).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 132px), 1fr))'")
    expect(rankingsSource).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps public discovery empty states actionable and Data Assist aware', () => {
    expect(playersSource).toContain('Public discovery only shows reviewed player context')
    expect(playersSource).toContain('Reset filters')
    expect(playersSource).toContain('emptyStateActionRow')
    expect(playersSource).toContain('DATA_ASSIST_STORY.cta')

    expect(teamsSource).toContain('Public discovery only shows reviewed team context')
    expect(teamsSource).toContain('Reset team filters')
    expect(teamsSource).toContain('emptyActionRow')
    expect(teamsSource).toContain('DATA_ASSIST_STORY.cta')
  })
})
