import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CaptainOpponentSeasonScout from '@/app/components/captain-opponent-season-scout'
import { buildOpponentSeasonScout } from '../captain-opponent-season-scout'

const input = { opponent: 'Rivals', league: '2026 Fall', flight: '4.0', beforeDate: '2026-10-11', matches: [], links: [], players: [], slots: [] }
const render = (scout: ReturnType<typeof buildOpponentSeasonScout>) => renderToStaticMarkup(createElement(CaptainOpponentSeasonScout, { scout, opponent: 'Rivals', onUseLineup: () => {}, onReviewCourt: () => {} }))

describe('opponent scouting data gaps', () => {
  it('does not expose an old draft action while match data refreshes', () => {
    const html = renderToStaticMarkup(createElement(CaptainOpponentSeasonScout, { scout: buildOpponentSeasonScout(input), opponent: 'Rivals', loading: true, onUseLineup: () => {}, onReviewCourt: () => {} }))
    expect(html).toContain('Loading season results…')
    expect(html).not.toContain('No earlier court results')
    expect(html).not.toContain('Use this week')
  })
  it('asks for match scope before showing a season record', () => {
    expect(render(buildOpponentSeasonScout({ ...input, flight: '' }))).toContain('Choose your league, flight, opponent, and match date')
  })
  it('does not turn a missing history into a zero-win team', () => {
    const html = render(buildOpponentSeasonScout(input))
    expect(html).toContain('No earlier court results are recorded')
    expect(html).not.toContain('0–0')
  })
  it('keeps unknown results and incomplete scores explicit and disables unlinked draft actions', () => {
    const scout = buildOpponentSeasonScout({ ...input, matches: [{ id: 'm', league_name: '2026 Fall', flight: '4.0', match_date: '2026-10-01', home_team: 'Rivals', away_team: 'Other', line_number: '1', winner_side: null, score: '6-3 2-1 RET' }] })
    const html = render(scout)
    expect(html).toContain('1 results unknown')
    expect(html).toContain('Recorded score: 6-3 2-1 RET')
    expect(html).toContain('Players not recorded')
    expect(html).toContain('disabled=""')
    expect(html).not.toContain(' open=""')
  })
})
