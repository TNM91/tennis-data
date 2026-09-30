import { describe, expect, it } from 'vitest'
import { buildLeagueWeeklyHomeView, type LeagueWeeklyHomeSnapshot } from '../league-weekly-home'

const publishedWeek: LeagueWeeklyHomeSnapshot = {
  leagueId: 'league-1',
  playOn: '2026-10-01',
  status: 'published',
  inCount: 18,
  outCount: 4,
  rosterCount: 16,
  courtCount: 4,
  acceptedSetCount: 8,
  expectedSetCount: 12,
  storyCount: 2,
  recapSent: false,
}

describe('weekly league home view', () => {
  it('opens the next reply window when no session exists', () => {
    const view = buildLeagueWeeklyHomeView('league/one', null)

    expect(view.href).toBe('/league-coordinator/weekly?leagueId=league%2Fone')
    expect(view.title).toBe('Open this week’s replies')
    expect(view.progress.find((item) => item.current)?.label).toBe('Replies')
  })

  it('makes missing scores the next decision after courts publish', () => {
    const view = buildLeagueWeeklyHomeView('league-1', publishedWeek)

    expect(view.href).toContain('playOn=2026-10-01')
    expect(view.title).toBe('Collect 4 missing sets')
    expect(view.pulseValue).toBe('16 playing')
    expect(view.progress.find((item) => item.current)?.label).toBe('Scores')
  })

  it('moves a confirmed roster to court publication', () => {
    const view = buildLeagueWeeklyHomeView('league-1', {
      ...publishedWeek,
      status: 'roster_confirmed',
      courtCount: 0,
      expectedSetCount: 0,
    })

    expect(view.title).toBe('Publish this week’s courts')
    expect(view.progress.find((item) => item.current)?.label).toBe('Courts')
  })

  it('moves a scored week into recap preparation', () => {
    const view = buildLeagueWeeklyHomeView('league-1', {
      ...publishedWeek,
      acceptedSetCount: 12,
    })

    expect(view.title).toBe('Prepare the weekly recap')
    expect(view.detail).toContain('2 player moments')
    expect(view.progress.find((item) => item.current)?.label).toBe('Recap')
  })

  it('marks the complete week after recap delivery', () => {
    const view = buildLeagueWeeklyHomeView('league-1', {
      ...publishedWeek,
      acceptedSetCount: 12,
      recapSent: true,
      status: 'completed',
    })

    expect(view.title).toBe('This league week is complete')
    expect(view.progress.every((item) => item.complete)).toBe(true)
    expect(view.pulseValue).toBe('Recap sent')
  })
})
