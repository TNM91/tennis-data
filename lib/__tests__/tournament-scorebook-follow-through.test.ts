import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('tournament scorebook follow-through', () => {
  it('shows schedule, player, and result readiness on each scorebook match', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/tournament-builder-workspace.tsx'), 'utf8')

    expect(source).toContain('matchFollowThroughItems')
    expect(source).toContain("label: 'Slot'")
    expect(source).toContain("label: 'Players'")
    expect(source).toContain("label: 'Result'")
    expect(source).toContain('Save slot')
    expect(source).toContain('Review result')
    expect(source).toContain('Record winner')
    expect(source).toContain('Await players')
    expect(source).toContain('scorebookCommandItems')
    expect(source).toContain('Scorebook command')
    expect(source).toContain("label: 'Schedule'")
    expect(source).toContain("label: 'Player update'")
    expect(source).toContain('scorebookCommandStyle')
    expect(source).toContain('scorebookCommandValueStyle')
    expect(source).toContain('matchFollowThroughGridStyle')
    expect(source).toContain('matchPrimaryActionStyle')
    expect(source).toContain('readinessDotReadyStyle')
    expect(source).toContain('readinessDotWaitingStyle')
  })
})
