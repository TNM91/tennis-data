import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Captain saved lineup comparison', () => {
  it('compares the working draft against a matching saved version', () => {
    expect(source).toContain('const comparisonCandidates = useMemo')
    expect(source).toContain('scenario.match_date !== matchDate')
    expect(source).toContain('scenario.opponent_team !== opponentTeam')
    expect(source).toContain('const lineupVersionComparison = useMemo')
    expect(source).toContain('compareLineupStrength(')
    expect(source).toContain('slotPlayerSignature')
  })

  it('shows the overall shift, court changes, player swaps, and a captain call without mobile overflow', () => {
    expect(source).toContain('aria-label="Saved lineup comparison"')
    expect(source).toContain('Match outlook')
    expect(source).toContain('Courts changed')
    expect(source).toContain('Biggest shift')
    expect(source).toContain('Captain call')
    expect(source).toContain('beforePlayers} → {court.afterPlayers')

    for (const styleName of [
      'lineupVersionCompareShellStyle',
      'lineupVersionCompareHeaderStyle',
      'lineupVersionCompareGridStyle',
      'lineupVersionCompareCourtGridStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }
    expect(styleBlock('lineupVersionCompareGridStyle')).toContain("repeat(auto-fit, minmax(min(100%, 180px), 1fr))")
  })
})
