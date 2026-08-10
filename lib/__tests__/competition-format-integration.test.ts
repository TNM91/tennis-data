import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('shared competition formats', () => {
  it('drives TIQ league setup and persists the selected team scorecard', () => {
    const workspace = read('app/components/league-coordinator-workspace.tsx')
    const registry = read('lib/tiq-league-registry.ts')
    const service = read('lib/tiq-league-service.ts')
    const migration = read('supabase/migrations/20260801000500_add_shared_competition_formats.sql')

    expect(workspace).toContain('TEAM_MATCH_FORMATS.map')
    expect(workspace).toContain('teamMatchFormatId: event.target.value as TeamMatchFormatId')
    expect(registry).toContain('teamMatchFormatId: TeamMatchFormatId')
    expect(service).toContain('team_match_format_id: normalizeTeamMatchFormatId(record.teamMatchFormatId)')
    expect(migration).toContain("'tri_level'")
    expect(migration).toContain("'mixed_tri_level'")
  })

  it('loads one format into lineup creation and keeps arbitrary saved slots usable downstream', () => {
    const builder = read('app/captain/lineup-builder/page.tsx')
    const scenario = read('app/captain/scenario-builder/page.tsx')
    const messaging = read('app/captain/messaging/page.tsx')
    const results = read('app/components/team-league-results-workspace.tsx')

    expect(builder).toContain(".select('league_name, flight, team_match_format_id, competition_rules')")
    expect(builder).toContain('Automatic · {resolvedMatchFormat.label}')
    expect(builder).toContain('effectiveMatchFormatId')
    expect(scenario).toContain('(raw as Record<string, unknown>).courts')
    expect(scenario).toContain("slotType: inferSlotType(label, extracted.length)")
    expect(messaging).toContain("slotType: inferSlotType(label, players.length)")
    expect(results).toContain('explicitFormatId: league?.teamMatchFormatId')
    expect(results).toContain("teamMatchFormat.slots[Number(defaultLineNumber) - 1]?.discipline")
  })

  it('offers every registered USTA/TIQ draw format in Tournament Desk', () => {
    const workspace = read('app/components/tournament-builder-workspace.tsx')
    const tournament = read('lib/tiq-tournament-registry.ts')
    const migration = read('supabase/migrations/20260801000500_add_shared_competition_formats.sql')

    expect(workspace).toContain('TOURNAMENT_DRAW_FORMATS.map')
    expect(workspace).toContain('getTournamentDrawFormatDefinition(format).label')
    expect(tournament).toContain('normalizeTournamentDrawFormatId(value)')
    expect(migration).toContain("'round_robin_first_match_consolation'")
    expect(migration).toContain("'feed_in_consolation'")
    expect(migration).toContain("'team_tournament'")
  })
})
