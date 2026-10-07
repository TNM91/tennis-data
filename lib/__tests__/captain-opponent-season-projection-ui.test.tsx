import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CaptainOpponentSeasonProjection from '../../app/components/captain-opponent-season-projection'
import CaptainOpponentSeasonScout from '../../app/components/captain-opponent-season-scout'
import { projectOpponentSeasonLineup } from '../captain-opponent-season-projection'
import { buildOpponentSeasonScout } from '../captain-opponent-season-scout'

const slots = [{ id: 'd1', label: 'Doubles 1', slotType: 'doubles' as const, players: [{ playerId: '', playerName: '' }, { playerId: '', playerName: '' }] }]
const players = [{ id: 'a', name: 'Alex' }, { id: 'b', name: 'Blair' }]
const scout = buildOpponentSeasonScout({ opponent: 'Rivals', league: '2026 Fall', flight: '4.0', beforeDate: '2026-10-11', slots, players,
  matches: [{ id: 'm', league_name: '2026 Fall', flight: '4.0', match_date: '2026-10-01', home_team: 'Rivals', away_team: 'Other', line_number: '1', match_type: 'doubles', winner_side: 'A', score: '6-3 6-4' }],
  links: players.map((player, index) => ({ match_id: 'm', player_id: player.id, side: 'A' as const, seat: index + 1 })),
})
const projection = projectOpponentSeasonLineup(scout, slots, players, () => true)
describe('season projection disclosure', () => {
  it('starts collapsed and explains appearances, dates, scores and actual pairs', () => {
    const html = renderToStaticMarkup(createElement(CaptainOpponentSeasonProjection, { projection, onUseDraft: () => {} }))
    expect(html).not.toMatch(/<details[^>]*\bopen/)
    expect(html).toContain('Alex / Blair')
    expect(html).toContain('Played this court in 1 of 1 recent matches')
    expect(html).toContain('6-3 6-4')
    expect(html).toContain('Last played')
    expect(html).toContain('pairs who actually played together')
    expect(html).not.toContain('disabled=""')
  })
  it('disables applying an already filled draft', () => {
    const html = renderToStaticMarkup(createElement(CaptainOpponentSeasonProjection, { projection: { ...projection, filled: 0 }, onUseDraft: () => {} }))
    expect(html).toContain('disabled=""')
    expect(html).toContain('No eligible open spots to fill')
  })
  it('hides projection actions while match data is loading and collapses latest lineup', () => {
    const props = { scout, opponent: 'Rivals', projection, onUseSeasonDraft: () => {}, onUseLineup: () => {}, onReviewCourt: () => {} }
    expect(renderToStaticMarkup(createElement(CaptainOpponentSeasonScout, { ...props, loading: true }))).not.toContain('Use recent-season draft')
    const html = renderToStaticMarkup(createElement(CaptainOpponentSeasonScout, props))
    expect(html).toContain('Likely lineup from recent matches')
    expect(html).toMatch(/<details[^>]*aria-label="Latest opponent lineup"/)
    expect(html).not.toMatch(/<details[^>]*\bopen/)
  })
})
