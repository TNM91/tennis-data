import { createClient } from '@supabase/supabase-js'
import { expect, it } from 'vitest'
import { readFirstPartyChat, writeFirstPartyChat } from '../first-party-team-chat'

const owner = '11111111-1111-4111-8111-111111111111'
const teammate = '22222222-2222-4222-8222-222222222222'
const blocked = '33333333-3333-4333-8333-333333333333'
const anonymous = '44444444-4444-4444-8444-444444444444'
const roomId = '55555555-5555-4555-8555-555555555555'
const room = { roomId, teamName: 'Baseline Aces', leagueName: 'City League', flight: '4.5' }
const post = (sender: string, digit: string) => ({
  id: `66666666-6666-4666-8666-66666666666${digit}`, sender_user_id: sender,
  body: 'See you on court.', message_kind: 'message', metadata: {},
  created_at: `2026-11-06T17:00:0${digit}Z`, edited_at: null, deleted_at: null, reply_to_message_id: null,
})
const posts = [post(blocked, '4'), post(anonymous, '3'), post(teammate, '2'), post(teammate, '1'), post(owner, '0')]

function database({ removed = false, hasNames = true } = {}) {
  const calls: URL[] = [], writes: object[] = []
  const names = new Map([[owner, 'Jordan'], [teammate, 'Sam'], [anonymous, 'legacy@example.test'], [blocked, 'Hidden']])
  const service = createClient('https://team-chat.example.test', 'synthetic-key', {
    auth: { persistSession: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input))
      calls.push(url)
      switch (url.pathname.split('/').at(-1)) {
        case 'internal_conversation_participants': return Response.json([{ last_read_at: '' }])
        case 'team_room_member_removals': return Response.json(removed ? [{ profile_id: owner }] : [])
        case 'team_chat_blocks': return Response.json([{ blocked_user_id: blocked }])
        case 'native_chat_reaction_summary': return Response.json([])
        case 'internal_messages': {
          const id = url.searchParams.get('id')
          return Response.json(id ? posts.filter(post => id === `eq.${post.id}`) : posts)
        }
        case 'team_room_member_preferences': {
          if (!hasNames) return Response.json({ code: '42703' }, { status: 400 })
          if (init?.method === 'POST') {
            const payload = JSON.parse(String(init.body))
            writes.push(payload)
            return Response.json({ chat_display_name: payload.chat_display_name })
          }
          const ids = url.searchParams.get('profile_id')
          return Response.json([...names].filter(([id]) => ids?.includes(id))
            .map(([profile_id, chat_display_name]) => ({ profile_id, chat_display_name })))
        }
        default: throw Error('Unexpected database read')
      }
    } },
  })
  return { service, calls, writes }
}

it('loads names once from the exact room and keeps aliases for blocked or invalid names', async () => {
  const db = database()
  const result = await readFirstPartyChat(db.service, owner, room, new URLSearchParams())
  expect(result).toMatchObject({ ok: true, room: {
    chatDisplayName: 'Jordan',
    messages: [
      { senderName: 'You' }, { senderName: 'Sam' }, { senderName: 'Sam' },
      { senderName: 'Teammate 4444' }, { senderName: 'Teammate 3333', body: '' },
    ],
  } })
  const reads = db.calls.filter(url => url.pathname.endsWith('/team_room_member_preferences'))
  expect(reads).toHaveLength(1)
  expect(reads[0].searchParams.get('select')).toBe('profile_id,chat_display_name')
  expect(reads[0].searchParams.get('conversation_id')).toBe(`eq.${roomId}`)
  expect(reads[0].searchParams.get('profile_id')).toBe(`in.(${owner},${teammate},${anonymous})`)
})

it('uses the same name in updates and original-message views, with aliases on older schemas', async () => {
  const { service } = database()
  const updates = await readFirstPartyChat(service, owner, room, new URLSearchParams({ op: 'updates' }))
  expect(updates).toMatchObject({ room: { messages: expect.arrayContaining([expect.objectContaining({ senderName: 'Sam' })]) } })
  const params = new URLSearchParams({ op: 'message', view: 'message', message: posts[2].id })
  expect(await readFirstPartyChat(service, owner, room, params)).toMatchObject({ message: { senderName: 'Sam' } })
  expect(await readFirstPartyChat(database({ hasNames: false }).service, owner, room, params))
    .toMatchObject({ message: { senderName: 'Teammate 2222' } })
})

it('saves and clears only the signed-in member’s name in the selected room', async () => {
  const db = database(), { roomId, teamName, leagueName, flight } = room
  const request = { action: 'set_chat_display_name', roomId, teamName, leagueName, flight, displayName: '  Élodie  ' }
  expect(await writeFirstPartyChat(db.service, owner, roomId, request)).toMatchObject({ ok: true, roomId, chatDisplayName: 'Élodie' })
  expect(await writeFirstPartyChat(db.service, owner, roomId, { ...request, displayName: '' }))
    .toMatchObject({ ok: true, roomId, chatDisplayName: '' })
  expect(await writeFirstPartyChat(db.service, owner, roomId, { ...request, displayName: 'name@example.test' })).toMatchObject({ status: 400 })
  expect(await writeFirstPartyChat(db.service, owner, roomId, { ...request, profileId: teammate })).toMatchObject({ status: 400 })
  expect(await writeFirstPartyChat(db.service, owner, roomId, { ...request, roomId: teammate })).toMatchObject({ status: 403 })
  expect(db.writes).toEqual([
    { conversation_id: roomId, profile_id: owner, chat_display_name: 'Élodie' },
    { conversation_id: roomId, profile_id: owner, chat_display_name: null },
  ])
  const removed = database({ removed: true })
  expect(await writeFirstPartyChat(removed.service, owner, roomId, request)).toMatchObject({ status: 403 })
  expect(removed.writes).toEqual([])
  expect(await readFirstPartyChat(removed.service, owner, room, new URLSearchParams())).toMatchObject({ status: 403 })
  expect(removed.calls.some(url => url.pathname.endsWith('/team_room_member_preferences'))).toBe(false)
})
