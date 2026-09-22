import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('TennisRecord public team history', () => {
  const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260821000500_add_tennisrecord_public_team_history.sql'), 'utf8')
  const rosterCountsMigration = readFileSync(join(process.cwd(), 'supabase/migrations/20260822000500_add_tennisrecord_public_team_roster_counts.sql'), 'utf8')
  const teamPage = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')
  const teamsDirectory = readFileSync(join(process.cwd(), 'app/teams/page.tsx'), 'utf8')

  it('keeps source roster and match history isolated from canonical tables', () => {
    expect(migration).toContain('tennisrecord_staged_team_memberships')
    expect(migration).toContain('tennisrecord_public_team_roster_context')
    expect(migration).toContain('tennisrecord_public_team_match_history')
    expect(migration).toContain('do not write to public.team_roster_members')
    expect(migration).toContain('canonical_match_id')
  })

  it('shows only unpromoted source history as neutral team activity', () => {
    expect(teamPage).toContain(".is('canonical_match_id', null)")
    expect(teamPage).toContain('Recorded match history')
    expect(teamPage).toContain('Recorded team listing')
    expect(teamPage).toContain('Team activity')
  })

  it('uses source-labeled roster counts to avoid understating team directory players', () => {
    expect(rosterCountsMigration).toContain('tennisrecord_public_team_roster_counts')
    expect(rosterCountsMigration).toContain('count(distinct membership.source_player_key)')
    expect(rosterCountsMigration).toContain('do not establish canonical TenAceIQ team membership')
    expect(teamsDirectory).toContain(".from('tennisrecord_public_team_roster_counts')")
    expect(teamsDirectory).toContain('getDirectoryPlayerCount')
    expect(teamsDirectory).toContain('sourceRosterCount')
    expect(teamsDirectory).toContain('TeamPulseSignal label="Roster"')
    expect(teamsDirectory).toContain('value={rosterCount > 0 ? `${rosterCount} listed` : \'Building\'}')
  })

  it('keeps provider and external-source language out of normal-user copy', () => {
    const teamsDirectory = readFileSync(join(process.cwd(), 'app/teams/page.tsx'), 'utf8')
    const searchPage = readFileSync(join(process.cwd(), 'app/explore/search/page.tsx'), 'utf8')

    expect(teamsDirectory).toContain("value=\"Ready\"")
    expect(teamsDirectory).toContain("'Team context ready'")
    expect(searchPage).toContain("'Team context ready'")
    expect(teamPage).toContain('Recorded match history')
    expect(teamPage).not.toContain('External public context')
    expect(teamPage).not.toContain('External roster listing')
    expect(teamPage).not.toContain('>Source record<')
    expect(teamPage).not.toContain('>Source roster<')
    expect(teamPage).not.toContain('>TennisRecord context<')
    expect(teamPage).not.toContain('TennisRecord-listed player')
  })
})
