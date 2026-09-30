import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const routeSource = readFileSync(join(process.cwd(), 'app/api/leagues/[leagueId]/weekly-results/route.ts'), 'utf8')
const pageSource = readFileSync(join(process.cwd(), 'app/explore/leagues/tiq/[league]/page.tsx'), 'utf8')
const panelSource = readFileSync(join(process.cwd(), 'app/explore/leagues/tiq/[league]/weekly-league-results-panel.tsx'), 'utf8')

describe('weekly league detail', () => {
  it('publishes accepted score data without weekly operations or player submissions', () => {
    expect(routeSource).toContain(".in('status', ['published', 'completed'])")
    expect(routeSource).toContain(".in('review_status', ['confirmed', 'approved'])")
    expect(routeSource).toContain(".select('session_id,court_number,set_number,side_a_players,side_b_players,side_a_games,side_b_games,review_status')")
    expect(routeSource).not.toContain("select('public_token")
    expect(routeSource).not.toContain('positive_share')
    expect(routeSource).not.toContain('review_note')
  })

  it('protects private leagues and gives weekly doubles its own results surface', () => {
    expect(routeSource).toContain('canReadPrivateLeague')
    expect(routeSource).toContain("from('tiq_league_delegates')")
    expect(routeSource).toContain("from('tiq_player_league_entries')")
    expect(pageSource).toContain('<WeeklyLeagueResultsPanel')
    expect(pageSource).toContain("league.leagueFormat === 'individual' && !league.weeklySettings.enabled")
    expect(panelSource).toContain('Standings and scorecards')
    expect(panelSource).toContain('Accepted sets only')
    expect(panelSource).toContain('Week-by-week scorecards')
  })
})
