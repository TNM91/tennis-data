import type { SupabaseClient } from '@supabase/supabase-js'
import { findReviewedTeamConversation, type ReviewedTeamRoom } from './first-party-team-scopes'
import { checkTeamChatAccess, isPlainChatPost, loadTeamChatRows } from './team-chat-updates'
import { loadTeamChatMessage, publicChatMessage } from './team-chat-message'
import { insertTeamMessage, parseTeamMessageSendId, type SentTeamMessage } from './team-room-message-send'
import { teamChatMessageId } from './team-chat-cursor'
import { loadNativeReactionSummary, setNativeChatReaction } from './native-chat-reactions'
import { changeNativePost } from './native-chat-message-tools'
import { chatSafetyAction, loadChatBlocks } from './team-chat-safety'
import { markTeamChatRead } from './team-chat-read'

const nameFor = (id: string, owner: string) => id === owner ? 'You' : `Teammate ${id.slice(-4).toUpperCase()}`
const fault = (status: number) => ({ ok: false as const, status })
const chatTeam = ({ teamName, leagueName, flight }: ReviewedTeamRoom) => ({ teamName, leagueName, flight, canManage: false })
export const reviewedTeamOptions = (teams: ReviewedTeamRoom[]) => teams.map(chatTeam)

function chatPost(row: SentTeamMessage, owner: string) {
  return {
    id: row.id, senderUserId: row.sender_user_id, senderName: nameFor(row.sender_user_id, owner),
    body: row.deleted_at ? '' : row.body, kind: 'message', createdAt: row.created_at || '',
    editedAt: row.edited_at || '', deletedAt: row.deleted_at || '',
    isMine: row.sender_user_id === owner, canManageOwn: row.sender_user_id === owner && !row.deleted_at,
    replyToMessageId: row.deleted_at ? '' : row.reply_to_message_id || '',
  }
}

export async function readFirstPartyChat(service: SupabaseClient, owner: string, room: ReviewedTeamRoom, params: URLSearchParams) {
  const roomId = room.roomId
  if (params.get('op') === 'message') {
    const messageId = params.get('message') || '', view = params.get('view') || ''
    const result = await loadTeamChatMessage(service, owner, roomId, messageId, view, true)
    if (!result.ok) return result
    return {
      ok: true as const, messageView: 1, roomId, requestedId: messageId, view: result.view,
      message: publicChatMessage(result.row, nameFor(result.row.sender_user_id, owner), false),
    }
  }
  const updates = params.get('op') === 'updates'
  const before = updates ? params.get('before') || '' : ''
  const focus = updates ? params.get('focus') || '' : ''
  const result = await loadTeamChatRows(service, owner, roomId, false, before, focus, true)
  if (!result.ok) return result
  const reactions = await loadNativeReactionSummary(service, owner, roomId, result.rows.filter(row => !row.deleted_at).map(row => row.id))
  const messages = result.rows.map(row => ({ ...chatPost(row, owner), reactions: reactions.get(row.id) || [] }))
  const chat = { id: roomId, messages, lastReadAt: result.lastReadAt }
  if (updates) {
    return {
      ok: true as const, chatUpdate: true, beforeCursor: result.beforeCursor, nextCursor: result.nextCursor,
      ...(focus ? { focusMessageId: result.focusMessageId, focusCursor: result.focusCursor } : {}),
      room: { ...chat, blockedUserIds: result.blockedUserIds },
    }
  }
  return {
    ok: true as const, nextCursor: result.nextCursor,
    room: {
      ...chat, ...chatTeam(room), subject: room.teamName, chatReady: true, members: [],
      activeCardId: '', nextScheduledMatch: null,
      blockedMembers: result.blockedUserIds.map(id => ({ id, name: nameFor(id, owner) })),
    },
  }
}

