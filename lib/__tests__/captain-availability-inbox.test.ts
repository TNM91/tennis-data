import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/availability/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}:`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Captain availability inbox', () => {
  it('keeps response triage in the existing availability workflow', () => {
    expect(source).toContain("type AvailabilityInboxFilter = 'attention' | 'in-play' | 'all'")
    expect(source).toContain("useState<AvailabilityInboxFilter>('attention')")
    expect(source).toContain('const visibleAvailabilityPlayers = useMemo(() =>')
    expect(source).toContain("availabilityInboxFilter === 'attention'")
    expect(source).toContain("player.status === 'unanswered' || player.status === 'maybe'")
    expect(source).toContain("availabilityInboxFilter === 'in-play'")
    expect(source).toContain(".toSorted((left, right) => (")
  })

  it('surfaces a one-tap reminder and an actionable empty state', () => {
    expect(source).toContain('Send reminder')
    expect(source).toContain('aria-label="Availability inbox filter"')
    expect(source).toContain('Nothing needs attention right now.')
    expect(source).toContain('Show all players')
  })

  it('keeps inbox controls safe on narrow screens', () => {
    for (const styleName of [
      'availabilityInboxHeaderStyle',
      'availabilityInboxHeaderCopyStyle',
      'availabilityInboxFilterRowStyle',
      'availabilityInboxEmptyStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }
    expect(styleBlock('availabilityInboxFilterStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('availabilityInboxFilterStyle')).toContain("overflowWrap: 'anywhere'")
  })
})
