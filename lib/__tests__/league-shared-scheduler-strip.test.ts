import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('league shared scheduler strip', () => {
  it('turns the league workspace calendar into a clear scheduler entry point', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'), 'utf8')

    expect(source).toContain('Shared scheduler')
    expect(source).toContain('Dates, courts, confirmations, and scores stay in one lane.')
    expect(source).toContain('Pending dates')
    expect(source).toContain('Confirmed calendar')
    expect(source).toContain('Post results')
    expect(source).toContain('sharedSchedulerItems')
    expect(source).toContain('sharedCalendarReadinessGridStyle')
    expect(source).toContain('sharedCalendarReadinessItemStyle')
    expect(source).toContain("label: 'Schedule'")
    expect(source).toContain("label: 'Requests'")
    expect(source).toContain("label: 'Results'")
    expect(source).toContain('sharedSchedulerNextMove')
    expect(source).toContain('Create the season shell')
    expect(source).toContain('Approve waiting participants')
    expect(source).toContain('Clear result review cues')
    expect(source).toContain('sharedCalendarNextMoveStyle')
    expect(source).toContain('sharedCalendarStripStyle')
    expect(source).toContain('sharedCalendarStepGridStyle')
  })
})
