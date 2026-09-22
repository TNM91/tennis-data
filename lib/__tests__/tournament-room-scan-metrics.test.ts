import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('tournament room scan metrics', () => {
  it('surfaces saved-room award and alert readiness', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/tournament-builder-workspace.tsx'), 'utf8')

    expect(source).toContain('alertCounts')
    expect(source).toContain('awardCounts')
    expect(source).toContain('loadAlertCounts')
    expect(source).toContain('loadAwardCounts')
    expect(source).toContain("readTiqAwardsForSource('tournament', record.id)")
    expect(source).toContain('recordFinishChecklist')
    expect(source).toContain('recordReadinessRailStyle')
    expect(source).toContain('recordReadinessItemStyle')
    expect(source).toContain("label: 'Awards'")
    expect(source).toContain("label: 'Recap'")
    expect(source).toContain('value: input.alertCount ? `${input.alertCount} drafted` : \'Open\'')
    expect(source).toContain('loadRecordSection')
    expect(source).toContain('recordNextMove')
    expect(source).toContain("recordNextMove.href.replace('#', '')")
    expect(source).toContain("item.href.replace('#', '')")
    expect(source).toContain('recordActionGridStyle')
    expect(source).toContain('recordToolRowStyle')
    expect(source).toContain('recordRemoveButtonStyle')
  })
})
