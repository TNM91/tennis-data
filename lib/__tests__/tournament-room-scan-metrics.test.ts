import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('tournament room scan metrics', () => {
  it('surfaces awards and alert counts on saved tournament cards', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/tournament-builder-workspace.tsx'), 'utf8')

    expect(source).toContain('alertCounts')
    expect(source).toContain('awardCounts')
    expect(source).toContain('loadAlertCounts')
    expect(source).toContain('loadAwardCounts')
    expect(source).toContain("readTiqAwardsForSource('tournament', record.id)")
    expect(source).toContain('<Stat label="Awards"')
    expect(source).toContain('<Stat label="Alerts"')
    expect(source).toContain('loadRecordSection')
    expect(source).toContain('recordNextMove')
    expect(source).toContain("recordNextMove.href.replace('#', '')")
    expect(source).toContain('recordActionGridStyle')
    expect(source).toContain('recordToolRowStyle')
    expect(source).toContain('recordRemoveButtonStyle')
  })
})
