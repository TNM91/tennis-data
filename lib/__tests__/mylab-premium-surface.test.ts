import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')

describe('My Lab premium surface', () => {
  it('keeps the top routine tennis-specific and Data Assist aware', () => {
    expect(source).toContain('MY_LAB_PREMIUM_SIGNALS')
    expect(source).toContain('MY_LAB_READABILITY_CUES')
    expect(source).toContain('Personal scorecard')
    expect(source).toContain('Match prep')
    expect(source).toContain('Reviewed uploads')
    expect(source).toContain('Use reviewed uploads for scorecards, schedules, and rosters')
    expect(source).toContain('Connect your player record, review what changed, and leave with one action for the next match.')
    expect(source).toContain('Player identity')
    expect(source).toContain('Scorecard review')
    expect(source).toContain('Match-day action')
    expect(source).not.toContain('USTA API')
  })

  it('keeps premium signal cards responsive for light-mode mobile scanning', () => {
    expect(source).toContain('labPremiumSignalGridStyle(isTablet)')
    expect(source).toContain('labPremiumSignalCardStyle')
    expect(source).toContain('gridTemplateColumns: isTablet')
    expect(source).toContain('minmax(0, 1fr)')
    expect(source).toContain('labReadabilityCueGridStyle(isTablet)')
    expect(source).toContain('overflowWrap: \'anywhere\'')
  })
})
