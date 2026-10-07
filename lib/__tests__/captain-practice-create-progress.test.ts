import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  conversation: vi.fn(async () => 'thread-1'),
  byPlayer: vi.fn(async (id: string) => ({ id: `profile-${id}` })),
  byName: vi.fn(async (name: string) => ({ id: name === 'Alex' ? 'profile-a' : 'profile-b' })),
  writes: [] as Array<{ table: string; row: unknown }>,
}))
vi.mock('../internal-messages', () => ({
  createLeagueConversation: mocks.conversation,
  findInternalRecipientByPlayerId: mocks.byPlayer,
  findInternalRecipient: mocks.byName,
  getInternalIdentity: vi.fn(async () => ({ userId: 'captain', role: 'captain' })),
  sendInternalMessage: vi.fn(),
}))
vi.mock('../supabase', () => ({ supabase: { from: (table: string) => {
  let inserted: unknown
  const query: Record<string, unknown> = {}
  const result = () => {
    if (table === 'team_roster_members') return { data: [{ player_id: 'a', player_name: 'Alex', league_name: 'Fall', flight: '4.5' }, { player_id: 'b', player_name: 'Blair', league_name: 'Fall', flight: '4.5' }], error: null }
    if (table === 'internal_message_directory') return { data: [{ id: 'profile-a', linked_player_id: 'a' }, { id: 'profile-b', linked_player_id: 'b' }], error: null }
    if (table === 'captain_practice_invites') return { data: { id: 'invite-1', public_token: 'fixture-token', capacity: 8 }, error: null }
    if (table === 'internal_schedule_events') return { data: { ...(inserted as Record<string, unknown>), id: 'event-1' }, error: null }
    return { data: [], error: null }
  }
  for (const method of ['select', 'eq', 'in', 'limit']) query[method] = vi.fn(() => query)
  for (const method of ['insert', 'upsert', 'update']) query[method] = vi.fn((row: unknown) => { inserted = row; mocks.writes.push({ table, row }); return query })
  query.single = vi.fn(async () => result())
  query.then = (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve)
  return query
} } }))

import { createCaptainPracticeThread } from '../internal-scheduling'

beforeEach(() => { mocks.writes.length = 0; vi.clearAllMocks() })
it('reports save phases and passes already resolved recipients without repeating roster lookups', async () => {
  const progress = vi.fn()
  const result = await createCaptainPracticeThread({ teamName: 'Riverside', leagueName: 'Fall', flight: '4.5', scheduledDate: '2026-10-10', capacity: 8 }, progress)
  expect(progress.mock.calls.map(([phase]) => phase)).toEqual(['roster', 'participants', 'practice', 'rsvp'])
  expect(mocks.byPlayer).toHaveBeenCalledTimes(2)
  expect(mocks.byName).toHaveBeenCalledTimes(2)
  const request = mocks.conversation.mock.calls[0] as unknown as [unknown, Record<string, unknown>]
  expect(request[1].participantProfileIds).toEqual(['profile-a', 'profile-b'])
  expect(request[1].participantPlayerIds).toBeUndefined()
  expect(request[1].participantNames).toBeUndefined()
  expect(result).toMatchObject({ conversationId: 'thread-1', publicToken: 'fixture-token', linkedParticipantCount: 2, rosterCount: 2 })
  expect(mocks.writes.filter((write) => write.table === 'captain_practice_invitees')).toHaveLength(1)
})
