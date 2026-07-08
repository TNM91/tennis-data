import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('tournament setup readiness', () => {
  it('shows compact readiness signals before directors save a tournament', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/tournament-builder-workspace.tsx'), 'utf8')

    expect(source).toContain('setupReadinessItems')
    expect(source).toContain('Tournament setup readiness')
    expect(source).toContain('setupReadinessGridStyle')
    expect(source).toContain('setupReadinessItemStyle')
    expect(source).toContain('setupPathItems')
    expect(source).toContain('Event setup path')
    expect(source).toContain('Name the room')
    expect(source).toContain('Set the field')
    expect(source).toContain('Save and schedule')
    expect(source).toContain('setupPathStyle')
    expect(source).toContain('setupPathStepReadyStyle')
    expect(source).toContain("label: 'Field'")
    expect(source).toContain("value: startsOn || 'TBD'")
  })
})
