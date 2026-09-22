import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const scenarioBuilder = readFileSync(join(process.cwd(), 'app/captain/scenario-builder/page.tsx'), 'utf8')
const lineupBuilder = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8')

describe('Captain match-plan handoff', () => {
  it('keeps the winning scenario scoped when moving to the team brief', () => {
    expect(scenarioBuilder).toContain('const teamBriefHref = (scenario: ScenarioRow | null) =>')
    expect(scenarioBuilder).toContain("return `/captain/team-brief?${params.toString()}`")
    expect(scenarioBuilder).toContain("params.set('team', team)")
    expect(scenarioBuilder).toContain("params.set('league', league)")
    expect(scenarioBuilder).toContain("params.set('flight', flight)")
    expect(scenarioBuilder).toContain("params.set('date', eventDate)")
    expect(scenarioBuilder).toContain("params.set('opponent', opponent)")
    expect(scenarioBuilder).toContain('<GhostLink href={teamBriefHref(winningScenario)}>Open team brief</GhostLink>')
  })

  it('keeps the active lineup match context intact when opening the team brief', () => {
    expect(lineupBuilder).toContain("buildCaptainScopedHref('/captain/team-brief'")
    expect(lineupBuilder).toContain('competitionLayer,')
    expect(lineupBuilder).toContain('team: teamName,')
    expect(lineupBuilder).toContain('league: leagueName,')
    expect(lineupBuilder).toContain('flight,')
    expect(lineupBuilder).toContain('date: matchDate,')
    expect(lineupBuilder).toContain('opponent: opponentTeam,')
    expect(lineupBuilder).toContain('<GhostLink href={teamBriefHref}>Open team brief</GhostLink>')
  })
})
