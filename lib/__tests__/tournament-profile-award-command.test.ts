import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('tournament profile and award command strips', () => {
  it('puts profile and award follow-through before lower tournament controls', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/tournament-builder-workspace.tsx'), 'utf8')

    expect(source).toContain('profileCommandItems')
    expect(source).toContain('aria-label="Profile command"')
    expect(source).toContain("label: 'Profile links'")
    expect(source).toContain("label: 'Rating source'")
    expect(source).toContain("label: 'Trophy cases'")
    expect(source).toContain('Create profiles so results can follow each player.')
    expect(source).toContain('New profiles start with S until verified results improve the rating source.')
    expect(source).toContain('profileCommandStyle')
    expect(source).toContain('profileCommandValueStyle')

    expect(source).toContain('awardCommandItems')
    expect(source).toContain('aria-label="Award command"')
    expect(source).toContain("label: 'Recipients'")
    expect(source).toContain("label: 'Award follow-through'")
    expect(source).toContain('Confirm names before creating certificates.')
    expect(source).toContain('Create awards, then send the recap.')
    expect(source).toContain('awardCommandStyle')
    expect(source).toContain('awardCommandValueStyle')
  })
})
