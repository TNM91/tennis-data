import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(join(process.cwd(), 'app/compete/teams/page.tsx'), 'utf8')

describe('My Teams lineup handoff', () => {
  it('builds an explicit scoped Builder link from the team card', () => {
    expect(page).toContain("import { buildCaptainScopedHref } from '@/lib/captain-memory'")
    expect(page).toContain("const lineupHref = buildCaptainScopedHref('/captain/lineup-builder', {")
    expect(page).toContain('team: group.teamName')
    expect(page).toContain('competitionLayer,')
    expect(page).toContain("const competitionLayer = group.connection.sourceType === 'tiq_entry' ? 'tiq' : 'usta'")
    expect(page).not.toContain("group.connection.sourceType === 'tiq_entry' || group.tiqLeagues.length > 0")
  })
})