export async function countFirstPartyChats(service: SupabaseClient, owner: string, rooms: ReviewedTeamRoom[]) {
  if (!rooms.length) return { owner, teams: [], total: 0 }
  const blocked = await loadChatBlocks(service, owner)
  const teams: { teamName: string; leagueName: string; flight: string; unread: number }[] = []
  // Bound parallel reads for members connected to multiple teams.
  for (let offset = 0; offset < rooms.length; offset += 4) {
    const batch = await Promise.all(rooms.slice(offset, offset + 4).map(async room => {
      if (!await findReviewedTeamConversation(service, room)) return null
      const access = await checkTeamChatAccess(service, owner, room.roomId, false)
      if (!access.ok) {
        if (access.status === 403) return null
        throw Error('Chat counts unavailable')
      }
      let query = service.from('internal_messages').select('id', { count: 'exact', head: true })
        .eq('conversation_id', room.roomId).eq('message_kind', 'message').eq('metadata', '{}')
        .is('deleted_at', null).neq('sender_user_id', owner)
      const ignored = [...blocked].filter(teamChatMessageId)
      if (ignored.length) query = query.not('sender_user_id', 'in', '(' + ignored.join(',') + ')')
      if (access.lastReadAt) query = query.gt('created_at', access.lastReadAt)
      const result = await query
      if (result.error || typeof result.count !== 'number') throw Error('Chat counts unavailable')
      const { teamName, leagueName, flight } = room
      return { teamName, leagueName, flight, unread: Math.min(100, result.count) }
    }))
    teams.push(...batch.filter(team => team !== null))
  }
  return { owner, teams, total: Math.min(100, teams.reduce((sum, team) => sum + team.unread, 0)) }
}

export async function writeFirstPartyChat(service: SupabaseClient, owner: string, roomId: string, body: Record<string, unknown>) {
  const access = await checkTeamChatAccess(service, owner, roomId, false)
  if (!access.ok) return access
  const action = body.action
  if (action === 'send') {
    const text = typeof body.body === 'string' ? body.body.trim() : ''
    const clientMessageId = parseTeamMessageSendId(body.clientMessageId)
    if (!clientMessageId || !text || text.length > 2400 || body.announcement ||
        body.mentions !== undefined && (!Array.isArray(body.mentions) || body.mentions.length > 0)) return fault(400)
    const reply = body.replyToMessageId
    if (reply !== undefined && reply !== '' && !teamChatMessageId(reply)) return fault(400)
    if (typeof reply === 'string' && reply) {
      const target = await loadTeamChatMessage(service, owner, roomId, reply, 'message', true)
      if (!target.ok) return target
    }
    const sent = await insertTeamMessage(service, {
      conversationId: roomId, senderUserId: owner, body: text, announcement: false,
      replyToMessageId: typeof reply === 'string' && reply ? reply : null, clientMessageId,
    })
    if (!sent.ok) return sent
    if (!isPlainChatPost(sent.message)) return fault(409)
    return { ok: true as const, status: 200, message: chatPost(sent.message, owner) }
  }
  if (action === 'block_chat_member') {
    if (!teamChatMessageId(body.memberId)) return fault(400)
    const participant = await service.from('internal_conversation_participants').select('profile_id')
      .eq('conversation_id', roomId).eq('profile_id', body.memberId).maybeSingle()
    if (participant.error) return fault(503)
    if (participant.data?.profile_id !== body.memberId) return fault(404)
    return chatSafetyAction(service, owner, roomId, [{ id: body.memberId }], body)
  }
  if (action === 'unblock_chat_member') return teamChatMessageId(body.memberId)
    ? chatSafetyAction(service, owner, roomId, [], body) : fault(400)
  if (!['edit_chat_post', 'remove_chat_post', 'set_chat_reaction', 'mark_chat_read', 'report_chat_message'].includes(String(action)) ||
      !teamChatMessageId(body.messageId)) return fault(400)
  const post = await service.from('internal_messages').select('message_kind,metadata')
    .eq('conversation_id', roomId).eq('id', body.messageId).maybeSingle()
  if (post.error) return fault(503)
  if (!post.data || !isPlainChatPost(post.data)) return fault(404)
  if (action === 'edit_chat_post' || action === 'remove_chat_post') {
    return body.conversationId === roomId ? changeNativePost(service, owner, roomId, body) : fault(403)
  }
  if (action === 'set_chat_reaction') return setNativeChatReaction(service, owner, roomId, body)
  if (action === 'mark_chat_read') return markTeamChatRead(service, owner, roomId, body.messageId)
  return chatSafetyAction(service, owner, roomId, [], body)
}
