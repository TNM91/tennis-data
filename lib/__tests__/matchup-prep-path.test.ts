import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/matchup/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start, styleName).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('matchup prep path', () => {
  it('frames Matchup as a quick compete prep path', () => {
    expect(source).toContain('PRODUCT_MOTTO')
    expect(source).toContain('Matchup prep path')
    expect(source).toContain('Know what matters before match time.')
    expect(source).toContain('What matchup matters?')
    expect(source).toContain('What should I watch first?')
    expect(source).toContain('What do I do next?')
    expect(source).toContain('Matchup is a quick prep read')
    expect(source).toContain('data-matchup-prep-job={item.job}')
  })

  it('keeps the prep path compact and mobile-safe', () => {
    expect(source).toContain('matchupPrepGridStyle(isSmallMobile)')
    expect(styleBlock('matchupPrepPathStyle')).toContain('minWidth: 0')
    expect(styleBlock('matchupPrepPathStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('matchupPrepGridStyle')).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))'")
    expect(styleBlock('matchupPrepCardStyle')).toContain('minHeight: 124')
    expect(styleBlock('matchupPrepCardStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('matchupPrepCardTextStyle')).toContain("overflowWrap: 'anywhere'")
  })
})
