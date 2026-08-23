import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/weekly-brief/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}:`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Captain weekly brief mobile pulse', () => {
  it('turns the match-week read into a compact phone-first pulse', () => {
    expect(source).toContain('const mobileWeekPulse = [')
    expect(source).toContain("label: 'Courts'")
    expect(source).toContain("label: 'Available'")
    expect(source).toContain("label: 'Replies'")
    expect(source).toContain('aria-label="Captain match week pulse"')
    expect(source).toContain('Match Week Pulse')
    expect(source).toContain('weekReadinessPercent')
    expect(source).toContain('Next move')
    expect(source).toContain('matchWeekPulseDetail')
  })

  it('keeps the compact pulse and one next move resilient on narrow screens', () => {
    expect(styleBlock('mobileWeekPulseShellStyle')).toContain('minWidth: 0')
    expect(styleBlock('mobileWeekPulseSummaryStyle')).toContain('minWidth: 0')
    expect(styleBlock('mobileWeekPulseStyle')).toContain("gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'")
    expect(styleBlock('mobileWeekPulseStyle')).toContain('minWidth: 0')
    expect(styleBlock('mobileWeekPulseCardStyle')).toContain('minWidth: 0')
    expect(styleBlock('mobileWeekPulseDetailStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('mobileWeekPulseNextStyle')).toContain("gridTemplateColumns: 'minmax(0, 1fr) auto'")
    expect(styleBlock('mobileWeekPulseNextCopyStyle')).toContain('minWidth: 0')
    expect(styleBlock('mobileWeekPulseNextDetailStyle')).toContain("overflowWrap: 'anywhere'")
  })
})
