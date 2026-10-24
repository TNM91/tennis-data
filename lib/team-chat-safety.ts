import type {SupabaseClient} from '@supabase/supabase-js'
export const chatReportReasons = ['harassment', 'spam', 'inappropriate', 'other'] as const
export type ChatReportReason = typeof chatReportReasons[number]
export function isChatReportReason(value: unknown): value is ChatReportReason {
  return chatReportReasons.some(reason => reason === value)
}
export async function loadChatBlocks(service: SupabaseClient, userId: string) {
  const result = await service.from('team_chat_blocks').select('blocked_user_id').eq('owner_user_id', userId).limit(1000)
  if (result.error || !result.data || result.data.length >= 1000) throw Error('Chat safety settings are unavailable. Try again later.')
  return new Set<string>(result.data.map(row => row.blocked_user_id as string))
}
export function redactBlockedChatRows<T extends {sender_user_id: string; body: string; metadata: unknown; deleted_at: string | null; reply_to_message_id: string | null}>(rows: T[], blocked: Set<string>): T[] {
  // Redact before reply previews, attachments and match cards are assembled.
  return rows.map(row => blocked.has(row.sender_user_id) ? {...row, body: '', metadata: null, deleted_at: row.deleted_at || '1970-01-01T00:00:00.000Z', reply_to_message_id: null} : row)
}
export async function chatSafetyAction(service: SupabaseClient, userId: string, conversationId: string, members: {id: string}[], body: {action?: unknown; memberId?: unknown; messageId?: unknown; reason?: unknown}) {
  if (body.action === 'block_chat_member' || body.action === 'unblock_chat_member') {
    const memberId = typeof body.memberId === 'string' ? body.memberId : ''
    if (!memberId || memberId === userId) return {ok: false, status: 400, message: 'Choose another team member.'}
    if (body.action === 'block_chat_member' && !members.some(member => member.id === memberId)) return {ok: false, status: 403, message: 'This member is not connected to this team.'}
    const result = body.action === 'block_chat_member'
      ? await service.from('team_chat_blocks').upsert({owner_user_id: userId, blocked_user_id: memberId}, {onConflict: 'owner_user_id,blocked_user_id', ignoreDuplicates: true})
      : await service.from('team_chat_blocks').delete().eq('owner_user_id', userId).eq('blocked_user_id', memberId)
    return result.error ? {ok: false, status: 503, message: 'Could not save your block setting.'} : {ok: true, status: 200}
  }
  if (!isChatReportReason(body.reason) || typeof body.messageId !== 'string') return {ok: false, status: 400, message: 'Choose a message and report reason.'}
  const target = await service.from('internal_messages').select('id,sender_user_id,body').eq('id', body.messageId).eq('conversation_id', conversationId).is('deleted_at', null).maybeSingle()
  if (target.error) return {ok: false, status: 503, message: 'Could not check this message.'}
  if (!target.data || target.data.sender_user_id === userId) return {ok: false, status: 404, message: 'This message cannot be reported.'}
  const saved = await service.from('team_chat_reports').upsert({reporter_user_id: userId, message_id: target.data.id, conversation_id: conversationId, reported_user_id: target.data.sender_user_id, reason: body.reason, message_body: String(target.data.body).slice(0,2400)}, {onConflict: 'reporter_user_id,message_id', ignoreDuplicates: true})
  return saved.error ? {ok: false, status: 503, message: 'Your report could not be saved. Please try again.'} : {ok: true, status: 200}
}
export async function chatNotificationRecipients(service: SupabaseClient, actorId: string, recipientIds: string[]) {
  if (!recipientIds.length) return []
  const blocks = await service.from('team_chat_blocks').select('owner_user_id').eq('blocked_user_id', actorId).in('owner_user_id', recipientIds)
  // Failing closed suppresses notification content, not an already saved message.
  if (blocks.error) return []
  const blockedBy = new Set((blocks.data || []).map(row => row.owner_user_id as string))
  return recipientIds.filter(id => !blockedBy.has(id))
}
