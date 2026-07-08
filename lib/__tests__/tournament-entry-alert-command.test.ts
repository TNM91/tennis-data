import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('tournament entry and alert command strips', () => {
  it('puts entry and alert next moves before dense tournament controls', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/tournament-builder-workspace.tsx'), 'utf8')

    expect(source).toContain('entryCommandItems')
    expect(source).toContain('aria-label="Entry command"')
    expect(source).toContain("label: 'Registration'")
    expect(source).toContain("label: 'Entry queue'")
    expect(source).toContain("label: 'Player profiles'")
    expect(source).toContain('Open setup when you want public entry.')
    expect(source).toContain('Create TIQ profiles for entrant follow-through.')
    expect(source).toContain('entryCommandStyle')
    expect(source).toContain('entryCommandValueStyle')

    expect(source).toContain('alertCommandItems')
    expect(source).toContain('aria-label="Alert command"')
    expect(source).toContain("label: 'Contact list'")
    expect(source).toContain("label: 'Opt-ins'")
    expect(source).toContain("label: 'Drafts'")
    expect(source).toContain('Confirm opt-in before delivery review.')
    expect(source).toContain('Write the useful court, schedule, or recap update.')
    expect(source).toContain('alertCommandStyle')
    expect(source).toContain('alertCommandValueStyle')
  })
})
