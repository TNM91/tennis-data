import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadCalendarTeamMatches } from '../first-party-team-schedule'
import { buildTeamRoomScopeId } from '../team-room'

const owner = '11111111-1111-4111-8111-111111111111'
const range = { from: '2026-11-09', to: '2026-11-15' }
const now = new Date('2026-11-12T17:00:00Z')
const fixture = { opponent: 'Topspin Club', date: '2026-11-14', time: '18:00', facility: 'Court 2', timeZone: 'America/Chicago' }
const room = (digit: number) => ({
  roomId: `33333333-3333-4333-8333-33333333333${digit}`,
  teamName: 'Team ' + digit, leagueName: 'City League', flight: '4.0',
})

describe('first-party private team calendar dates', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('loads one upcoming match per accepted, open and active manual team room', async () => {
    const rooms = Array.from({ length: 8 }, (_, index) => room(index + 1))
    vi.stubEnv('TIQ_FIRST_PARTY_TEAM_ROOMS', JSON.stringify(rooms.map((entry, i) => i === 4 ? { ...entry, scheduleLeagueId: 'reviewed-season' } : entry)))
    const tables: Record<string, Record<string, unknown>[]> = {
      team_profile_links: rooms.map((entry, i) => ({ profile_user_id: i === 5 ? 'other-user' : owner, status: 'accepted', archived_at: null,
        source_type: 'manual_invite', team_role: 'player', team_name: entry.teamName, league_name: entry.leagueName, flight: entry.flight })),
      internal_conversations: rooms.map((entry, i) => ({ id: entry.roomId, related_entity_id: buildTeamRoomScopeId(entry),
        related_entity_type: 'team_room', status: i === 1 ? 'closed' : 'open' })),
      internal_conversation_participants: rooms.filter((_, i) => i !== 2).map(entry => ({ conversation_id: entry.roomId, profile_id: owner })),
      team_room_member_removals: [{ conversation_id: rooms[3].roomId, profile_id: owner }],
      native_team_next_fixtures: rooms.map((entry, i) => ({ room_id: entry.roomId, revision: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        fixture: { ...fixture, date: i === 6 ? '2026-11-16' : i === 7 ? '2026-11-11' : fixture.date } })),
    }
    const reads: string[][] = []
    const db = { from(table: string) {
      let rows = tables[table]
      const query = {
        select: () => query,
        eq: (field: string, value: unknown) => { rows = rows.filter(row => row[field] === value); return query },
        is: (field: string, value: unknown) => query.eq(field, value),
        in: (field: string, values: string[]) => {
          if (table === 'native_team_next_fixtures') reads.push(values)
          rows = rows.filter(row => values.includes(String(row[field])))
          return query
        },
        limit: (count: number) => Promise.resolve({ data: rows.slice(0, count), error: null }),
      }
      return query
    } } as unknown as SupabaseClient

    expect(await loadCalendarTeamMatches(db, owner, range, now)).toEqual([{
      roomId: rooms[0].roomId, revision: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', match: fixture,
      scope: { teamName: rooms[0].teamName, leagueName: rooms[0].leagueName, flight: rooms[0].flight },
    }])
    expect(reads).toEqual([[rooms[0].roomId, rooms[6].roomId, rooms[7].roomId]])
  })
})
