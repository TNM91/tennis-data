import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const route = readFileSync(join(process.cwd(), 'app/api/captain/lineup-builder/route.ts'), 'utf8')
const page = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8')
const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260928000100_create_captain_roster_aliases.sql'), 'utf8')

describe('captain opponent roster picker', () => {
  it('offers only uploaded rosters from the active league and flight', () => {
    expect(route).toContain(".from('team_roster_members')")
    expect(route).toContain(".eq('league_name', leagueName)")
    expect(route).toContain(".eq('flight', flight)")
    expect(route).toContain('availableOpponentRosters')
    expect(page).toContain('Use existing roster')
    expect(page).toContain('Only uploaded rosters from {leagueName')
    expect(page).toContain('roster.playerCount} player')
  })

  it('requires captain team access and verifies the selected roster before saving', () => {
    expect(route).toContain("if (action === 'link-opponent-roster')")
    expect(route.indexOf('if (!canManageSelectedTeam)')).toBeLessThan(route.indexOf("if (action === 'link-opponent-roster')"))
    expect(route).toContain(".eq('normalized_team_name', normalizedSourceTeamName)")
    expect(route).toContain(".from('captain_roster_aliases')")
    expect(route).toContain("onConflict: 'normalized_captain_team_name,normalized_scheduled_team_name,league_name,flight'")
  })

  it('remembers the confirmed roster link without changing the imported roster', () => {
    expect(migration).toContain('create table if not exists public.captain_roster_aliases')
    expect(migration).toContain('normalized_captain_team_name text not null')
    expect(migration).toContain('normalized_source_team_name text not null')
    expect(migration).toContain('unique (normalized_captain_team_name, normalized_scheduled_team_name, league_name, flight)')
    expect(migration).toContain('alter table public.captain_roster_aliases enable row level security')
    expect(page).toContain("action: 'link-opponent-roster'")
    expect(page).toContain('This roster will be used for future matches with ${opponentTeam}.')
  })

  it('keeps upload and manual entry available as fallbacks', () => {
    expect(page).toContain('Upload TennisLink roster')
    expect(page).toContain("manualOpponentRosterOpen ? 'Close names' : 'Enter names'")
    expect(page).toContain('Use a different roster')
  })
})
