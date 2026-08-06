import { describe, expect, it } from 'vitest'
import {
  buildTeamRoomArrivalCourts,
  buildTeamRoomLateArrivalBuilderHref,
  buildTeamRoomLineupCourtHref,
  findTeamRoomAssignedCourt,
  findTeamRoomLateArrival,
  readTeamRoomArrivalCheckIns,
  teamRoomArrivalStatusLabel,
  upsertTeamRoomArrivalCheckIn,
} from '../team-room-arrival'

const lineup = [
  { label: '3.5 Doubles', players: ['Alex Morgan', 'Jordan Lee'] },
  { label: '4.0 Doubles', players: ['Taylor Smith', 'Casey Reed'] },
]

describe('Team Room arrival check-ins', () => {
  it('finds the assigned court from either linked or display name', () => {
    expect(findTeamRoomAssignedCourt(lineup, ['Morgan, Alex'])).toEqual({
      courtLabel: '3.5 Doubles',
      playerName: 'Alex Morgan',
    })
  })

  it('keeps one current status per connected player', () => {
    const first = upsertTeamRoomArrivalCheckIn([], {
      profileId: 'player-1',
      playerName: 'Alex Morgan',
      courtLabel: '3.5 Doubles',
      status: 'on_my_way',
      updatedAt: '2026-08-05T22:00:00.000Z',
    })
    const updated = upsertTeamRoomArrivalCheckIn(first, {
      profileId: 'player-1',
      playerName: 'Alex Morgan',
      courtLabel: '3.5 Doubles',
      status: 'here',
      updatedAt: '2026-08-05T22:10:00.000Z',
    })

    expect(updated).toHaveLength(1)
    expect(updated[0]?.status).toBe('here')
    expect(readTeamRoomArrivalCheckIns(updated)).toEqual(updated)
  })

  it('puts late courts first and gives every player a plain status', () => {
    const courts = buildTeamRoomArrivalCourts(lineup, [{
      profileId: 'player-3',
      playerName: 'Taylor Smith',
      courtLabel: '4.0 Doubles',
      status: 'running_late',
      updatedAt: '2026-08-05T22:10:00.000Z',
    }])

    expect(courts[0]?.label).toBe('4.0 Doubles')
    expect(courts[0]?.players[0]?.status).toBe('running_late')
    expect(teamRoomArrivalStatusLabel(courts[0]?.players[1]?.status || null)).toBe('Waiting')
    expect(findTeamRoomLateArrival(courts, '4.0 Doubles')).toEqual({
      courtLabel: '4.0 Doubles',
      playerName: 'Taylor Smith',
    })
    expect(buildTeamRoomLateArrivalBuilderHref('/captain/lineup-builder?team=Aces', {
      courtLabel: '4.0 Doubles',
      playerName: 'Taylor Smith',
    })).toBe('/captain/lineup-builder?team=Aces&source=team_room&availability=replies&mode=backup&replace=Taylor+Smith&court=4.0+Doubles#captain-lineup-courts')
    expect(buildTeamRoomLineupCourtHref('/captain/lineup-builder?team=Aces', '4.0 Doubles'))
      .toBe('/captain/lineup-builder?team=Aces&source=team_room&court=4.0+Doubles#captain-lineup-courts')
  })
})
