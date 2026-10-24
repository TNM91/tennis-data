import {describe, expect, it, vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {insertTeamMessage, parseTeamMessageSendId, type SentTeamMessage} from '../team-room-message-send'

const id = '1959be10-4557-4a03-87bd-584ba14ff519'
const input = {conversationId: 'team-one', senderUserId: 'player-one', body: 'Ready for doubles', announcement: false, replyToMessageId: null, clientMessageId: id}
const row: SentTeamMessage = {id, sender_user_id: input.senderUserId, body: input.body, message_kind: 'message', metadata: null, created_at: '2026-10-23T10:00:00Z', edited_at: null, deleted_at: null, reply_to_message_id: null}
function database(insertResult: unknown, existingResult: unknown = {data: row, error: null}) {
  const query = {insert: vi.fn(), select: vi.fn(), eq: vi.fn(), single: vi.fn().mockResolvedValue(insertResult), maybeSingle: vi.fn().mockResolvedValue(existingResult)}
  query.insert.mockReturnValue(query); query.select.mockReturnValue(query); query.eq.mockReturnValue(query)
  return {query, service: {from: vi.fn().mockReturnValue(query)} as unknown as SupabaseClient}
}
describe('team message retry safety', () => {
  it('accepts only optional UUID v4 send IDs and canonicalizes case', () => {
    expect(parseTeamMessageSendId(undefined)).toBeNull()
    expect(parseTeamMessageSendId(id.toUpperCase())).toBe(id)
    for (const value of [null, '', 1, {}, 'not-a-key', id.replace('-4a03-', '-1a03-')]) expect(parseTeamMessageSendId(value)).toBe(false)
  })
  it('inserts a first send with its stable primary key', async () => {
    const {query, service} = database({data: row, error: null})
    expect(await insertTeamMessage(service, input)).toEqual({ok: true, message: row, replayed: false})
    expect(query.insert).toHaveBeenCalledWith({id, conversation_id: 'team-one', sender_user_id: 'player-one', body: input.body, message_kind: 'message', reply_to_message_id: null})
    expect(query.maybeSingle).not.toHaveBeenCalled()
  })
  it('replays a racing duplicate only after exact room, sender and payload checks', async () => {
    const {query, service} = database({data: null, error: {code: '23505'}})
    expect(await insertTeamMessage(service, input)).toEqual({ok: true, message: row, replayed: true})
    expect(query.eq.mock.calls).toEqual([['id', id], ['conversation_id', 'team-one'], ['sender_user_id', 'player-one']])
  })
  it('uses the unique message key to resolve simultaneous retries to one inserted post', async () => {
    let saved: SentTeamMessage | null = null
    const service = {from: () => {
      const query = {
        insert: () => query,
        select: () => query,
        eq: () => query,
        single: async () => {
          if (saved) return {data: null, error: {code: '23505'}}
          saved = row
          return {data: row, error: null}
        },
        maybeSingle: async () => ({data: saved, error: null}),
      }
      return query
    }} as unknown as SupabaseClient
    const results = await Promise.all([insertTeamMessage(service, input), insertTeamMessage(service, input)])
    expect(results.map(result => result.ok && result.replayed).sort()).toEqual([false, true])
    expect(results.every(result => result.ok && result.message.id === id)).toBe(true)
  })
  it('does not return a conflicting, edited, deleted or unavailable send', async () => {
    for (const existing of [null, {...row, body: 'Different'}, {...row, message_kind: 'announcement'}, {...row, reply_to_message_id: 'other'}, {...row, edited_at: 'now'}, {...row, deleted_at: 'now'}]) {
      const {service} = database({error: {code: '23505'}}, {data: existing, error: null})
      expect(await insertTeamMessage(service, input)).toMatchObject({ok: false, status: 409})
    }
  })
  it('returns a retryable generic failure without leaking database details', async () => {
    const {service} = database({error: {code: 'XX000', message: 'private database detail'}})
    const result = await insertTeamMessage(service, input)
    expect(result).toMatchObject({ok: false, status: 500})
    expect(JSON.stringify(result)).not.toContain('private database detail')
    const failedLookup = database({error: {code: '23505'}}, {data: null, error: {message: 'private'}})
    expect(await insertTeamMessage(failedLookup.service, input)).toMatchObject({ok: false, status: 500})
  })
  it('preserves legacy sends without supplying a primary key or replaying a conflict', async () => {
    const {query, service} = database({data: row, error: null})
    await insertTeamMessage(service, {...input, clientMessageId: null})
    expect(query.insert.mock.calls[0][0]).not.toHaveProperty('id')
    const legacyConflict = database({error: {code: '23505'}})
    expect(await insertTeamMessage(legacyConflict.service, {...input, clientMessageId: null})).toMatchObject({ok: false, status: 500})
    expect(legacyConflict.query.maybeSingle).not.toHaveBeenCalled()
  })
})

it('replays only the same plain announcement and never converts a retry into a normal post',async()=>{const announcement={...row,message_kind:'announcement'},db=database({error:{code:'23505'}},{data:announcement});expect(await insertTeamMessage(db.service,{...input,announcement:true})).toMatchObject({ok:true,replayed:true});expect(await insertTeamMessage(database({error:{code:'23505'}},{data:row}).service,{...input,announcement:true})).toMatchObject({ok:false,status:409})})
