import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const teamsSource = readFileSync(join(process.cwd(), 'app/teams/page.tsx'), 'utf8')
const leaguesSource = readFileSync(join(process.cwd(), 'app/leagues/page.tsx'), 'utf8')

describe('Teams and Leagues public intros', () => {
  it('positions Teams publicly while keeping Captain as the paid leadership lane', () => {
    expect(teamsSource).toContain('Team tennis without the group-text chaos.')
    expect(teamsSource).toContain('Find Teams')
    expect(teamsSource).toContain('Open Captain Tools')
    expect(teamsSource).toContain('Team next actions')
    expect(teamsSource).toContain('Pick the match-week job, then open the right tool.')
    expect(teamsSource).toContain('For players')
    expect(teamsSource).toContain('For captains')
    expect(teamsSource).toContain('For opponents')
    expect(teamsSource).toContain('For leagues')
    expect(teamsSource).toContain('TrackedProductLink')
    expect(teamsSource).toContain("eventName: 'captain_tools_clicked'")
    expect(teamsSource).toContain("eventName: 'team_search_submitted'")
    expect(teamsSource).not.toContain('Captain tennis without')
  })

  it('positions Leagues around League Office operations and Data Assist handoff', () => {
    expect(leaguesSource).toContain('Run the season without the spreadsheet chaos.')
    expect(leaguesSource).toContain('Find Leagues')
    expect(leaguesSource).toContain('Open League Office')
    expect(leaguesSource).toContain('League next actions')
    expect(leaguesSource).toContain('Pick the season job, then open the right workspace.')
    expect(leaguesSource).toContain('Find a league or flight')
    expect(leaguesSource).toContain('Publish the season schedule')
    expect(leaguesSource).toContain('Update standings cleanly')
    expect(leaguesSource).toContain('Send corrections to review')
    expect(leaguesSource).toContain('League discovery')
    expect(leaguesSource).toContain('League setup')
    expect(leaguesSource).toContain('Corrections')
    expect(leaguesSource).toContain('Use Data Assist')
    expect(leaguesSource).toContain('TrackedProductLink')
    expect(leaguesSource).toContain("eventName: 'league_search_submitted'")
    expect(leaguesSource).toContain("eventName: 'league_office_clicked'")
  })
})
