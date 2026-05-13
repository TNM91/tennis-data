import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const matchupSource = readFileSync(join(process.cwd(), 'app/matchup/page.tsx'), 'utf8')

describe('matchup mobile layout guards', () => {
  it('collapses dense setup and comparison rows on narrow screens', () => {
    expect(matchupSource).toContain('const dynamicIdentitySetupStripStyle: CSSProperties')
    expect(matchupSource).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)'")
    expect(matchupSource).toContain('const compareHeadCopyStyle: CSSProperties')
    expect(matchupSource).toContain("flexWrap: 'wrap',")
    expect(matchupSource).toContain("flex: '1 1 150px'")
    expect(matchupSource).toContain("flex: '0 1 90px'")
    expect(matchupSource).not.toContain("minWidth: '90px'")
  })

  it('keeps long matchup names and head-to-head rows from forcing overflow', () => {
    expect(matchupSource).toContain('const swapSidesRowStyle: CSSProperties')
    expect(matchupSource).toContain('const trajectoryPanelStyle: CSSProperties')
    expect(matchupSource).toContain('const headToHeadMatchRowStyle: CSSProperties')
    expect(matchupSource).toContain("function headToHeadWinnerPillStyle(winner: 'A' | 'B'): CSSProperties")
    expect(matchupSource).toContain("overflowWrap: 'anywhere'")
    expect(matchupSource).toContain("maxWidth: '100%'")
    expect(matchupSource).not.toContain("whiteSpace: 'nowrap'")
  })
})
