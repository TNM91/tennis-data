import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/team-brief/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}:`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Captain team brief mobile readiness', () => {
  it('keeps the phone hero focused on real send readiness', () => {
    expect(source).toContain('const teamBriefReadiness = [')
    expect(source).toContain("label: 'Match plan'")
    expect(source).toContain("label: 'Courts'")
    expect(source).toContain("label: 'Risk watch'")
    expect(source).toContain('aria-label="Team send readiness"')
    expect(source).toContain('{isMobile ? (')
  })

  it('keeps readiness checks compact without mobile overflow', () => {
    expect(styleBlock('mobileReadinessRailStyle')).toContain("gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'")
    expect(styleBlock('mobileReadinessRailStyle')).toContain('minWidth: 0')
    expect(styleBlock('mobileReadinessCardStyle')).toContain('minWidth: 0')
    expect(styleBlock('mobileReadinessLabelStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('mobileReadinessDetailStyle')).toContain("overflowWrap: 'anywhere'")
  })
})
