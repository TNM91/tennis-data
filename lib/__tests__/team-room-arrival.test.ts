import { describe, expect, it } from 'vitest'
import {
  buildTeamRoomArrivalCourts,
  buildTeamRoomArrivalPriority,
  buildTeamRoomArrivalSmsHref,
  buildTeamRoomLateArrivalBuilderHref,
  buildTeamRoomLineupCourtHref,
  clearTeamRoomArrivalCheckInsForPlayer,
  findTeamRoomAssignedCourt,
  findTeamRoomArrivalContact,
  findTeamRoomArrivalOutreach,
  findTeamRoomLateArrival,
  keepTeamRoomArrivalCheckInsForLineup,
  keepTeamRoomArrivalOutreachForLineup,
  readTeamRoomArrivalCheckIns,
  readTeamRoomArrivalTextReturn,
  readTeamRoomArrivalOutreach,
  teamRoomArrivalStatusLabel,
  upsertTeamRoomArrivalCheckIn,
  upsertTeamRoomArrivalOutreach,
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

  it('keeps captain-recorded external replies visible in the shared arrival board', () => {
    const checkIns = readTeamRoomArrivalCheckIns([{
      profileId: 'captain:jordan lee',
      playerName: 'Jordan Lee',
      courtLabel: '3.5 Doubles',
      status: 'here',
      updatedAt: '2026-08-05T22:12:00.000Z',
      setByCaptain: true,
    }])

    expect(checkIns[0]?.setByCaptain).toBe(true)
    expect(buildTeamRoomArrivalCourts([lineup[0]], checkIns)[0]?.players[1]).toMatchObject({
      name: 'Jordan Lee',
      status: 'here',
      setByCaptain: true,
    })
  })

  it('clears every saved identity for a player when a captain resets them to waiting', () => {
    const checkIns = [
      {
        profileId: 'captain:jordan lee',
        playerName: 'Jordan Lee',
        courtLabel: '3.5 Doubles',
        status: 'here' as const,
        updatedAt: '2026-08-05T22:12:00.000Z',
        setByCaptain: true,
      },
      {
        profileId: 'player-2',
        playerName: 'Lee, Jordan',
        courtLabel: '3.5 Doubles',
        status: 'on_my_way' as const,
        updatedAt: '2026-08-05T22:13:00.000Z',
      },
      {
        profileId: 'player-1',
        playerName: 'Alex Morgan',
        courtLabel: '3.5 Doubles',
        status: 'here' as const,
        updatedAt: '2026-08-05T22:10:00.000Z',
      },
    ]

    expect(clearTeamRoomArrivalCheckInsForPlayer(checkIns, 'Jordan Lee')).toEqual([checkIns[2]])
  })

  it('matches an imported roster contact and builds platform-safe arrival texts', () => {
    expect(findTeamRoomArrivalContact('Jordan Lee', [
      { name: 'Lee, Jordan', phone: '(312) 555-0100', joined: false },
    ])).toMatchObject({ phone: '(312) 555-0100', joined: false })

    expect(buildTeamRoomArrivalSmsHref('+1 (312) 555-0100', 'Reply Here', true))
      .toBe('sms:+13125550100&body=Reply%20Here')
    expect(buildTeamRoomArrivalSmsHref('(312) 555-0100', 'Reply Here'))
      .toBe('sms:3125550100?body=Reply%20Here')
    expect(buildTeamRoomArrivalSmsHref('missing', 'Reply Here')).toBe('')
  })

  it('restores only fresh, complete SMS return context', () => {
    const now = new Date('2026-08-06T03:00:00.000Z').getTime()
    const context = {
      roomId: 'room-1',
      messageId: 'match-1',
      playerName: 'Jordan Lee',
      courtLabel: '3.5 Doubles',
      createdAt: '2026-08-06T02:30:00.000Z',
    }
    expect(readTeamRoomArrivalTextReturn(JSON.stringify(context), now)).toEqual(context)
    expect(readTeamRoomArrivalTextReturn(JSON.stringify({ ...context, createdAt: '2026-08-05T23:30:00.000Z' }), now)).toBeNull()
    expect(readTeamRoomArrivalTextReturn('{bad json', now)).toBeNull()
    expect(readTeamRoomArrivalTextReturn({ ...context, playerName: '' }, now)).toBeNull()
  })

  it('records only the latest outreach per player without storing their phone number', () => {
    const first = upsertTeamRoomArrivalOutreach([], {
      playerName: 'Lee, Jordan',
      courtLabel: '3.5 Doubles',
      contactedAt: '2026-08-06T02:30:00.000Z',
      contactedByUserId: 'captain-1',
    })
    const latest = upsertTeamRoomArrivalOutreach(first, {
      playerName: 'Jordan Lee',
      courtLabel: '3.5 Doubles',
      contactedAt: '2026-08-06T02:35:00.000Z',
      contactedByUserId: 'captain-2',
    })

    expect(latest).toHaveLength(1)
    expect(findTeamRoomArrivalOutreach('Lee, Jordan', latest)?.contactedAt)
      .toBe('2026-08-06T02:35:00.000Z')
    expect(readTeamRoomArrivalOutreach([{ ...latest[0], phone: '(312) 555-0100' }]))
      .toEqual(latest)
    expect(readTeamRoomArrivalOutreach(latest)[0]).not.toHaveProperty('phone')
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

  it('keeps unaffected arrivals when a backup replaces the late player', () => {
    const checkIns = [
      {
        profileId: 'player-1',
        playerName: 'Alex Morgan',
        courtLabel: '3.5 Doubles',
        status: 'here' as const,
        updatedAt: '2026-08-05T22:10:00.000Z',
      },
      {
        profileId: 'player-3',
        playerName: 'Taylor Smith',
        courtLabel: '4.0 Doubles',
        status: 'running_late' as const,
        updatedAt: '2026-08-05T22:11:00.000Z',
      },
    ]
    const changedLineup = [
      lineup[0],
      { label: '4.0 Doubles', players: ['Riley Jones', 'Casey Reed'] },
    ]

    expect(keepTeamRoomArrivalCheckInsForLineup(changedLineup, checkIns)).toEqual([checkIns[0]])
    const outreach = [
      { playerName: 'Alex Morgan', courtLabel: '3.5 Doubles', contactedAt: '2026-08-05T22:01:00.000Z', contactedByUserId: 'captain-1' },
      { playerName: 'Taylor Smith', courtLabel: '4.0 Doubles', contactedAt: '2026-08-05T22:02:00.000Z', contactedByUserId: 'captain-1' },
    ]
    expect(keepTeamRoomArrivalOutreachForLineup(changedLineup, outreach)).toEqual([outreach[0]])
  })

  it('prioritizes late, waiting, traveling, and ready states in that order', () => {
    const lateCourts = buildTeamRoomArrivalCourts(lineup, [{
      profileId: 'player-3',
      playerName: 'Taylor Smith',
      courtLabel: '4.0 Doubles',
      status: 'running_late',
      updatedAt: '2026-08-05T22:10:00.000Z',
    }])
    expect(buildTeamRoomArrivalPriority(lateCourts).kind).toBe('late')

    const waitingCourts = buildTeamRoomArrivalCourts(lineup, [{
      profileId: 'player-1',
      playerName: 'Alex Morgan',
      courtLabel: '3.5 Doubles',
      status: 'here',
      updatedAt: '2026-08-05T22:10:00.000Z',
    }])
    expect(buildTeamRoomArrivalPriority(waitingCourts)).toMatchObject({
      kind: 'waiting',
      title: '3 need to check in',
    })

    const now = new Date('2026-08-06T03:00:00.000Z').getTime()
    expect(buildTeamRoomArrivalPriority(waitingCourts, '', [{
      playerName: 'Jordan Lee',
      courtLabel: '3.5 Doubles',
      contactedAt: '2026-08-06T02:45:01.000Z',
      contactedByUserId: 'captain-1',
    }], now).kind).toBe('waiting')
    expect(buildTeamRoomArrivalPriority(waitingCourts, '', [{
      playerName: 'Lee, Jordan',
      courtLabel: '3.5 Doubles',
      contactedAt: '2026-08-06T02:40:00.000Z',
      contactedByUserId: 'captain-1',
    }], now)).toMatchObject({
      kind: 'follow_up',
      title: '1 still waiting',
      detail: 'Jordan Lee · text opened 20m ago',
      playerName: 'Jordan Lee',
      courtLabel: '3.5 Doubles',
    })

    const onWayCourts = buildTeamRoomArrivalCourts([lineup[0]], [
      {
        profileId: 'player-1',
        playerName: 'Alex Morgan',
        courtLabel: '3.5 Doubles',
        status: 'here',
        updatedAt: '2026-08-05T22:10:00.000Z',
      },
      {
        profileId: 'player-2',
        playerName: 'Jordan Lee',
        courtLabel: '3.5 Doubles',
        status: 'on_my_way',
        updatedAt: '2026-08-05T22:10:00.000Z',
      },
    ])
    expect(buildTeamRoomArrivalPriority(onWayCourts).kind).toBe('on_way')

    const readyCourts = buildTeamRoomArrivalCourts([lineup[0]], onWayCourts[0].players.map((player, index) => ({
      profileId: `ready-${index}`,
      playerName: player.name,
      courtLabel: '3.5 Doubles',
      status: 'here' as const,
      updatedAt: '2026-08-05T22:12:00.000Z',
    })))
    expect(buildTeamRoomArrivalPriority(readyCourts).title).toBe('Team is here')
  })
})
