import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start, styleName).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('team detail week path', () => {
  it('answers the captain match-week questions on team detail pages', () => {
    expect(source).toContain('PRODUCT_MOTTO')
    expect(source).toContain('Team Hub context that helps captains plan the week')
    expect(source).toContain('Team week path')
    expect(source).toContain('Answer match week from your phone.')
    expect(source).toContain('Who is available?')
    expect(source).toContain('What lineup gives us the best chance?')
    expect(source).toContain('Who should play together?')
    expect(source).toContain('What should I communicate?')
    expect(source).toContain('data-team-week-job={item.job}')
    expect(source).toContain('aria-label={`${item.cta}: ${item.question}`}')
  })

  it('keeps the team week path compact and mobile-safe', () => {
    expect(source).toContain('teamWeekPathStyle(isTablet)')
    expect(styleBlock('teamWeekPathStyle')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(styleBlock('teamWeekPathGridStyle')).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)'")
    expect(styleBlock('teamWeekActionCardStyle')).toContain('minHeight: 146')
    expect(styleBlock('teamWeekActionCardStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('teamWeekActionTextStyle')).toContain("overflowWrap: 'anywhere'")
  })
})
