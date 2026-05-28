import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/compete/schedule/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const pattern = new RegExp(`const ${styleName}(?:: CSSProperties)? = ([\\s\\S]*?)(?=\\nconst |\\nfunction |\\nexport |$)`)
  const match = source.match(pattern)
  if (!match) throw new Error(`Missing style block: ${styleName}`)
  return match[0]
}

describe('compete schedule scheduler status', () => {
  it('connects the schedule page to the shared league scheduler flow', () => {
    expect(source).toContain('schedulerStatusItems')
    expect(source).toContain('title="Publish dates"')
    expect(source).toContain('title="Team book"')
    expect(source).toContain('title="Team week"')
    expect(source).toContain('Confirmed matches stay visible before they become team prep or scorebook work.')
    expect(source).toContain('League scheduler status')
    expect(source).toContain('Shared scheduler')
    expect(source).toContain('Confirmed dates become prep, messages, and result entry.')
    expect(source).toContain("label: 'Dates'")
    expect(source).toContain("label: 'Sites'")
    expect(source).toContain("label: 'Teams'")
    expect(source).toContain('schedulerStripStyle')
    expect(source).toContain('schedulerStatusGridStyle')
    expect(source).toContain('Start the shared calendar.')
    expect(source).toContain('League setup')
    expect(source).toContain('Upload schedule')
    expect(source).toContain('Coordinate dates')
    expect(source).toContain('Team results')
    expect(source).toContain('function EmptyScheduleState')
    expect(source).toContain('emptySchedulerStyle')
    expect(source).toContain('rowReadinessItems')
    expect(source).toContain("label: 'Date'")
    expect(source).toContain("label: 'Site'")
    expect(source).toContain('Fill schedule')
    expect(source).toContain('Open prep')
    expect(source).toContain('rowReadinessGridStyle')
    expect(source).toContain('rowNextActionStyle')
    expect(source).not.toContain('title="Captain Week View"')
    expect(source).not.toContain('title="Scenario Builder"')
    expect(source).not.toContain('title="My Lab"')
    expect(source).not.toContain('Build Smarter Lineups')
  })

  it('keeps the empty scheduler action panel mobile-safe', () => {
    expect(source).toContain('emptyScheduleActions')
    expect(styleBlock('emptySchedulerStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('emptyActionGridStyle')).toContain('minWidth: 0')
    expect(styleBlock('emptyActionStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock('emptyActionStyle')).toContain("whiteSpace: 'normal'")
  })
})
