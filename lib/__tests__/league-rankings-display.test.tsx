import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import LeagueAnalytics from '@/app/components/league-analytics'
import WeeklyLeagueResultsPanel from '@/app/explore/leagues/tiq/[league]/weekly-league-results-panel'
import { buildLeagueWeeklyCompetitionView } from '../league-weekly-player-records'

const view = buildLeagueWeeklyCompetitionView({
  leagueId: 'league',
  sessions: [{ id: 'week', league_id: 'league', status: 'completed', play_on: '2026-10-01' }],
  results: [{ session_id: 'week', court_number: 1, set_number: 1, side_a_players: ['Zoe', 'Will'], side_b_players: ['Alex', 'Ben'], side_a_games: 7, side_b_games: 6, review_status: 'approved' }],
})

describe('league rankings display', () => {
  it('retains the existing leaders experience when rankings are enabled', () => {
    const html = renderToStaticMarkup(<LeagueAnalytics view={view} />)
    expect(html).toContain('This week’s leaders')
    expect(html).toContain('#1')
  })

  it('renders stats without leaders or rank numbers when disabled', () => {
    const html = renderToStaticMarkup(<WeeklyLeagueResultsPanel view={view} loading={false} error="" showRankings={false} />)
    expect(html).toContain('Player stats and scorecards')
    expect(html).toContain('Explore player stats')
    expect(html).toContain('7–6 finishes')
    expect(html).toContain('Week-by-week scorecards')
    expect(html).toContain('Zoe + Will')
    expect(html).not.toContain('Player standings')
    expect(html).not.toContain('This week’s leaders')
    expect(html).not.toContain('#1')
    expect(html).not.toContain('Rank movement')
  })
})
