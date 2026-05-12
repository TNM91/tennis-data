import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const exploreSource = readFileSync(join(process.cwd(), 'app/explore/page.tsx'), 'utf8')
const rankingsSource = readFileSync(join(process.cwd(), 'app/rankings/page.tsx'), 'utf8')

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
})
