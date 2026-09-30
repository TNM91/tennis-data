import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspaceSource = readFileSync(join(process.cwd(), 'app/league-coordinator/weekly/weekly-league-workspace.tsx'), 'utf8')

describe('weekly league court plan', () => {
  it('previews the recommendation before publishing and keeps manual court controls', () => {
    expect(workspaceSource).toContain('buildLeagueWeeklyCourtPlan')
    expect(workspaceSource).toContain('Preview before publishing')
    expect(workspaceSource).toContain('Nothing is shared until you publish this plan.')
    expect(workspaceSource).toContain('Move ${player} to a court')
    expect(workspaceSource).toContain('Publish this court plan')
    expect(workspaceSource).toContain("strategy: league.weeklySettings.autoGenerateCourts ? 'balanced' : 'manual'")
    expect(workspaceSource).toContain('TIQ doubles ratings set the starting point.')
    expect(workspaceSource).toContain('TIQ-rated players')
    expect(workspaceSource).toContain('TIQ profile not connected')
  })
})
