import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('compete leagues readiness', () => {
  it('shows league readiness and keeps rows focused on one primary action', () => {
    const source = readFileSync(join(process.cwd(), 'app/compete/leagues/page.tsx'), 'utf8')

    expect(source).toContain('leagueReadinessItems')
    expect(source).toContain("label: 'Teams'")
    expect(source).toContain("label: 'Schedule'")
    expect(source).toContain("label: 'Season'")
    expect(source).toContain("label: 'Players'")
    expect(source).toContain("label: 'Results'")
    expect(source).toContain("label: 'Prompts'")
    expect(source).toContain('leagueReadinessGridStyle')
    expect(source).toContain('leaguePrimaryActionStyle')
    expect(source).toContain('Record results')
    expect(source).toContain('Log result')
    expect(source).toContain('Open league')
    expect(source).not.toContain("const secondaryActionLabel")
    expect(source).not.toContain("const secondaryActionHref")
  })

  it('keeps empty league sections actionable without duplicating row actions', () => {
    const source = readFileSync(join(process.cwd(), 'app/compete/leagues/page.tsx'), 'utf8')

    expect(source).toContain('function EmptyLeagueSection')
    expect(source).toContain('Team seasons start in League Office.')
    expect(source).toContain('Individual play starts with a league room.')
    expect(source).toContain('Create league')
    expect(source).toContain('Browse leagues')
    expect(source).not.toContain('No leagues in this format yet. Create one from League Coordinator.')
    expect(source).toContain('emptyLeagueActionRowStyle')
    expect(source).toContain('emptyLeagueActionStyle')
  })
})
