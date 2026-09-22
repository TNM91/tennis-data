import { describe, expect, it } from 'vitest'
import { mapApprovedCompetitionSchedule } from '../player-competition-schedule'

describe('approved player competition schedule', () => {
  it('maps scheduled tournament draws and confirmed individual league matches across formats', () => {
    const events = mapApprovedCompetitionSchedule({
      tournamentEntries: [{ tournament_id: 'tournament-1', player_name: 'Taylor Player' }],
      tournaments: [{
        id: 'tournament-1',
        name: 'Club Round Robin',
        format: 'round_robin',
        starts_on: '2026-08-12',
        location_label: 'Vetta West',
        entrants: ['Taylor Player', 'Jordan Player', 'Morgan Player'],
        results: {},
        schedule: {
          'r2-m1': { date: '2026-08-12', time: '18:30', court: '3' },
        },
      }],
      leagueEntries: [{ league_id: 'league-1', player_name: 'Taylor Player', player_id: 'p-1' }],
      leagues: [{
        id: 'league-1',
        league_name: 'Fall Flex League',
        season_label: 'Fall 2026',
        starts_on: '2026-09-01',
        location_label: 'City Courts',
      }],
      leagueSchedule: [{
        id: 'match-1',
        league_id: 'league-1',
        participant_a_name: 'Taylor Player',
        participant_a_id: 'p-1',
        participant_b_name: 'Casey Player',
        participant_b_id: 'p-2',
        scheduled_date: '2026-09-03',
        scheduled_time: '19:00',
        facility: 'Court 5',
        status: 'confirmed',
      }],
      responses: [{
        event_id: 'league:league-1:match-1',
        response: 'available',
        event_snapshot: { date: '2026-09-03', time: '19:00', location: 'Court 5' },
        updated_at: '2026-09-01T12:00:00.000Z',
      }],
    })

    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      kind: 'tournament',
      eventType: 'match',
      opponent: 'Morgan Player',
      date: '2026-08-12',
      location: 'Vetta West · Court 3',
    })
    expect(events[1]).toMatchObject({
      kind: 'league',
      eventType: 'match',
      opponent: 'Casey Player',
      date: '2026-09-03',
      status: 'Confirmed',
      responseStatus: 'available',
      responseIsStale: false,
    })
  })

  it('keeps the approved competition start visible until a match time is assigned', () => {
    const events = mapApprovedCompetitionSchedule({
      tournamentEntries: [{ tournament_id: 'tournament-2', player_name: 'Taylor Player' }],
      tournaments: [{
        id: 'tournament-2',
        name: 'Compass Classic',
        format: 'compass_draw',
        starts_on: '2026-10-10',
        location_label: 'North Courts',
        entrants: ['Taylor Player', 'Jordan Player'],
        schedule: {},
      }],
      leagueEntries: [],
      leagues: [],
      leagueSchedule: [],
      responses: [{
        event_id: 'tournament:tournament-2:start',
        response: 'available',
        event_snapshot: { date: '2026-10-09', time: '', location: 'North Courts' },
        updated_at: '2026-10-01T12:00:00.000Z',
      }],
    })

    expect(events).toEqual([expect.objectContaining({
      eventType: 'competition',
      competitionName: 'Compass Classic',
      date: '2026-10-10',
      detail: 'Entry approved · Match time pending',
      responseStatus: '',
      responseIsStale: true,
    })])
  })
})
