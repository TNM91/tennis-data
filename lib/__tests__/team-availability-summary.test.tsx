import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { selectedLineupPlayers, summarizeTeamAvailability, type AvailabilitySummaryAnswer } from '../team-availability-summary'
import { TeamAvailabilitySummaryView, type TeamAvailabilityPayload } from '@/app/compete/teams/team-availability-summary'

const roster = [{ key: 'p1', playerId: 'p1', name: 'Sam' }, { key: 'p2', playerId: 'p2', name: 'Sam' }, { key: 'p3', playerId: 'p3', name: 'Taylor' }]
const answer = (playerId: string, status: string, source: AvailabilitySummaryAnswer['source'] = 'player', at = '2026-09-08T01:00:00Z'): AvailabilitySummaryAnswer => ({ playerId, status, source, at })
describe('team availability summary', () => {
  it('counts captain confirmations as available, not unanswered or player replies', () => {
    const summary = summarizeTeamAvailability(roster, [answer('p1', 'available', 'captain')], ['p1', 'p2'])
    expect(summary).toMatchObject({ available: 1, waiting: 2, captainConfirmed: 1, selectedWaiting: ['Sam'] })
    expect(summary.people[0]).toMatchObject({ source: 'captain', selected: true })
  })
  it('does not cross-link same-name players or count foreign players', () => {
    expect(summarizeTeamAvailability(roster, [answer('p2', 'available'), answer('foreign', 'available')], null)).toMatchObject({ available: 1, waiting: 2, selectedWaiting: null })
  })
  it('lets a newer No supersede a captain Yes and older season answer', () => {
    const summary = summarizeTeamAvailability(roster, [answer('p1', 'available', 'captain'), answer('p1', 'unavailable', 'player', '2026-09-08T02:00:00Z'), answer('p1', 'season-available', 'season', '2026-09-07T00:00:00Z')], ['p1'])
    expect(summary).toMatchObject({ available: 0, unavailable: 1, captainConfirmed: 0, selectedWaiting: [] })
  })
  it('keeps Maybe separate from waiting and available', () => {
    expect(summarizeTeamAvailability(roster, [answer('p1', 'limited'), answer('p2', 'maybe'), answer('p3', 'unknown')], ['p3'])).toMatchObject({ available: 0, maybe: 2, waiting: 1, selectedWaiting: ['Taylor'] })
  })
  it('prefers a known player reply over a mirror on equal timestamps and deduplicates roster IDs', () => {
    expect(summarizeTeamAvailability([...roster, roster[0]], [answer('p1', 'available'), answer('p1', 'available', 'saved')], []).people[0].source).toBe('player')
    expect(summarizeTeamAvailability([...roster, roster[0]], [], []).roster).toBe(3)
  })
  it('keeps unlinked roster members unanswered and flags missing selected IDs', () => {
    expect(summarizeTeamAvailability([{ key: 'roster-id', name: 'Sam', playerId: null }], [answer('p1', 'available')], ['p1'])).toMatchObject({ available: 0, waiting: 1, selectedUnmatched: 1 })
  })
  it('counts an unlinked player’s own season answer by their exact roster key, never by name', () => {
    expect(summarizeTeamAvailability([{ key: 'roster-id', name: 'Sam', playerId: null }], [answer('roster:roster-id', 'available', 'season')], null)).toMatchObject({ available: 1, waiting: 0 })
  })
  it('extracts unique selected IDs, tolerating blank and malformed slots', () => {
    expect(selectedLineupPlayers([{ players: [{ playerId: 'p1' }, null, { playerId: '' }, { playerId: 'p1' }] }, null])).toEqual(['p1'])
    expect(selectedLineupPlayers({})).toEqual([])
  })
  it('renders compact truthful statuses with disclosures, scoped individual texts, and refresh feedback', () => {
    const data: TeamAvailabilityPayload = { summary: summarizeTeamAvailability(roster, [answer('p1', 'available', 'captain'), answer('p2', 'maybe', 'season')], ['p1', 'p3']), selection: 'saved', scenarioId: 'scenario', scope: { team: 'Aces', league: 'Fall', flight: '4.0', seasonKey: 'season' }, match: { id: 'match', home_team: 'Aces', away_team: 'Volleys', match_date: '2026-09-14' }, checkedAt: 'now', dayScopedAnswersOmitted: false }
    const html = renderToStaticMarkup(<TeamAvailabilitySummaryView data={data} busy={false} notice="Checked just now — no changes." onRefresh={() => {}} lineupHref="/captain/lineup-builder?team=Aces" reminder={<button>Group request</button>} />)
    expect(html).toContain('Confirmed by captain')
    expect(html).toContain('Season reply')
    expect(html).toContain('Taylor')
    expect(html).toContain('match=match&amp;scenario=scenario#captain-lineup-courts')
    expect(html).toContain('Remind players')
    expect(html).toContain('no changes')
    expect(html).not.toContain('<details open')
    expect(html).not.toContain('Ready to send')
  })
  it('guards account/team scope and fails closed on stale or failed fetches', () => {
    const page = readFileSync('app/compete/teams/page.tsx', 'utf8')
    expect(page).toContain('key={`${userId}:${group.connection.id}:${upcomingMatch.date}:${upcomingMatch.opponent}`}')
    const client = readFileSync('app/compete/teams/team-availability-summary.tsx', 'utf8')
    expect(client).toContain('setData(null)')
    expect(client).toContain('controller?.abort()')
    expect(client).toContain("cache: 'no-store'")
    expect(client).toContain('document.visibilityState')
  })
})
