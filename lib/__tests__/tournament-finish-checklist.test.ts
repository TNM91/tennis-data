import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('tournament finish checklist', () => {
  it('shows the full director loop under one next action', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/tournament-builder-workspace.tsx'), 'utf8')

    expect(source).toContain('buildTournamentFinishChecklist')
    expect(source).toContain('tournamentFinishChecklist')
    expect(source).toContain('Tournament finish checklist')
    expect(source).toContain('finishChecklistStyle')
    expect(source).toContain('finishChecklistItemStyle')
    expect(source).toContain("label: 'Field'")
    expect(source).toContain("label: 'Profiles'")
    expect(source).toContain("label: 'Schedule'")
    expect(source).toContain("label: 'Results'")
    expect(source).toContain("label: 'Awards'")
    expect(source).toContain("label: 'Recap'")
  })
})
