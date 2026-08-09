import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const trackerSource = readFileSync('app/compete/_components/player-entry-tracker.tsx', 'utf8')
const trackerService = readFileSync('lib/player-entry-tracker.ts', 'utf8')
const competePage = readFileSync('app/compete/page.tsx', 'utf8')
const tournamentDesk = readFileSync('app/components/tournament-builder-workspace.tsx', 'utf8')
const leagueOffice = readFileSync('app/components/league-coordinator-workspace.tsx', 'utf8')
const tournamentRegistry = readFileSync('lib/tiq-tournament-registry.ts', 'utf8')
const leagueService = readFileSync('lib/tiq-league-service.ts', 'utf8')
const migration = readFileSync('supabase/migrations/20260809000700_add_player_entry_follow_up.sql', 'utf8')

describe('player entry tracker', () => {
  it('puts signed-in tournament and league requests on Compete with a short status path', () => {
    expect(competePage).toContain('<PlayerEntryTracker />')
    expect(trackerSource).toContain('Know where every request stands.')
    expect(trackerSource).toContain('Needs information')
    expect(trackerSource).toContain('Submitted')
    expect(trackerSource).toContain('Approved')
    expect(trackerSource).toContain('Not approved')
    expect(trackerSource).toContain('Add missing info')
    expect(trackerSource).toContain('Send update')
  })

  it('loads only requests owned by the signed-in profile', () => {
    expect(trackerService).toContain(".eq('submitted_by_user_id', profileId)")
    expect(trackerService).toContain(".eq('created_by_user_id', profileId)")
    expect(migration).toContain('submitted_by_user_id = auth.uid()')
    expect(migration).toContain("created_by_user_id = auth.uid()")
    expect(migration).toContain('security definer')
    expect(migration).toContain('grant execute on function public.resolve_tiq_entry_information')
  })

  it('connects organizer questions and response notifications in both competition desks', () => {
    expect(tournamentDesk).toContain('requestTiqTournamentEntryInformation')
    expect(tournamentDesk).toContain('Request info')
    expect(leagueOffice).toContain('requestTiqPlayerLeagueEntryInformation')
    expect(leagueOffice).toContain('Request info')
    expect(migration).toContain('Tournament entry information updated')
    expect(migration).toContain('League entry information updated')
    expect(tournamentRegistry).toContain("href: '/compete#my-entries'")
    expect(leagueService).toContain("href: '/compete#my-entries'")
  })
})
