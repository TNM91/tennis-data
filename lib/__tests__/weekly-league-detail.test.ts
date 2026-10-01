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
    expect(routeSource).toContain(".select('id,league_id,status,play_on,roster,assignments,recap')")
    expect(routeSource).toContain('week: currentWeek')
    expect(routeSource).toContain("if (!cleanText(recap.sentAt)) return null")
  })

  it('protects private leagues and gives weekly doubles its own results surface', () => {
    expect(routeSource).toContain('canReadPrivateLeague')
    expect(routeSource).toContain("from('tiq_league_delegates')")
    expect(routeSource).toContain("from('tiq_player_league_entries')")
    expect(pageSource).toContain('<WeeklyLeagueResultsPanel')
    expect(pageSource).toContain("league.leagueFormat === 'individual' && !league.weeklySettings.enabled")
    expect(panelSource).toContain('Standings and scorecards')
    expect(panelSource).toContain('Accepted sets only')
    expect(panelSource).toContain('Player spotlight')
    expect(panelSource).toContain('Partner combinations')
    expect(panelSource).toContain('Weekly court history')
    expect(panelSource).toContain("aria-pressed={selectedPlayer?.playerName === standing.playerName}")
    expect(panelSource).toContain('Week-by-week scorecards')
  })

  it('presents a role-aware, mobile-first weekly league home', () => {
    expect(pageSource).toContain('id="league-this-week"')
    expect(pageSource).toContain("supabase.rpc('can_manage_tiq_league'")
    expect(pageSource).toContain("weeklyPublicWeek?.status === 'completed'")
    expect(pageSource).toContain('Your court is ready')
    expect(pageSource).toContain('Open weekly replies')
    expect(pageSource).toContain('Subscribe calendar')
    expect(pageSource).toContain('<details style={leagueRulesDetailsStyle}>')
    expect(pageSource).toContain('Each court plays three sets so every player partners once.')
    expect(panelSource).toContain('mobileStandingCardStyle')
    expect(panelSource).toContain('useViewportBreakpoints')
  })
})
